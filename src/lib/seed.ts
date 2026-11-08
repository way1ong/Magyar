import { allItems, harmonyStems } from "./content";
import { builderTasks } from "./builder";
import { ensureCards } from "./scheduler";

let seeding: Promise<void> | null = null;

/**
 * Make sure every exercise has a card for every content item (idempotent).
 * Called from Home and before each exercise loads its queue, so opening an
 * exercise directly (first launch, after a reset, a new pack) still works.
 * Shared per page load; a failed run is retried on the next call.
 */
export function seedCards(): Promise<void> {
  seeding ??= (async () => {
    const ids = allItems.map((i) => i.id);
    await ensureCards("recognize", ids);
    await ensureCards("recall", ids);
    await ensureCards("harmony", harmonyStems.map((i) => i.id));
    await ensureCards("builder", builderTasks.map((t) => t.id));
  })().catch((e) => {
    seeding = null;
    throw e;
  });
  return seeding;
}
