import { useSyncExternalStore } from "react";

/**
 * Background write queue. Exercises record an answer here and move on at
 * once; the write runs after the previous one (answer() already retries
 * stuck or aborted transactions). If a write still fails, the error is kept
 * so a banner can show it — the person should not wait on IndexedDB.
 */
let chain: Promise<unknown> = Promise.resolve();
let error: string | null = null;
let pending = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function queueWrite(fn: () => Promise<unknown>): Promise<void> {
  pending++;
  emit();
  const run = chain.then(fn).then(
    () => {
      if (error) error = null;
    },
    (e) => {
      error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    },
  );
  chain = run.finally(() => {
    pending--;
    emit();
  });
  return chain as Promise<void>;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => (error ? `error:${error}` : pending ? `pending:${pending}` : "");
const server = () => "";

/** "" when idle, "pending:N" while writes are in flight, "error:<text>" after a failed write. */
export const useWriteState = () => useSyncExternalStore(subscribe, snapshot, server);
