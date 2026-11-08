import { builderTasks, shuffle, taskPackIndex, type BuilderTask } from "./builder";
import { allPatterns, attaches, packIndexOf, packs } from "./content";
import { apply } from "./harmony";
import type { ContentPack, Harmony, Item } from "./types";

/**
 * Boss: the end-of-pack test. No hints, no replay, no FSRS — a fixed set
 * of multiple-choice questions drawn from one pack:
 *  - recognize: hu → pick the ua meaning
 *  - recall:    ua → pick the hu word
 *  - form:      ua gloss → pick the right suffixed word (Builder without blocks)
 */
export interface BossQuestion {
  kind: "recognize" | "recall" | "form";
  prompt: string;
  options: string[];
  answer: string;
}

export const BOSS_SIZE = 20;

const HARMONIES: Harmony[] = ["back", "front", "front_rounded"];

/** Up to `n` distinct distractor strings, preferring the same part of speech. */
function pickDistractors(item: Item, pool: Item[], field: "hu" | "ua", n: number): string[] {
  const same = shuffle(pool.filter((x) => x.id !== item.id && x.pos === item.pos));
  const rest = shuffle(pool.filter((x) => x.id !== item.id && x.pos !== item.pos));
  const out = new Set<string>();
  for (const x of [...same, ...rest]) {
    if (out.size >= n) break;
    if (x[field] !== item[field]) out.add(x[field]);
  }
  return [...out];
}

/** Wrong forms of the same stem: other harmony variants, then other suffixes. */
function formDistractors(t: BuilderTask, n: number): string[] {
  const out = new Set<string>();
  for (const h of shuffle(HARMONIES)) {
    const w = apply(t.stem.hu, t.pattern, h, t.stem.forms);
    if (w !== t.result) out.add(w);
  }
  const others = shuffle(allPatterns.filter((p) => p.id !== t.pattern.id && attaches(p, t.stem)));
  for (const p of others) {
    if (out.size >= n) break;
    const w = apply(t.stem.hu, p, t.stem.harmony, t.stem.forms);
    if (w !== t.result) out.add(w);
  }
  return [...out].slice(0, n);
}

/** Builder tasks that belong to this pack (by the later of stem's and suffix's pack). */
export const bossFormTasks = (pack: ContentPack) => {
  const n = packs.indexOf(pack);
  return builderTasks.filter((t) => taskPackIndex(t) === n);
};

export function bossQuestions(pack: ContentPack, size = BOSS_SIZE): BossQuestion[] {
  const items = pack.items.filter((i) => packIndexOf(i.id) === packs.indexOf(pack));
  const forms = shuffle(bossFormTasks(pack));
  const nForm = Math.min(Math.round(size * 0.3), forms.length);
  const nWords = Math.min(size - nForm, items.length);

  const qs: BossQuestion[] = [];
  for (const t of forms.slice(0, nForm)) {
    const ds = formDistractors(t, 3);
    if (ds.length < 2) continue;
    qs.push({ kind: "form", prompt: t.ua, options: shuffle([t.result, ...ds]), answer: t.result });
  }
  shuffle(items)
    .slice(0, nWords)
    .forEach((it, k) => {
      const kind = k % 2 === 0 ? "recognize" : "recall";
      const field = kind === "recognize" ? "ua" : "hu";
      const ds = pickDistractors(it, items, field, 3);
      if (ds.length < 2) return;
      qs.push({ kind, prompt: kind === "recognize" ? it.hu : it.ua, options: shuffle([it[field], ...ds]), answer: it[field] });
    });
  return shuffle(qs);
}
