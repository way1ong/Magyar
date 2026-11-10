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
 * harmony: itemId = `${stemItemId}+${patternId}` (curated task, see lib/builder.ts harmonyTasks;
 *   before v0.5 it was the stem id alone — seed.ts migrates those).
 * builder: itemId = `${stemItemId}+${patternId}` (see lib/builder.ts).
 * dictation: itemId = content item id (hear it, type it; lib/dictation.ts).
 * conj: itemId = `${verbItemId}+${tense}.${indef|def}` (lib/conjcards.ts; a random person each time).
 * sentence: itemId = a curated sentence id (`a1-01-s01`) or the item whose example/phrase it is (lib/sentences.ts).
 * dialogue: itemId = dialogue id (`a1-01-d01`, lib/dialogues.ts).
 */
export type Exercise = "recognize" | "recall" | "harmony" | "builder" | "dictation" | "conj" | "sentence" | "dialogue";

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

/** Errors the browser throws when it tears a transaction down under us (background tab, storage pressure, closed connection). */
const TRANSIENT = new Set(["AbortError", "InvalidStateError", "UnknownError", "TransactionInactiveError", "DatabaseClosedError"]);
const isTransient = (e: unknown) => {
  const err = e as { name?: string; inner?: { name?: string } } | null;
  return !!err && (TRANSIENT.has(err.name ?? "") || TRANSIENT.has(err.inner?.name ?? ""));
};

/** How long one IndexedDB operation may take before the connection is considered stuck. */
const STUCK_MS = 8000;

class TimeoutError extends Error {
  name = "TimeoutError";
}
const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(`IndexedDB did not answer in ${ms} ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

/**
 * Run an IndexedDB operation again when the browser aborts it on its own
 * ("The transaction was aborted, so the request cannot be fulfilled" on
 * Android after the app was in the background) or when it never answers:
 * after the app resumes, Chrome on Android sometimes leaves the connection
 * dead and every request hangs. A hung attempt closes the connection so the
 * next one reopens it. Reads are idempotent and an aborted write wrote
 * nothing, so a retry is safe. Other errors rethrow.
 */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      if (i > 0 && !db.isOpen()) await withTimeout(db.open(), STUCK_MS);
      return await withTimeout(fn(), STUCK_MS * (i + 1));
    } catch (e) {
      last = e;
      const stuck = (e as { name?: string })?.name === "TimeoutError";
      if (!(isTransient(e) || stuck) || i === tries - 1) throw e;
      if (stuck) {
        try {
          db.close();
        } catch {
          // Already closed — the next attempt reopens it.
        }
      }
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw last;
}

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
