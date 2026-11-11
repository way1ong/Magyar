import { allPatterns, attaches, packIndexOf, packs, patternById, stemByHu } from "./content";
import { applyParts, suffixFor, variantsOf } from "./harmony";
import { frameFor } from "./frames";
import type { Frame, Item, Pattern } from "./types";

/**
 * Builder exercise: show a Ukrainian gloss ("у будинку"), assemble the
 * Hungarian word from blocks (stem + suffix). Tasks come from pattern
 * examples and packs' extra `examples` whose stem is a known word with a
 * harmony class.
 * Card key: `builder:<stemItemId>+<patternId>`.
 */
export interface BuilderTask {
  id: string; // `${stem.id}+${pattern.id}`
  stem: Item & { harmony: NonNullable<Item["harmony"]> };
  pattern: Pattern;
  ua: string;
  /** Full answer, from apply(). */
  result: string;
  /** The suffix block that is correct for this stem ("ban", or "n" after a vowel). */
  suffix: string;
  /** The stem as it appears in the result (kez-, tükr-); differs from stem.hu when the stem changes. */
  base: string;
  /** Context sentence with a "___" gap (from the example or the pattern's frames), if any. */
  frame?: Frame;
}

/** Pattern examples plus packs' extra examples for patterns defined anywhere. */
const examples = [
  ...allPatterns.flatMap((pattern) => pattern.examples.map((ex) => ({ pattern, ex }))),
  ...packs.flatMap((pack) =>
    (pack.examples ?? []).flatMap((ex) => {
      const pattern = patternById(ex.pattern);
      return pattern ? [{ pattern, ex }] : [];
    })
  ),
];

const tasks = new Map<string, BuilderTask>();
for (const { pattern, ex } of examples) {
  const stem = stemByHu(ex.stem);
  if (!stem?.harmony) continue;
  const id = `${stem.id}+${pattern.id}`;
  const { base, suffix, result } = applyParts(stem.hu, pattern, stem.harmony, stem.forms, stem);
  // content:check guarantees these agree; never teach a form we can't model.
  if (tasks.has(id) || result !== ex.result) continue;
  tasks.set(id, {
    id,
    stem: stem as BuilderTask["stem"],
    pattern,
    ua: ex.ua,
    result,
    suffix,
    base,
    frame: ex.frame ?? frameFor(pattern, stem),
  });
}


export const builderTasks: BuilderTask[] = [...tasks.values()];

/** A task belongs to the later of its stem's and its suffix's pack. */
export const taskPackIndex = (t: BuilderTask) => Math.max(packIndexOf(t.stem.id), packIndexOf(t.pattern.id));
export const builderTaskById = (id: string) => tasks.get(id);

/**
 * Harmony cards: the same curated tasks, but only where the suffix has more
 * than one harmony variant to choose from (-ért, -ig, -kor, -i, -ként are no
 * choice). Card key: `harmony:<stemItemId>+<patternId>`.
 */
export const harmonyTasks: BuilderTask[] = builderTasks.filter((t) => variantsOf(t.pattern).length > 1);
const harmonyIds = new Set(harmonyTasks.map((t) => t.id));
export const harmonyTaskById = (id: string) => (harmonyIds.has(id) ? tasks.get(id) : undefined);

export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Suffix blocks for a task: the right one, the other harmony variants of the
 * same suffix (harmony mistakes), then same-harmony forms of other suffixes
 * for this part of speech (meaning mistakes). Up to `count`, shuffled.
 */
export function suffixOptions(t: BuilderTask, count = 4): string[] {
  const { stem, pattern } = t;
  const opts = new Set([t.suffix]);
  for (const v of shuffle(variantsOf(pattern))) {
    if (opts.size >= Math.min(3, count)) break;
    opts.add(v);
  }
  const others = allPatterns.filter((p) => p.id !== pattern.id);
  const pool = [
    ...shuffle(others.filter((p) => attaches(p, stem))),
    ...shuffle(others.filter((p) => !attaches(p, stem))),
  ];
  for (const p of pool) {
    if (opts.size >= count) break;
    opts.add(suffixFor(stem.hu, p, stem.harmony, stem.forms, stem));
  }
  return shuffle([...opts]);
}
