import type { ContentPack, Item, PartOfSpeech, Pattern } from "./types";
import { variantsOf } from "./harmony";
import a1_01 from "@content/a1-01.json";
import a1_02 from "@content/a1-02.json";
import a1_03 from "@content/a1-03.json";
import a1_04 from "@content/a1-04.json";

/**
 * Content registry. Add a pack: drop the JSON in /content and import it here.
 * Packs are bundled into the app, so they work offline with no fetch.
 */
export const packs: ContentPack[] = [a1_01 as ContentPack, a1_02 as ContentPack, a1_03 as ContentPack, a1_04 as ContentPack];

export const allItems: Item[] = packs.flatMap((p) => p.items);
export const allPatterns: Pattern[] = packs.flatMap((p) => p.patterns);

const itemIndex = new Map(allItems.map((i) => [i.id, i]));
const patternIndex = new Map(allPatterns.map((p) => [p.id, p]));

export const itemById = (id: string) => itemIndex.get(id);
export const patternById = (id: string) => patternIndex.get(id);

/** Words with a known harmony class, by Hungarian form — resolves pattern example stems. */
const stemIndex = new Map<string, Item>();
for (const i of allItems) {
  if (i.type === "word" && i.harmony && !stemIndex.has(i.hu)) stemIndex.set(i.hu, i);
}
export const stemByHu = (hu: string) => stemIndex.get(hu);

const DEFAULT_ATTACH: PartOfSpeech[] = ["noun", "adj"];

/** Does this suffix go on this part of speech? */
export const attaches = (p: Pattern, pos: PartOfSpeech) =>
  (p.attachesTo ?? DEFAULT_ATTACH).includes(pos);

/**
 * Patterns usable in the Harmony game for a stem: they attach to its part of
 * speech and have more than one variant (single-form -ért/-ig is no choice).
 */
export const harmonyPatternsFor = (item: Item) =>
  allPatterns.filter((p) => attaches(p, item.pos) && variantsOf(p).length > 1);

/** Nouns/adjectives with a known harmony class — the stems for the Harmony game. */
export const harmonyStems = allItems.filter(
  (i) =>
    i.type === "word" &&
    i.harmony &&
    (i.pos === "noun" || i.pos === "adj") &&
    harmonyPatternsFor(i).length > 0
);
