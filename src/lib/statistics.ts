import { db, withRetry, type CardRow, type Exercise } from "./db";
import { allPatterns, itemById, packs, patternById } from "./content";
import { cardPackIndex } from "./progress";
import { Rating } from "./scheduler";

/**
 * Statistics for the Stats page, computed in one pass over the cards and
 * the recent review log: activity calendar and weekly goal, accuracy and
 * knowledge by pack, by suffix and by exercise, and the hardest cards.
 * "Known" = a card in the Review state scheduled ≥ 21 days ahead.
 */
export const WEEKLY_GOAL_KEY = "setting:weeklyGoal";
export const DEFAULT_WEEKLY_GOAL = 150;
const KNOWN_DAYS = 21;
const WINDOW_DAYS = 30;

export interface Bucket {
  id: string;
  label: string;
  total: number;
  started: number;
  known: number;
  /** Reviews in the window. */
  reviews: number;
  /** Share of non-Again answers in the window, 0..1, or null without reviews. */
  accuracy: number | null;
}

export interface Stats {
  /** Reviews per day for the last 12 weeks, oldest first, aligned to a Monday. */
  calendar: { date: string; count: number }[];
  weekReviews: number;
  weeklyGoal: number;
  totalReviews: number;
  byPack: Bucket[];
  byPattern: Bucket[];
  byExercise: Bucket[];
  hardest: { key: string; exercise: Exercise; itemId: string; label: string; lapses: number }[];
}

const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const EXERCISE_LABEL: Record<Exercise, string> = {
  recognize: "Картки HU→UA",
  recall: "Картки UA→HU",
  harmony: "Гармонія",
  builder: "Конструктор",
  conj: "Дієвідміна",
  sentence: "Речення",
  dictation: "Диктант",
};

const bucket = (id: string, label: string): Bucket => ({ id, label, total: 0, started: 0, known: 0, reviews: 0, accuracy: null });
const addCard = (b: Bucket, c: CardRow) => {
  b.total++;
  if (c.state !== 0) b.started++;
  if (c.state === 2 && c.scheduled_days >= KNOWN_DAYS) b.known++;
};

/** Pattern id of a harmony/builder card (`stem+pattern`), else null. */
const patternOf = (c: CardRow) => {
  if (c.exercise !== "harmony" && c.exercise !== "builder") return null;
  const p = c.itemId.split("+")[1];
  return p && patternById(p) ? p : null;
};

/** Human label of a card for the hardest list. */
export function cardLabel(c: CardRow): string {
  const [stemId] = c.itemId.split("+");
  const item = itemById(stemId);
  if (!item) return c.itemId;
  if (c.exercise === "harmony" || c.exercise === "builder") {
    const p = patternById(c.itemId.split("+")[1]);
    return `${item.hu} + ${p?.name.split(" (")[0] ?? ""}`;
  }
  if (c.exercise === "conj") return `${item.hu} (${c.itemId.split("+")[1]})`;
  return `${item.hu} — ${item.ua}`;
}

export async function getWeeklyGoal(): Promise<number> {
  const v = (await withRetry(() => db.meta.get(WEEKLY_GOAL_KEY)))?.v;
  return typeof v === "number" && v > 0 ? v : DEFAULT_WEEKLY_GOAL;
}
export const setWeeklyGoal = (n: number) => withRetry(() => db.meta.put({ k: WEEKLY_GOAL_KEY, v: n }));

export async function computeStats(): Promise<Stats> {
  const now = Date.now();
  const since = now - WINDOW_DAYS * 86400000;
  const cards = await withRetry(() => db.cards.toArray());
  const recent = await withRetry(() => db.reviews.where("ts").aboveOrEqual(since).toArray());
  const totalReviews = await withRetry(() => db.reviews.count());
  const weeklyGoal = await getWeeklyGoal();

  // Calendar: up to 12 weeks ending today, but not before the week of the
  // first review (at least 4 weeks), starting on a Monday.
  const first = await withRetry(() => db.reviews.orderBy("ts").first());
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 83);
  if (first) {
    const earliest = new Date(first.ts);
    earliest.setHours(0, 0, 0, 0);
    earliest.setDate(earliest.getDate() - 21);
    if (earliest.getTime() > start.getTime()) start.setTime(earliest.getTime());
  }
  while (start.getDay() !== 1) start.setDate(start.getDate() - 1);
  const calSince = start.getTime();
  const calRows = await withRetry(() => db.reviews.where("ts").aboveOrEqual(calSince).toArray());
  const perDay = new Map<string, number>();
  for (const r of calRows) perDay.set(dayKey(r.ts), (perDay.get(dayKey(r.ts)) ?? 0) + 1);
  const calendar: Stats["calendar"] = [];
  for (let d = new Date(start); d.getTime() <= now; d.setDate(d.getDate() + 1)) calendar.push({ date: dayKey(d.getTime()), count: perDay.get(dayKey(d.getTime())) ?? 0 });
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekReviews = calRows.filter((r) => r.ts >= monday.getTime()).length;

  // Buckets.
  const byPack = packs.map((p) => bucket(p.id, `${p.id} — ${p.title}`));
  const byPattern = new Map(allPatterns.map((p) => [p.id, bucket(p.id, p.name.split(" (")[0])]));
  const byExercise = new Map<string, Bucket>();
  const cardByKey = new Map<string, CardRow>();
  for (const c of cards) {
    cardByKey.set(c.key, c);
    addCard(byPack[cardPackIndex(c.itemId)], c);
    const pid = patternOf(c);
    if (pid) addCard(byPattern.get(pid)!, c);
    if (!byExercise.has(c.exercise)) byExercise.set(c.exercise, bucket(c.exercise, EXERCISE_LABEL[c.exercise] ?? c.exercise));
    addCard(byExercise.get(c.exercise)!, c);
  }
  const hits = new Map<Bucket, [number, number]>();
  const tally = (b: Bucket | undefined, ok: boolean) => {
    if (!b) return;
    const h = hits.get(b) ?? [0, 0];
    h[0] += ok ? 1 : 0;
    h[1]++;
    hits.set(b, h);
  };
  for (const r of recent) {
    const c = cardByKey.get(r.key);
    if (!c) continue;
    const ok = r.rating !== Rating.Again;
    tally(byPack[cardPackIndex(c.itemId)], ok);
    const pid = patternOf(c);
    if (pid) tally(byPattern.get(pid), ok);
    tally(byExercise.get(c.exercise), ok);
  }
  for (const [b, [ok, n]] of hits) {
    b.reviews = n;
    b.accuracy = n ? ok / n : null;
  }

  const hardest = cards
    .filter((c) => c.lapses > 0)
    .sort((a, b) => b.lapses - a.lapses || a.due - b.due)
    .slice(0, 10)
    .map((c) => ({ key: c.key, exercise: c.exercise, itemId: c.itemId, label: cardLabel(c), lapses: c.lapses }));

  return {
    calendar,
    weekReviews,
    weeklyGoal,
    totalReviews,
    byPack: byPack.filter((b) => b.total > 0),
    byPattern: [...byPattern.values()].filter((b) => b.total > 0),
    byExercise: [...byExercise.values()],
    hardest,
  };
}
