import { allItems, allPatterns, attaches, packIndexOf, packs, patternById, patternShort, roleOf } from "./content";
import { apply } from "./harmony";
import { stripAccents } from "./dictation";
import { isConjugable } from "./conj";
import { builderTaskById } from "./builder";
import type { Item, Pattern } from "./types";

/**
 * Dictionary lookup over the content: search by Hungarian (accent-
 * insensitive, prefix first) or by Ukrainian (substring), then every form
 * the app can build for the word — cases, possessives, plural and the
 * derivations that make sense for its part of speech and role. Forms are
 * computed with the same apply() as the exercises.
 */
const fold = (s: string) => stripAccents(s.toLowerCase());
const indexed = allItems.map((it) => ({ it, hu: fold(it.hu), ua: it.ua.toLowerCase() }));

export function searchItems(q: string, limit = 40): Item[] {
  const needle = fold(q.trim());
  if (!needle) return [];
  const cyr = /[Ѐ-ӿ]/.test(needle);
  const scored: [number, Item][] = [];
  for (const { it, hu, ua } of indexed) {
    let score = -1;
    if (cyr) {
      if (ua === needle) score = 0;
      else if (ua.startsWith(needle)) score = 1;
      else if (ua.includes(needle)) score = 2;
    } else {
      if (hu === needle) score = 0;
      else if (hu.startsWith(needle)) score = 1;
      else if (hu.includes(needle)) score = 2;
      else if (ua.includes(needle)) score = 3;
    }
    if (score >= 0) scored.push([score * 1000 + (it.type === "phrase" ? 500 : 0) + it.hu.length, it]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, it]) => it);
}

/** Suffixes shown for nouns, in textbook order; derivations come after. */
const NOUN_ORDER = ["suf-accusative", "suf-plural", "suf-poss1", "suf-poss2", "suf-poss3", "suf-inessive", "suf-illative", "suf-elative", "suf-superessive", "suf-sublative", "suf-delative", "suf-adessive", "suf-allative", "suf-ablative", "suf-dative", "suf-instrumental", "suf-causal", "suf-terminative", "suf-temporal", "suf-essive-formal", "suf-distributive", "suf-adjectival-i", "suf-adjectival-s", "suf-attributive", "suf-privative", "suf-family", "suf-quantity", "suf-like"];

export interface FormRow {
  pattern: Pattern;
  label: string;
  form: string;
}

/** Suffixes shown for every word they attach to; the other derivations (-i, -s, -ék, -nyi, -szerű…) only when the content has an example with this very stem. */
const CORE = new Set(["suf-accusative", "suf-plural", "suf-poss1", "suf-poss2", "suf-poss3", "suf-inessive", "suf-illative", "suf-elative", "suf-superessive", "suf-sublative", "suf-delative", "suf-adessive", "suf-allative", "suf-ablative", "suf-dative", "suf-instrumental", "suf-causal", "suf-terminative", "suf-comparative", "suf-adverbial", "suf-abstract", "suf-language"]);

/** Every suffixed form the app would build for a word (none for phrases; verbs get -ás/-és only when tagged — the conjugation covers -hat/-het). */
export function formsFor(item: Item): FormRow[] {
  if (item.type !== "word" || !item.harmony) return [];
  const ok = (p: Pattern) =>
    attaches(p, item) &&
    p.fromInfinitive !== "plain" &&
    !(p.fromInfinitive && !isConjugable(item)) &&
    (CORE.has(p.id) || !!builderTaskById(`${item.id}+${p.id}`));
  const order = new Map(NOUN_ORDER.map((id, i) => [id, i]));
  const ps = allPatterns.filter(ok).sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  return ps.map((p) => ({ pattern: p, label: `${p.name.split(" (")[0]} — ${patternShort(p, item)}`, form: apply(item.hu, p, item.harmony!, item.forms) }));
}

export const packOf = (item: Item) => packs[packIndexOf(item.id)];
export const roleLabel = (item: Item) =>
  item.pos !== "noun" ? "" : { thing: "річ", person: "людина", place: "місце", time: "час", food: "їжа, напій", group: "група людей", abstract: "абстрактне" }[roleOf(item)] ?? "";
export { patternById };
