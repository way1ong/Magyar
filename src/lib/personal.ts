import { createEmptyCard, type Grade } from "ts-fsrs";
import { db, fromRow, toRow, withRetry, type PCardRow, type PExercise } from "./db";
import { Rating, scheduler } from "./scheduler";
import { autoNote } from "./sentences";
import { getGating } from "./settings";
import metal from "@content/personal/metal-detecting.json";
import fire from "@content/personal/fire-safety.json";

/**
 * Personal topics ("Персональні"): small self-contained vocabularies for the
 * learner's own interests, separate from the levelled course. A topic is one
 * JSON file in /content/personal with words (level 1), phrases (level 2) and
 * dialogues + reading texts (level 3). Progress lives in db.pcards/db.previews
 * with the same FSRS scheduler; the main course never counts it.
 *
 * Levels open in order, like readiness in the course: phrases once half of
 * the words have been seen in the cards, dialogues and texts once half of the
 * phrases have. The "усе одразу" gating setting switches this off.
 */
export interface PTheme {
  id: string;
  title: string;
}
export interface PItem {
  id: string;
  hu: string;
  ua: string;
  example?: { hu: string; ua: string };
  theme: string;
  /** 1 = word, 2 = phrase / sentence-length expression. */
  level: 1 | 2;
  pos?: string;
  /** Term the author was not sure about — shown with ⚠ until checked with a native source. */
  check?: boolean;
  note?: string;
  /** The line this phrase answers or follows (see Item.ctx). */
  ctx?: { hu: string; ua: string };
  /** Other correct Hungarian answers (see Item.alt). */
  alt?: string[];
}
export interface PDialogue {
  id: string;
  title: string;
  level: 3;
  lines: { who: string; hu: string; ua: string }[];
  question: { q: string; options: string[]; answer: number };
  check?: boolean;
}
export interface PText {
  id: string;
  title: string;
  level: 3;
  hu: string;
  ua: string;
  questions: { q: string; options: string[]; answer: number }[];
  check?: boolean;
}
export interface PTopic {
  id: string;
  icon: string;
  title: string;
  titleHu: string;
  intro: string;
  themes: PTheme[];
  items: PItem[];
  dialogues: PDialogue[];
  texts: PText[];
}

export const topics: PTopic[] = [metal as PTopic, fire as PTopic];
export const topicById = (id: string) => topics.find((t) => t.id === id);

const owner = new Map<string, PTopic>();
const items = new Map<string, PItem>();
const dialogues = new Map<string, PDialogue>();
const texts = new Map<string, PText>();
for (const t of topics) {
  for (const it of t.items) {
    owner.set(it.id, t);
    items.set(it.id, it);
  }
  for (const d of t.dialogues) {
    owner.set(d.id, t);
    dialogues.set(d.id, d);
  }
  for (const x of t.texts) {
    owner.set(x.id, t);
    texts.set(x.id, x);
  }
}
export const pItemById = (id: string) => items.get(id);
export const pDialogueById = (id: string) => dialogues.get(id);
export const pTextById = (id: string) => texts.get(id);
export const topicOf = (itemId: string) => owner.get(itemId);

/** Which level a card's item belongs to: items by their level, sentences 2, dialogues/texts 3. */
export function levelOf(exercise: PExercise, itemId: string): 1 | 2 | 3 {
  if (exercise === "dialogue" || exercise === "text") return 3;
  if (exercise === "sentence") return 2;
  return items.get(itemId)?.level ?? 1;
}

export const PLEVEL_TITLES: Record<1 | 2 | 3, string> = { 1: "Слова", 2: "Фрази й речення", 3: "Діалоги й тексти" };

/* ---------- current topic / level (survive navigation in both builds) ---------- */

const TOPIC_KEY = "magyar:ptopic";
const LEVEL_KEY = "magyar:plevel";
const MODE_KEY = "magyar:pmode";

