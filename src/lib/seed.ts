import { allItems, packIndexOf } from "./content";
import { builderTasks, harmonyTasks, taskPackIndex } from "./builder";
import { db } from "./db";
import { dictationItems } from "./dictation";
import { unlockedCount } from "./progress";
import { AUDIO_ENABLED } from "./config";
import { ensureCards } from "./scheduler";

let seeding: Promise<void> | null = null;

/**
 * Make sure every exercise has a card for every item of every OPEN pack
 * (idempotent; see progress.ts for gating). Called from Home and before
 * each exercise loads its queue, so opening an exercise directly (first
 * launch, after a reset, a new pack) still works. Shared per page load;
 * pass `force` after a Boss opens a new pack. A failed run is retried.
 */
export function seedCards(force = false): Promise<void> {
  if (force) seeding = null;
  seeding ??= (async () => {
    const open = await unlockedCount();
    const inOpen = (id: string) => packIndexOf(id) < open;
    const ids = allItems.filter((i) => inOpen(i.id)).map((i) => i.id);
    await ensureCards("recognize", ids);
    await ensureCards("recall", ids);
    await migrateHarmony();
    await ensureCards("harmony", harmonyTasks.filter((t) => taskPackIndex(t) < open).map((t) => t.id));
    await ensureCards("builder", builderTasks.filter((t) => taskPackIndex(t) < open).map((t) => t.id));
    if (AUDIO_ENABLED) await ensureCards("dictation", dictationItems.filter((i) => inOpen(i.id)).map((i) => i.id));
  })().catch((e) => {
    seeding = null;
    throw e;
  });
  return seeding;
}

/**
 * v0.5: Harmony cards used to be one per stem (`harmony:<itemId>`, random
 * suffix each time); now one per curated (stem, suffix) task. Carry the old
 * card's FSRS state over to every task of that stem so known words don't
 * start from zero, then drop the old card (the review log keeps its rows).
 */
async function migrateHarmony() {
  const old = (await db.cards.where("exercise").equals("harmony").toArray()).filter((c) => !c.itemId.includes("+"));
  if (!old.length) return;
  const byStem = new Map<string, typeof harmonyTasks>();
  for (const t of harmonyTasks) byStem.set(t.stem.id, [...(byStem.get(t.stem.id) ?? []), t]);
  await db.transaction("rw", db.cards, async () => {
    for (const c of old) {
      for (const t of byStem.get(c.itemId) ?? []) {
        const key = `harmony:${t.id}`;
        const cur = await db.cards.get(key);
        // state 0 = New: a card seeded before the migration ran carries nothing worth keeping.
        if (!cur || cur.state === 0) await db.cards.put({ ...c, key, itemId: t.id });
      }
      await db.cards.delete(c.key);
    }
  });
}
