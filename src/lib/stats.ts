import { db } from "./db";

const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Consecutive days with at least one review, counting back from today/yesterday. */
export async function streak(): Promise<number> {
  const days = new Set((await db.reviews.toArray()).map((r) => dayKey(r.ts)));
  if (days.size === 0) return 0;
  let n = 0;
  const cursor = new Date();
  // Today may not have reviews yet — start from yesterday if so.
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor.getTime()))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

export async function todayCount(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return db.reviews.where("ts").aboveOrEqual(start.getTime()).count();
}
