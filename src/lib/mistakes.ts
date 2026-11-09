import { db, withRetry, type CardRow, type Exercise } from "./db";
import { Rating } from "./scheduler";

/**
 * Mistakes: cards answered "Again" in the last week, for a focused rerun.
 * The session mode is handed from the Mistakes page to an exercise through
 * sessionStorage (works in both builds and survives the static-site
 * navigation); the exercise takes it once and clears it.
 */
export const MISTAKE_DAYS = 7;
const MODE_KEY = "magyar:mode";
/** Which exercises each page loads. */
export const PAGE_EXERCISES: Record<string, Exercise[]> = {
  review: ["recognize", "recall"],
  harmony: ["harmony"],
  builder: ["builder"],
  conj: ["conj"],
  sentence: ["sentence"],
};

/** Keys of cards failed recently (latest rating per key within the window must be Again). */
export async function mistakeKeys(days = MISTAKE_DAYS): Promise<Set<string>> {
  const since = Date.now() - days * 86400000;
  const rows = await withRetry(() => db.reviews.where("ts").aboveOrEqual(since).toArray());
  const last = new Map<string, number>();
  for (const r of rows.sort((a, b) => a.ts - b.ts)) last.set(r.key, r.rating);
  return new Set([...last.entries()].filter(([, rating]) => rating === Rating.Again).map(([k]) => k));
}

export async function mistakeCounts(): Promise<Record<string, number>> {
  const keys = await mistakeKeys();
  const out: Record<string, number> = {};
  for (const [page, exs] of Object.entries(PAGE_EXERCISES)) out[page] = [...keys].filter((k) => exs.includes(k.split(":")[0] as Exercise)).length;
  return out;
}

export async function mistakeCards(exercise: Exercise, limit = 20): Promise<CardRow[]> {
  const keys = [...(await mistakeKeys())].filter((k) => k.startsWith(exercise + ":"));
  const rows = await withRetry(() => db.cards.bulkGet(keys));
  return rows.filter((r): r is CardRow => !!r).slice(0, limit);
}

export function requestMistakeMode(page: string) {
  try {
    sessionStorage.setItem(MODE_KEY, `mistakes:${page}`);
  } catch {
    // No storage: the exercise opens normally.
  }
}

/** True once if the page was opened from "Помилки"; the flag is cleared. */
export function takeMistakeMode(page: string): boolean {
  try {
    const v = sessionStorage.getItem(MODE_KEY);
    if (v !== `mistakes:${page}`) return false;
    sessionStorage.removeItem(MODE_KEY);
    return true;
  } catch {
    return false;
  }
}
