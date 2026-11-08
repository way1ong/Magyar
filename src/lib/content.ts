import type { ContentPack, Item, PartOfSpeech, Pattern, Role } from "./types";
import { variantsOf } from "./harmony";
import a1_01 from "@content/a1-01.json";
import a1_02 from "@content/a1-02.json";
import a1_03 from "@content/a1-03.json";
import a1_04 from "@content/a1-04.json";
import a1_05 from "@content/a1-05.json";
import a2_01 from "@content/a2-01.json";
import a2_02 from "@content/a2-02.json";
import a2_03 from "@content/a2-03.json";
import a2_04 from "@content/a2-04.json";
import a2_05 from "@content/a2-05.json";

/**
 * Content registry. Add a pack: drop the JSON in /content and import it here.
 * Packs are bundled into the app, so they work offline with no fetch.
 */
export const packs: ContentPack[] = [a1_01 as ContentPack, a1_02 as ContentPack, a1_03 as ContentPack, a1_04 as ContentPack, a1_05 as ContentPack, a2_01 as ContentPack, a2_02 as ContentPack, a2_03 as ContentPack, a2_04 as ContentPack, a2_05 as ContentPack];

export const allItems: Item[] = packs.flatMap((p) => p.items);
export const allPatterns: Pattern[] = packs.flatMap((p) => p.patterns);

const itemIndex = new Map(allItems.map((i) => [i.id, i]));
const patternIndex = new Map(allPatterns.map((p) => [p.id, p]));

export const itemById = (id: string) => itemIndex.get(id);
export const patternById = (id: string) => patternIndex.get(id);

/** Which pack (0-based position in `packs`) an item or pattern id belongs to. */
const packIndexById = new Map<string, number>();
packs.forEach((p, n) => {
  for (const i of p.items) packIndexById.set(i.id, n);
  for (const pt of p.patterns) packIndexById.set(pt.id, n);
});
export const packIndexOf = (id: string) => packIndexById.get(id) ?? 0;

/** Short Ukrainian gloss of a suffix for result lines ("у чомусь (де?)"); role-specific when the item is known. */
export const patternShort = (p: Pattern, item?: Item) =>
  (item && p.shortByRole?.[roleOf(item)]) ?? p.short ?? p.meaning.split(" — ")[0];

/** Words with a known harmony class, by Hungarian form — resolves pattern example stems. */
const stemIndex = new Map<string, Item>();
for (const i of allItems) {
  if (i.type === "word" && i.harmony && !stemIndex.has(i.hu)) stemIndex.set(i.hu, i);
}
export const stemByHu = (hu: string) => stemIndex.get(hu);

/** Adjectives take no case suffixes by default (-ul/-ül opts in via attachesTo). */
const DEFAULT_ATTACH: PartOfSpeech[] = ["noun"];
const TIME_TAGS = ["time", "day", "month", "season", "daytime"];

/** Semantic role of a noun, from its tags. */
export function roleOf(item: Item): Role {
  const tags = item.tags ?? [];
  if (tags.includes("person")) return "person";
  if (tags.includes("place")) return "place";
  if (tags.some((t) => TIME_TAGS.includes(t))) return "time";
  if (tags.includes("food") || tags.includes("drink")) return "food";
  return "thing";
}

/**
 * Does this suffix go on this word? Part of speech, the tag a pattern may
 * require, and for nouns the semantic role (no "apában", no "asztalnak").
 */
export const attaches = (p: Pattern, item: Item) =>
  (p.attachesTo ?? DEFAULT_ATTACH).includes(item.pos) &&
  (!p.attachesTag || (item.tags ?? []).includes(p.attachesTag)) &&
  (!p.roles || item.pos !== "noun" || p.roles.includes(roleOf(item)));

/**
 * Patterns usable in the Harmony game for a stem: they attach to its part of
 * speech and have more than one variant (single-form -ért/-ig is no choice).
 */
export const harmonyPatternsFor = (item: Item) =>
  allPatterns.filter((p) => attaches(p, item) && variantsOf(p).length > 1);

/** Nouns/adjectives with a known harmony class — the stems for the Harmony game. */
export const harmonyStems = allItems.filter(
  (i) =>
    i.type === "word" &&
    i.harmony &&
    (i.pos === "noun" || i.pos === "adj") &&
    harmonyPatternsFor(i).length > 0
);
