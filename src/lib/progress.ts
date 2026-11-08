import { db } from "./db";
import { packs } from "./content";

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