export function setCurrentTopic(id: string) {
  try {
    localStorage.setItem(TOPIC_KEY, id);
  } catch {
    // No storage: the topic page falls back to the first topic.
  }
}
export function currentTopic(): PTopic | undefined {
  try {
    return topicById(localStorage.getItem(TOPIC_KEY) ?? "") ?? topics[0];
  } catch {
    return topics[0];
  }
}
/** Cards/quiz pages practise one level at a time; the topic page sets it before navigating. */
export function setLevel(level: 1 | 2) {
  try {
    sessionStorage.setItem(LEVEL_KEY, String(level));
  } catch {
    // ignore
  }
}
export function takeLevel(): 1 | 2 {
  try {
    const v = sessionStorage.getItem(LEVEL_KEY);
    return v === "2" ? 2 : 1;
  } catch {
    return 1;
  }
}
export function requestPMistakes(page: string) {
  try {
    sessionStorage.setItem(MODE_KEY, `mistakes:${page}`);
  } catch {
    // ignore
  }
}
export function pMistakesRequested(page: string): boolean {
  try {
    return sessionStorage.getItem(MODE_KEY) === `mistakes:${page}`;
  } catch {
    return false;
  }
}
export function takePMistakes(page: string): boolean {
  try {
    const v = sessionStorage.getItem(MODE_KEY);
    if (v !== `mistakes:${page}`) return false;
    sessionStorage.removeItem(MODE_KEY);
    return true;
  } catch {
    return false;
  }
}

/* ---------- sentence tasks (from examples and multi-word phrases) ---------- */

export interface PSentenceTask {
  id: string;
  hu: string;
  ua: string;
  words: string[];
  end: string;
  note: string;
}

const PROPER = /^[A-ZÁÉÍÓÖŐÚÜŰ]/;
function toSentence(id: string, src: { hu: string; ua: string }, properNouns: Set<string>): PSentenceTask | null {
  const hu = src.hu.trim();
  if (/[…_/]/.test(hu) || /\.\.\./.test(hu)) return null;
  const m = hu.match(/^(.*?)([.!?]+)$/);
  const body = (m ? m[1] : hu).trim();
  const end = m ? m[2] : "";
  const words = body.split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 12) return null;
  const first = words[0];
  if (!properNouns.has(first.replace(/[,;:]/g, "")) && !/^[A-ZÁÉÍÓÖŐÚÜŰ]{2}/.test(first)) words[0] = first[0].toLowerCase() + first.slice(1);
  return { id, hu, ua: src.ua, words, end, note: autoNote(hu) };
}

