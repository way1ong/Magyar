import { createEmptyCard, fsrs, generatorParameters, Rating, type Grade } from "ts-fsrs";
import { db, fromRow, toRow, withRetry, type CardRow, type Exercise } from "./db";
import { readiness } from "./readiness";

export { Rating };
export type { Grade };

/**
 * Single FSRS instance. request_retention 0.9 = aim to remember 90% at review time.
 * When the review log has a few hundred entries, parameters (w) can be optimised
 * offline from db.reviews and dropped in here.
 */
const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: 180, // days; keep it tight for the first months
    enable_fuzz: true,
  })
);

export const keyOf = (exercise: Exercise, itemId: string) => `${exercise}:${itemId}`;

/** Make sure a card exists for every (exercise, item) pair. Idempotent. */
export async function ensureCards(exercise: Exercise, itemIds: string[]) {
  const now = new Date();
  const existing = new Set(
    (await db.cards.where("exercise").equals(exercise).primaryKeys()) as string[]
  );
  const rows: CardRow[] = [];
  for (const id of itemIds) {
    const key = keyOf(exercise, id);
    if (!existing.has(key)) rows.push(toRow(key, exercise, id, createEmptyCard(now)));
  }
  if (!rows.length) return;
  try {
    await withRetry(() => db.cards.bulkAdd(rows));
  } catch (e) {
    // Two windows seeding at once: the keys the other one added first are fine to skip.
    if ((e as { name?: string }).name !== "BulkError") throw e;
  }
}

/** Cards due now for one exercise, oldest first. New cards are due immediately. */
export async function dueCards(exercise: Exercise, limit = 20, newLimit = 10): Promise<CardRow[]> {
  const now = Date.now();
  const due = await db.cards
    .where("exercise")
    .equals(exercise)
    .and((c) => c.due <= now)
    .toArray();
  // state 0 = New. Cap how many brand-new cards enter a session.
  const review = due.filter((c) => c.state !== 0).sort((a, b) => a.due - b.due);
  const fresh = due.filter((c) => c.state === 0).slice(0, newLimit);
  return [...review, ...fresh].slice(0, limit);
}

export async function dueCount(exercise: Exercise) {
  const now = Date.now();
  return db.cards.where("exercise").equals(exercise).and((c) => c.due <= now).count();
}

/** Record an answer: update the FSRS card and append to the review log. */
export async function answer(row: CardRow, rating: Grade, took?: number) {
  const now = new Date();
  const { card } = scheduler.next(fromRow(row), now, rating);
  const updated = toRow(row.key, row.exercise, row.itemId, card);
  await withRetry(() =>
    db.transaction("rw", db.cards, db.reviews, async () => {
      await db.cards.put(updated);
      await db.reviews.add({ key: row.key, rating, ts: now.getTime(), took });
    }),
  );
  return updated;
}

/** Preview intervals for the four buttons (shown as "1д", "4д" …). */
export function previewIntervals(row: CardRow): Record<Grade, string> {
  const now = new Date();
  const out = {} as Record<Grade, string>;
  for (const g of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]) {
    const { card } = scheduler.next(fromRow(row), now, g);
    const mins = Math.round((card.due.getTime() - now.getTime()) / 60000);
    out[g] =
      mins < 60 ? `${Math.max(1, mins)} хв` : mins < 1440 ? `${Math.round(mins / 60)} год` : `${Math.round(mins / 1440)} дн`;
  }
  return out;
}

/**
 * One session's worth of cards: up to `newLimit` new cards are always
 * included when there are any, and the rest of the `limit` goes to due
 * cards, oldest first. (Cards in learning come back after 1–10 minutes, so
 * without the guaranteed share of new cards a session would be filled by
 * the same few cards and progress would stall.) When fewer than `minimum`
 * are due, the queue is topped up with the soonest cards ahead of schedule
 * — learning cards first, then reviews, then more new ones — so "Ще раз"
 * always has something to practise. Reviewing early is fine for FSRS.
 */
export async function sessionCards(exercise: Exercise, limit = 20, newLimit = 10, minimum = 8): Promise<CardRow[]> {
  const now = Date.now();
  const gate = await readiness(exercise);
  // New cards enter only when ready (readiness.ts); started cards are never held back.
  const all = (await withRetry(() => db.cards.where("exercise").equals(exercise).toArray())).filter((c) => c.state !== 0 || !gate || gate.ready(c.itemId));
  const byNew = (a: CardRow, b: CardRow) => (gate?.rank ? gate.rank(a.itemId) - gate.rank(b.itemId) : 0) || a.due - b.due;
  const due = all.filter((c) => c.due <= now);
  const fresh = due.filter((c) => c.state === 0).sort(byNew).slice(0, newLimit);
  const review = due
    .filter((c) => c.state !== 0)
    .sort((a, b) => a.due - b.due)
    .slice(0, Math.max(0, limit - fresh.length));
  const q = [...review, ...fresh];
  if (q.length < minimum) {
    const have = new Set(q.map((c) => c.key));
    const ahead = all
      .filter((c) => !have.has(c.key))
      .sort((a, b) => Number(a.state === 0) - Number(b.state === 0) || (a.state === 0 ? byNew(a, b) : a.due - b.due));
    q.push(...ahead.slice(0, minimum - q.length));
  }
  return q;
}
