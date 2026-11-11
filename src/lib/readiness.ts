import { allItems, itemById, packIndexOf } from "./content";
import { db, withRetry, type Exercise } from "./db";
import { dialogueTaskById } from "./dialogues";
import { sentenceTaskById } from "./sentences";
import { getGating } from "./settings";

/**
 * Readiness: which NEW cards of an exercise may enter a session now.
 * Levelling by readiness rather than by exercise type — mixing task types
 * is good for grammar (interleaving), but a suffix, a verb form or a
 * sentence only makes sense once its words have been met in the flashcards.
 *
 *  - harmony / builder / conj: the stem (verb) was seen in "recognize"
 *    (its card is no longer New);
 *  - sentence from an item's example or phrase: that item was seen;
 *    curated pack sentences and dialogues: at least PACK_SHARE of the
 *    pack's items were seen.
 *
 * Cards already started are never held back; "Помилки" ignores readiness.
 * New sentences and dialogues also come shortest first.
 */
export const PACK_SHARE = 0.5;

export interface Readiness {
  ready: (itemId: string) => boolean;
  /** Lower first among new cards; undefined keeps the due order. */
  rank?: (itemId: string) => number;
}

const GATED: Exercise[] = ["harmony", "builder", "conj", "sentence", "dialogue"];

export async function readiness(exercise: Exercise): Promise<Readiness | null> {
  if (!GATED.includes(exercise) || (await getGating()) === "off") return null;
  const seen = new Set<string>();
  for (const c of await withRetry(() => db.cards.where("exercise").equals("recognize").toArray())) if (c.state !== 0) seen.add(c.itemId);
  const total = new Map<number, number>();
  const seenIn = new Map<number, number>();
  for (const it of allItems) {
    const p = packIndexOf(it.id);
    total.set(p, (total.get(p) ?? 0) + 1);
    if (seen.has(it.id)) seenIn.set(p, (seenIn.get(p) ?? 0) + 1);
  }
  const packReady = (id: string) => {
    const p = packIndexOf(id);
    return (seenIn.get(p) ?? 0) >= PACK_SHARE * (total.get(p) ?? 1);
  };
  switch (exercise) {
    case "sentence":
      return {
        ready: (id) => (itemById(id) ? seen.has(id) : packReady(id)),
        rank: (id) => sentenceTaskById(id)?.words.length ?? 99,
      };
    case "dialogue":
      return { ready: packReady, rank: (id) => dialogueTaskById(id)?.dialogue.lines.length ?? 99 };
    default:
      return { ready: (id) => seen.has(id.split("+")[0]) };
  }
}

/** True when the exercise has new cards that readiness is holding back (for the empty-queue message). */
export async function heldBack(exercise: Exercise): Promise<boolean> {
  const g = await readiness(exercise);
  if (!g) return false;
  const fresh = await withRetry(() => db.cards.where("exercise").equals(exercise).and((c) => c.state === 0).toArray());
  return fresh.some((c) => !g.ready(c.itemId));
}

export const HELD_BACK_TEXT: Partial<Record<Exercise, string>> = {
  harmony: "Суфікси даються на слова, які ти вже бачив у «Картках». Повтори слова — і завдання зʼявляться.",
  builder: "Конструктор збирає слова, які ти вже бачив у «Картках». Повтори слова — і завдання зʼявляться.",
  conj: "Дієвідміна дається на дієслова, які ти вже бачив у «Картках». Повтори слова — і завдання зʼявляться.",
  sentence: "Речення відкриваються, коли їхні слова вже були в «Картках» (речення пакета — коли половина його слів). Повтори слова.",
  dialogue: "Діалоги пакета відкриваються, коли половину його слів ти вже бачив у «Картках». Повтори слова.",
};
