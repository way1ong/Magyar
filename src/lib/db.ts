import Dexie, { type Table } from "dexie";
import type { Card } from "ts-fsrs";

/**
 * Progress DB. Everything here is generated on the phone.
 * Content is NOT stored here — it is imported from /content/*.json.
 */

/** FSRS card state for one item, plus which exercise it belongs to. */
export interface CardRow {
  /** `${exercise}:${itemId}` — e.g. "recall:a1-01-haz", "builder:a1-01-haz+suf-inessive" */
  key: string;
  exercise: Exercise;
  itemId: string;
  /** Flattened ts-fsrs Card with dates as epoch ms for indexing. */
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number; // ts-fsrs State enum
  last_review?: number;
}

/**
 * recognize/recall: itemId = content item id.
 * harmony: itemId = stem item id (a random pattern is drawn each time).
 * builder: itemId = `${stemItemId}+${patternId}` (see lib/builder.ts).
 * dictation: itemId = content item id (hear it, type it; lib/dictation.ts).
 */
export type Exercise = "recognize" | "recall" | "harmony" | "builder" | "dictation";

/** Full review log — keep every event, FSRS can be re-optimised from it. */
export interface ReviewRow {
  id?: number;
  key: string;
  rating: number; // ts-fsrs Rating 1..4
  ts: number;
  /** ms spent on the answer */
  took?: number;
}

export interface MetaRow {
  k: string;
  v: unknown;
}

class MagyarDB extends Dexie {
  cards!: Table<CardRow, string>;
  reviews!: Table<ReviewRow, number>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("magyar");
    this.version(1).stores({
      cards: "key, exercise, itemId, due, state",
      reviews: "++id, key, ts",
      meta: "k",
    });
  }
}

export const db = new MagyarDB();

export function toRow(key: string, exercise: Exercise, itemId: string, c: Card): CardRow {
  return {
    key,
    exercise,
    itemId,
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review?.getTime(),
  };
}

export function fromRow(r: CardRow): Card {
  return {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state,
    last_review: r.last_review ? new Date(r.last_review) : undefined,
  } as Card;
}

/** Export everything for backup. */
export async function exportProgress() {
  const [cards, reviews, meta] = await Promise.all([
    db.cards.toArray(),
    db.reviews.toArray(),
    db.meta.toArray(),
  ]);
  return { version: 1, exportedAt: new Date().toISOString(), cards, reviews, meta };
}

export async function importProgress(data: Awaited<ReturnType<typeof exportProgress>>) {
  await db.transaction("rw", db.cards, db.reviews, db.meta, async () => {
    await db.cards.clear();
    await db.reviews.clear();
    await db.meta.clear();
    await db.cards.bulkPut(data.cards);
    await db.reviews.bulkPut(data.reviews.map(({ id: _id, ...r }) => r));
    await db.meta.bulkPut(data.meta);
  });
}
