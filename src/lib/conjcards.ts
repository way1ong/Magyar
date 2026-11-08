import { allItems, packIndexOf } from "./content";
import { hasImperative, isConjugable, isTransitive, parseSlot, PERSONS, TENSES, type Person, type Tense } from "./conj";
import type { Item } from "./types";

/**
 * Conjugation exercise cards: one per verb and tense (present, past, future, potential -hat/-het, imperative, conditional) × definiteness
 * (definite only for transitive verbs); the person is drawn at random each
 * time, since every verb has all six. Card key: `conj:<itemId>+<tense>.<def>`.
 */
export interface ConjTask {
  id: string;
  item: Item;
  tense: Tense;
  def: boolean;
}

const tasks = new Map<string, ConjTask>();
for (const item of allItems) {
  if (!isConjugable(item)) continue;
  for (const tense of TENSES.filter((t) => t !== "imp" || hasImperative(item))) {
    for (const def of isTransitive(item) ? [false, true] : [false]) {
      const id = `${item.id}+${tense}.${def ? "def" : "indef"}`;
      tasks.set(id, { id, item, tense, def });
    }
  }
}

export const conjTasks: ConjTask[] = [...tasks.values()];
export const conjTaskById = (id: string) => tasks.get(id);
export const conjTaskPackIndex = (t: ConjTask) => packIndexOf(t.item.id);

/** A random person for a task; the slot key is what conjugate() takes. */
export function randomPerson(): Person {
  return PERSONS[Math.floor(Math.random() * PERSONS.length)];
}
export { parseSlot };