const sentenceTasks = new Map<string, PSentenceTask>();
const sentencesByTopic = new Map<string, PSentenceTask[]>();
for (const t of topics) {
  // Words capitalised inside a sentence are proper nouns (Pest, Ferenczy) and keep their capital at the start.
  const proper = new Set<string>(["Ön", "Önök", "Önt", "Önnek", "Önnel"]);
  const texts = [...t.items.flatMap((it) => [it.example?.hu ?? "", it.level === 2 ? it.hu : ""]), ...t.dialogues.flatMap((d) => d.lines.map((l) => l.hu))];
  for (const s of texts) {
    const ws = s.split(/\s+/);
    ws.forEach((w, i) => {
      const bare = w.replace(/[.!?…,;:()"]/g, "");
      if (i > 0 && PROPER.test(bare) && !/[.!?:]$/.test(ws[i - 1])) proper.add(bare);
    });
  }
  const list: PSentenceTask[] = [];
  const seen = new Set<string>();
  for (const it of t.items) {
    const src = it.example ?? (it.level === 2 ? { hu: it.hu, ua: it.ua } : undefined);
    if (!src) continue;
    const task = toSentence(it.id, src, proper);
    if (!task || seen.has(task.hu.toLowerCase())) continue;
    seen.add(task.hu.toLowerCase());
    sentenceTasks.set(it.id, task);
    list.push(task);
  }
  sentencesByTopic.set(t.id, list);
}
export const pSentenceById = (id: string) => sentenceTasks.get(id);
export const pSentencesOf = (topic: PTopic) => sentencesByTopic.get(topic.id) ?? [];
export const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((w, i) => w.toLowerCase() === b[i].toLowerCase());

/* ---------- cards ---------- */

export const pKey = (exercise: PExercise, itemId: string) => `${exercise}:${itemId}`;

async function ensure(exercise: PExercise, ids: string[]) {
  const now = new Date();
  const have = new Set((await db.pcards.where("exercise").equals(exercise).primaryKeys()) as string[]);
  const rows: PCardRow[] = [];
  for (const id of ids) {
    const key = pKey(exercise, id);
    if (!have.has(key)) rows.push({ ...toRow(key, "recognize", id, createEmptyCard(now)), exercise });
  }
  if (!rows.length) return;
  try {
    await withRetry(() => db.pcards.bulkAdd(rows));
  } catch (e) {
    if ((e as { name?: string }).name !== "BulkError") throw e;
  }
}

/** A card for every item (three exercises), every sentence, dialogue and text. Idempotent. */
export async function seedPersonal() {
  const itemIds = [...items.keys()];
  await ensure("recognize", itemIds);
  await ensure("recall", itemIds);
  await ensure("quiz", itemIds);
  await ensure("sentence", [...sentenceTasks.keys()]);
  await ensure("dialogue", [...dialogues.keys()]);
  await ensure("text", [...texts.keys()]);
}

/** Record an answer: update the FSRS card and append to the personal review log. */
export async function pAnswer(row: PCardRow, rating: Grade, took?: number) {
  const now = new Date();
  const { card } = scheduler.next(fromRow(row), now, rating);
  const updated: PCardRow = { ...toRow(row.key, "recognize", row.itemId, card), exercise: row.exercise };
  await withRetry(() =>
    db.transaction("rw", db.pcards, db.previews, async () => {
      await db.pcards.put(updated);
      await db.previews.add({ key: row.key, rating, ts: now.getTime(), took });
    }),
  );
  return updated;
}

/* ---------- progress and level gates ---------- */

export const PLEVEL_SHARE = 0.5;
/** Interval from which a card counts as "міцно", as in the main statistics. */
const STRONG_DAYS = 21;

export interface LevelStats {
  level: 1 | 2 | 3;
  total: number;
  /** Cards (recognize for items; the card itself for dialogues/texts) that have been seen at least once. */
  seen: number;
  inWork: number;
  strong: number;
  open: boolean;
  /** Seen items needed before the level opens (0 when open). */
  need: number;
}
export interface TopicProgress {
  levels: Record<1 | 2 | 3, LevelStats>;
  /** Mistakes of the last week per page. */
  mistakes: Record<string, number>;
  dueTotal: number;
}

const PAGE_EXERCISES: Record<string, PExercise[]> = {
  cards: ["recognize", "recall"],
  quiz: ["quiz"],
  sentences: ["sentence"],
  dialogues: ["dialogue"],
  texts: ["text"],
};
export const MISTAKE_DAYS = 7;

export async function pMistakeKeys(days = MISTAKE_DAYS): Promise<Set<string>> {
  const since = Date.now() - days * 86400000;
  const rows = await withRetry(() => db.previews.where("ts").aboveOrEqual(since).toArray());
  const last = new Map<string, number>();
  for (const r of rows.sort((a, b) => a.ts - b.ts)) last.set(r.key, r.rating);
  return new Set([...last.entries()].filter(([, rating]) => rating === Rating.Again).map(([k]) => k));
}

export async function pMistakeCards(topic: PTopic, exercises: PExercise[], limit = 20): Promise<PCardRow[]> {
  const keys = [...(await pMistakeKeys())].filter((k) => exercises.includes(k.split(":")[0] as PExercise));
  const rows = await withRetry(() => db.pcards.bulkGet(keys));
  return rows.filter((r): r is PCardRow => !!r && topicOf(r.itemId) === topic).slice(0, limit);
}

export async function topicProgress(topic: PTopic): Promise<TopicProgress> {
  const gating = (await getGating()) === "on";
  const rows = (await withRetry(() => db.pcards.toArray())).filter((r) => topicOf(r.itemId) === topic);
  const now = Date.now();
  const mk = (level: 1 | 2 | 3): LevelStats => ({ level, total: 0, seen: 0, inWork: 0, strong: 0, open: true, need: 0 });
  const levels: Record<1 | 2 | 3, LevelStats> = { 1: mk(1), 2: mk(2), 3: mk(3) };
  const l1 = topic.items.filter((it) => it.level === 1);
  const l2 = topic.items.filter((it) => it.level === 2);
  levels[1].total = l1.length;
  levels[2].total = l2.length;
  levels[3].total = topic.dialogues.length + topic.texts.length;
  const byKey = new Map(rows.map((r) => [r.key, r]));
  // An item counts as seen once either direction of its flashcard has been shown.
  const seenItem = (id: string) => (byKey.get(pKey("recognize", id))?.state ?? 0) !== 0 || (byKey.get(pKey("recall", id))?.state ?? 0) !== 0;
  levels[1].seen = l1.filter((it) => seenItem(it.id)).length;
  levels[2].seen = l2.filter((it) => seenItem(it.id)).length;
  levels[3].seen = [...topic.dialogues.map((d) => pKey("dialogue", d.id)), ...topic.texts.map((x) => pKey("text", x.id))].filter((k) => (byKey.get(k)?.state ?? 0) !== 0).length;
  for (const r of rows) {
    const lv = levels[levelOf(r.exercise, r.itemId)];
    if (r.state === 0) continue;
    if (r.state === 2 && r.scheduled_days >= STRONG_DAYS) lv.strong++;
    else lv.inWork++;
  }
  if (gating) {
    const need2 = Math.ceil(levels[1].total * PLEVEL_SHARE) - levels[1].seen;
    levels[2].open = need2 <= 0;
    levels[2].need = Math.max(0, need2);
    const need3 = Math.ceil(levels[2].total * PLEVEL_SHARE) - levels[2].seen;
    levels[3].open = levels[2].open && need3 <= 0;
    levels[3].need = Math.max(0, need3);
  }
  const mk2 = await pMistakeKeys();
  const mistakes: Record<string, number> = {};
  for (const [page, exs] of Object.entries(PAGE_EXERCISES)) mistakes[page] = rows.filter((r) => exs.includes(r.exercise) && mk2.has(r.key)).length;
  return { levels, mistakes, dueTotal: rows.filter((r) => r.state !== 0 && r.due <= now).length };
}

/** Rough per-topic numbers for the hub: items, seen share. */
export async function topicSummary(topic: PTopic) {
  const rows = (await withRetry(() => db.pcards.where("exercise").anyOf("recognize", "recall").toArray())).filter((r) => topicOf(r.itemId) === topic && r.state !== 0);
  const seen = new Set(rows.map((r) => r.itemId)).size;
  return { total: topic.items.length, seen, checks: topic.items.filter((it) => it.check).length + topic.dialogues.filter((d) => d.check).length + topic.texts.filter((x) => x.check).length };
}

/**
 * One session for a topic and exercise: new cards only from open levels
 * (and only the asked level for cards/quiz), due cards oldest first, topped
 * up ahead of schedule so "Ще раз" always has something — as in the course.
 */
export async function pSessionCards(topic: PTopic, exercise: PExercise, opts: { level?: 1 | 2; limit?: number; newLimit?: number; minimum?: number } = {}): Promise<PCardRow[]> {
  const { level, limit = 20, newLimit = 8, minimum = 8 } = opts;
  const prog = await topicProgress(topic);
  const now = Date.now();
  const all = (await withRetry(() => db.pcards.where("exercise").equals(exercise).toArray())).filter((c) => {
    if (topicOf(c.itemId) !== topic) return false;
    const lv = levelOf(exercise, c.itemId);
    if (level && lv !== level && lv !== 3) return false;
    return c.state !== 0 || prog.levels[lv].open;
  });
  const rank = (c: PCardRow) => {
    if (exercise === "sentence") return pSentenceById(c.itemId)?.words.length ?? 99;
    if (exercise === "dialogue") return pDialogueById(c.itemId)?.lines.length ?? 99;
    if (exercise === "text") return pTextById(c.itemId)?.hu.length ?? 9999;
    return 0;
  };
  const byNew = (a: PCardRow, b: PCardRow) => rank(a) - rank(b) || a.due - b.due;
  const due = all.filter((c) => c.due <= now);
  const fresh = due.filter((c) => c.state === 0).sort(byNew).slice(0, newLimit);
  const review = due.filter((c) => c.state !== 0).sort((a, b) => a.due - b.due).slice(0, Math.max(0, limit - fresh.length));
  const q = [...review, ...fresh];
  if (q.length < minimum) {
    const have = new Set(q.map((c) => c.key));
    const ahead = all.filter((c) => !have.has(c.key)).sort((a, b) => Number(a.state === 0) - Number(b.state === 0) || (a.state === 0 ? byNew(a, b) : a.due - b.due));
    q.push(...ahead.slice(0, minimum - q.length));
  }
  return q;
}

/* ---------- deals ---------- */

export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface QuizDeal {
  /** hu → pick the Ukrainian, or ua → pick the Hungarian. */
  dir: "hu" | "ua";
  prompt: string;
  options: string[];
  answer: string;
}

/** Four options: distractors from the same theme first, then the topic, same level when possible. */
export function quizFor(item: PItem, topic: PTopic): QuizDeal {
  const dir: "hu" | "ua" = Math.random() < 0.5 ? "hu" : "ua";
  const field = dir === "hu" ? "ua" : "hu";
  const answer = item[field];
  const pool = topic.items.filter((x) => x.id !== item.id && x[field] !== answer && x.level === item.level);
  const same = shuffle(pool.filter((x) => x.theme === item.theme));
  const rest = shuffle(pool.filter((x) => x.theme !== item.theme));
  const picked: string[] = [];
  for (const x of [...same, ...rest]) {
    if (picked.length === 3) break;
    if (!picked.includes(x[field])) picked.push(x[field]);
  }
  return { dir, prompt: item[dir], options: shuffle([answer, ...picked]), answer };
}

export type PDeal =
  | { kind: "question"; prompt: string; options: string[]; answer: string }
  | { kind: "gap"; line: number; prompt: string; options: string[]; answer: string };

/** A showing of a dialogue: its question (always on the first showing) or a gap with lines of the topic's other dialogues. */
export function pDealFor(d: PDialogue, topic: PTopic, first = false): PDeal {
  const q = d.question;
  if (first || Math.random() < 0.5) return { kind: "question", prompt: q.q, options: shuffle(q.options), answer: q.options[q.answer] };
  const line = 1 + Math.floor(Math.random() * (d.lines.length - 1));
  const answer = d.lines[line].hu;
  const pool = shuffle(topic.dialogues.filter((x) => x.id !== d.id).flatMap((x) => x.lines.map((l) => l.hu))).filter((hu) => hu !== answer && !d.lines.some((l) => l.hu === hu));
  const sameEnd = pool.filter((hu) => hu.endsWith("?") === answer.endsWith("?"));
  const distractors = [...new Set(sameEnd)].slice(0, 3);
  for (const hu of pool) {
    if (distractors.length >= 3) break;
    if (!distractors.includes(hu)) distractors.push(hu);
  }
  return { kind: "gap", line, prompt: "Яка репліка пропущена?", options: shuffle([answer, ...distractors]), answer };
}
