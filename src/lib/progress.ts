import { db } from "./db";
import { packIndexOf, packs } from "./content";

/**
 * Pack gating. Pack 1 is always open; pack N+1 opens when the Boss of pack
 * N is passed. Results live in the `meta` table under `boss:<packId>`, so
 * they are part of the progress backup. Cards already seeded are never
 * removed — gating only decides which packs get seeded.
 */
export interface BossResult {
  passed: boolean;
  /** Best score so far, 0..1. */
  best: number;
  attempts: number;
  /** Epoch ms of the last attempt. */
  ts: number;
}

/** Share of correct answers needed to pass. */
export const BOSS_PASS = 0.8;

export const bossKey = (packId: string) => `boss:${packId}`;

export async function bossResults(): Promise<Map<string, BossResult>> {
  const rows = await db.meta.where("k").startsWith("boss:").toArray();
  return new Map(rows.map((r) => [r.k.slice(5), r.v as BossResult]));
}

/** How many packs (from the first) are open for learning: 1..packs.length. */
export async function unlockedCount(results?: Map<string, BossResult>): Promise<number> {
  const res = results ?? (await bossResults());
  let n = 1;
  while (n < packs.length && res.get(packs[n - 1].id)?.passed) n++;
  return n;
}

export async function recordBoss(packId: string, score: number): Promise<BossResult> {
  const key = bossKey(packId);
  const prev = (await db.meta.get(key))?.v as BossResult | undefined;
  const next: BossResult = {
    passed: (prev?.passed ?? false) || score >= BOSS_PASS,
    best: Math.max(prev?.best ?? 0, score),
    attempts: (prev?.attempts ?? 0) + 1,
    ts: Date.now(),
  };
  await db.meta.put({ k: key, v: next });
  return next;
}

/** Per-pack card counts, to show how far a pack is from its Boss. */
export interface PackProgress {
  /** Cards seeded for this pack across all exercises. */
  total: number;
  /** Cards that were answered at least once (FSRS state ≠ New). */
  started: number;
  /** Cards in the Review state — the ones that stuck. */
  known: number;
}

/**
 * Pack a card belongs to: the later pack of its parts. Composite ids are
 * `<stem>+<pattern>` (harmony/builder) or `<verb>+<tense>.<def>` (conj);
 * a part that is not a content id maps to pack 0 and never wins.
 */
export const cardPackIndex = (itemId: string) => Math.max(...itemId.split("+").map(packIndexOf));

export async function packProgress(): Promise<PackProgress[]> {
  const out: PackProgress[] = packs.map(() => ({ total: 0, started: 0, known: 0 }));
  await db.cards.each((c) => {
    const p = out[cardPackIndex(c.itemId)];
    p.total++;
    if (c.state !== 0) p.started++;
    if (c.state === 2) p.known++;
  });
  return out;
}
