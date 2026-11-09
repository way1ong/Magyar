import { db, withRetry } from "./db";

/**
 * Plan of the day: one pass through every exercise, in order. Progress is
 * kept in meta under `day:<YYYY-MM-DD>` as the list of finished steps, so
 * the home screen can tick them off and SessionDone can point to the next.
 */
export type DayStep = "review" | "harmony" | "builder" | "conj" | "sentence";

export const DAY_PLAN: { step: DayStep; href: string; label: string; icon: string }[] = [
  { step: "review", href: "/review", label: "Картки", icon: "🃏" },
  { step: "harmony", href: "/harmony", label: "Гармонія голосних", icon: "🎵" },
  { step: "builder", href: "/builder", label: "Конструктор", icon: "🧩" },
  { step: "conj", href: "/conj", label: "Дієвідміна", icon: "🔤" },
  { step: "sentence", href: "/sentences", label: "Речення", icon: "📝" },
];

const dayKey = () => {
  const d = new Date();
  return `day:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export async function dayDone(): Promise<DayStep[]> {
  const v = (await withRetry(() => db.meta.get(dayKey())))?.v;
  return Array.isArray(v) ? (v as DayStep[]) : [];
}

export async function markDayStep(step: DayStep): Promise<DayStep[]> {
  const done = await dayDone();
  if (done.includes(step)) return done;
  const next = [...done, step];
  await withRetry(() => db.meta.put({ k: dayKey(), v: next }));
  return next;
}

/** The first step not finished today, or null when the plan is complete. */
export const nextDayStep = (done: DayStep[]) => DAY_PLAN.find((s) => !done.includes(s.step)) ?? null;
