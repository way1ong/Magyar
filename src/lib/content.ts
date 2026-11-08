import type { ContentPack, Item, Pattern } from "./types";
import a1_01 from "@content/a1-01.json";

/**
 * Content registry. Add a pack: drop the JSON in /content and import it here.
 * Packs are bundled into the app, so they work offline with no fetch.
 */
export const packs: ContentPack[] = [a1_01 as ContentPack];

export const allItems: Item[] = packs.flatMap((p) => p.items);
export const allPatterns: Pattern[] = packs.flatMap((p) => p.patterns);

const itemIndex = new Map(allItems.map((i) => [i.id, i]));
const patternIndex = new Map(allPatterns.map((p) => [p.id, p]));

export const itemById = (id: string) => itemIndex.get(id);
export const patternById = (id: string) => patternIndex.get(id);

/** Nouns/adjectives with a known harmony class — the stems for the Harmony game. */
export const harmonyStems = allItems.filter(
  (i) => i.type === "word" && i.harmony && (i.pos === "noun" || i.pos === "adj")
);
