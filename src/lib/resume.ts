import { useEffect, useState } from "react";
import { withRetry } from "./db";

/**
 * Unfinished series. Every exercise keeps its running queue (card keys, in
 * order), the position and the score in localStorage, per page. When the
 * page is left mid-series and opened again within RESUME_HOURS, it offers
 * to continue from the same card or to start a new series. Answers are
 * written to the progress database as they are given, so nothing is lost
 * either way; this only restores the series itself. localStorage is a
 * per-device convenience here: when it is unavailable, the page simply
 * starts a new series as before.
 */
export interface SavedSeries<S = unknown> {
  keys: string[];
  /** The next card to show: answered cards are behind it. */
  index: number;
  score: S;
  /** The series was a rerun of recent mistakes (does not tick the day plan). */
  mistakes: boolean;
  ts: number;
}

export const RESUME_HOURS = 12;
const storageKey = (page: string) => `magyar:series:${page}`;

export function saveSeries<S>(page: string, s: Omit<SavedSeries<S>, "ts">) {
  try {
    localStorage.setItem(storageKey(page), JSON.stringify({ ...s, ts: Date.now() }));
  } catch {
    // No storage: the series just cannot be resumed.
  }
}

export function clearSeries(page: string) {
  try {
    localStorage.removeItem(storageKey(page));
  } catch {
    // ignore
  }
}

/** The saved series when it is worth offering: started (≥ 1 card done), unfinished and recent. */
export function peekSeries<S>(page: string): SavedSeries<S> | null {
  try {
    const raw = localStorage.getItem(storageKey(page));
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedSeries<S>;
    const ok =
      Array.isArray(s.keys) &&
      typeof s.index === "number" &&
      s.index > 0 &&
      s.index < s.keys.length &&
      typeof s.ts === "number" &&
      Date.now() - s.ts < RESUME_HOURS * 3600000;
    return ok ? s : null;
  } catch {
    return null;
  }
}

/**
 * Rows of a saved series in their order, read fresh from the database (their
 * FSRS state may have moved), with cards that no longer exist or no longer
 * have content dropped; `index` is shifted accordingly. Null when nothing is left.
 */
export async function restoreSeries<R extends { key: string }>(
  saved: SavedSeries,
  get: (keys: string[]) => Promise<(R | undefined)[]>,
  keep: (row: R) => boolean,
): Promise<{ rows: R[]; index: number } | null> {
  const got = await withRetry(() => get(saved.keys));
  const rows: R[] = [];
  let index = 0;
  got.forEach((r, n) => {
    if (!r || !keep(r)) return;
    if (n < saved.index) index++;
    rows.push(r);
  });
  return index < rows.length ? { rows, index } : null;
}

/** Score saved by a graded drill. */
export const isScore = (v: unknown): v is { right: number; total: number } =>
  !!v && typeof (v as { right?: unknown }).right === "number" && typeof (v as { total?: unknown }).total === "number";

/**
 * On the first render: the page's unfinished series, or null. `undefined`
 * while checking. A rerun requested from the Mistakes page wins over a saved
 * series. When there is nothing to offer, `startFresh` runs at once.
 */
export function useResumeOffer<S>(page: string | null, mistakesRequested: () => boolean, startFresh: () => void) {
  const [offer, setOffer] = useState<SavedSeries<S> | null | undefined>(undefined);
  useEffect(() => {
    if (!page) return;
    const s = mistakesRequested() ? null : peekSeries<S>(page);
    setOffer(s);
    if (!s) startFresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page
  }, [page]);
  return [offer, setOffer] as const;
}

/**
 * Keeps the saved series in step with the page: the next card to show (the
 * one after the current card once it is answered), the score and the mode.
 * A finished series is forgotten.
 */
export function useRememberSeries<S>(page: string | null, queue: { key: string }[] | null, i: number, answered: boolean, score: S, mistakes: boolean) {
  useEffect(() => {
    if (!page || !queue) return;
    if (i >= queue.length) {
      clearSeries(page);
      return;
    }
    saveSeries(page, { keys: queue.map((c) => c.key), index: answered ? i + 1 : i, score, mistakes });
  }, [page, queue, i, answered, score, mistakes]);
}
