import { allItems, harmonyStems, packIndexOf } from "./content";
import { builderTasks, taskPackIndex } from "./builder";
import { dictationItems } from "./dictation";
import { unlockedCount } from "./progress";
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
    await ensureCards("harmony", harmonyStems.filter((i) => inOpen(i.id)).map((i) => i.id));
    await ensureCards("builder", builderTasks.filter((t) => taskPackIndex(t) < open).map((t) => t.id));
    await ensureCards("dictation", dictationItems.filter((i) => inOpen(i.id)).map((i) => i.id));
  })().catch((e) => {
    seeding = null;
    throw e;
  });
  return seeding;
}
