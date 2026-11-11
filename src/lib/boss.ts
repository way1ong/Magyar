import { builderTasks, shuffle, taskPackIndex, type BuilderTask } from "./builder";
import { conjugate, isConjugable, PERSONS, personTenseUa, PRONOUN, slotsFor, type Tense } from "./conj";
import { conjTaskById } from "./conjcards";
import { QUESTION_WORDS, sentenceTasks } from "./sentences";
import { dialogueTasks } from "./dialogues";
import { pickCloze } from "./conjcloze";
import { allPatterns, attaches, packIndexOf, packs } from "./content";
import { apply } from "./harmony";
import type { ContentPack, Harmony, Item } from "./types";

/**
 * Boss: the end-of-pack test. No hints, no replay, no FSRS — a fixed set
 * of multiple-choice questions drawn from one pack:
 *  - recognize: hu → pick the ua meaning
 *  - recall:    ua → pick the hu word
 *  - form:      ua gloss → pick the right suffixed word (Builder without blocks)
 *  - conj:      a sentence with a gap (or "(ő) ___ azt.") → pick the verb form
 */
export interface BossQuestion {
  kind: "recognize" | "recall" | "form" | "conj" | "sentence" | "dialogue";
  prompt: string;
  /** Second line under the prompt: the sentence's translation, the verb and the person/tense asked. */
  hint?: string;
  /** Dialogue lines shown above the question. */
  lines?: { who: string; hu: string }[];
  options: string[];
  answer: string;
}

export const BOSS_SIZE = 20;

const HARMONIES: Harmony[] = ["back", "front", "front_rounded"];

/** Up to `n` distinct distractor strings, preferring the same part of speech. */
function pickDistractors(item: Item, pool: Item[], field: "hu" | "ua", n: number): string[] {
  const same = shuffle(pool.filter((x) => x.id !== item.id && x.pos === item.pos));
  const rest = shuffle(pool.filter((x) => x.id !== item.id && x.pos !== item.pos));
  const out = new Set<string>();
  for (const x of [...same, ...rest]) {
    if (out.size >= n) break;
    if (x[field] !== item[field]) out.add(x[field]);
  }
  return [...out];
}

/** Wrong forms of the same stem: other harmony variants, then other suffixes. */
function formDistractors(t: BuilderTask, n: number): string[] {
  const out = new Set<string>();
  for (const h of shuffle(HARMONIES)) {
    const w = apply(t.stem.hu, t.pattern, h, t.stem.forms);
    if (w !== t.result) out.add(w);
  }
  const others = shuffle(allPatterns.filter((p) => p.id !== t.pattern.id && attaches(p, t.stem)));
  for (const p of others) {
    if (out.size >= n) break;
    const w = apply(t.stem.hu, p, t.stem.harmony, t.stem.forms);
    if (w !== t.result) out.add(w);
  }
  return [...out].slice(0, n);
}

/** Builder tasks that belong to this pack (by the later of stem's and suffix's pack). */
export const bossFormTasks = (pack: ContentPack) => {
  const n = packs.indexOf(pack);
  return builderTasks.filter((t) => taskPackIndex(t) === n);
};

/** Tenses a Boss asks, weighted towards the present and past. */
const BOSS_TENSES: Tense[] = ["pres", "pres", "pres", "past", "past", "fut", "pot", "imp", "cond"];

/** One conjugation question for a verb: a random tense/definiteness it has, a sentence when the content has one. */
export function conjQuestion(verb: Item): BossQuestion | null {
  for (const tense of shuffle(BOSS_TENSES)) {
    const defs = shuffle(slotsFor(verb).filter((s) => s.tense === tense).map((s) => s.def).filter((d, i, a) => a.indexOf(d) === i));
    for (const def of defs) {
      const task = conjTaskById(`${verb.id}+${tense}.${def ? "def" : "indef"}`);
      if (!task) continue;
      const cloze = pickCloze(task);
      const person = cloze?.person ?? shuffle(PERSONS)[0];
      const answer = conjugate(verb, { tense, def, person });
      if (!answer) continue;
      const pool = slotsFor(verb)
        .map((s) => conjugate(verb, s))
        .filter((f) => f && f !== answer);
      const others = shuffle([...new Set(pool)]).slice(0, 3);
      if (others.length < 2) continue;
      const object = def ? " azt" : verb.conj?.tr ? " valamit" : "";
      const mark = tense === "imp" ? "!" : ".";
      return {
        kind: "conj",
        prompt: cloze ? cloze.hu : `(${PRONOUN[person]}) ___${object}${mark}`,
        hint: `${cloze ? cloze.ua + " · " : ""}${verb.hu} — ${verb.ua} · ${personTenseUa(person, tense)}`,
        options: shuffle([answer, ...others]),
        answer,
      };
    }
  }
  return null;
}
const ARTICLES = new Set(["a", "az", "egy"]);
/**
 * Hungarian word order is flexible, so a random permutation may still be
 * grammatical. A distractor is used only when it is clearly broken: an
 * article not followed by its word, nem / ne at the very end, or a question
 * word away from the front.
 */
function clearlyWrong(ws: string[]): boolean {
  const low = ws.map((w) => w.toLowerCase());
  for (let i = 0; i < low.length; i++) if (ARTICLES.has(low[i]) && (i === low.length - 1 || ARTICLES.has(low[i + 1]))) return true;
  const last = low[low.length - 1];
  if (last === "nem" || last === "ne") return true;
  if (low.some((w, i) => i > 0 && QUESTION_WORDS.has(w)) && !QUESTION_WORDS.has(low[0])) return true;
  return false;
}

/** Word order: the translation, options are the right order and clearly broken orders of the same words. */
export function sentenceQuestion(packIndex: number): BossQuestion | null {
  const pool = shuffle(sentenceTasks.filter((t) => t.packIndex === packIndex && t.words.length >= 4 && t.words.length <= 8 && !t.hu.includes(",")));
  for (const t of pool) {
    const correct = t.hu;
    const join = (ws: string[]) => ws.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(" ") + t.end;
    const others = new Set<string>();
    for (let k = 0; k < 60 && others.size < 3; k++) {
      const ws = shuffle(t.words);
      const s = join(ws);
      if (s.toLowerCase() !== correct.toLowerCase() && clearlyWrong(ws)) others.add(s);
    }
    if (others.size < 2) continue;
    return { kind: "sentence", prompt: t.ua, hint: "Який порядок слів правильний?", options: shuffle([correct, ...others]), answer: correct };
  }
  return null;
}

/** The comprehension question of one of the pack's dialogues. */
export function dialogueQuestion(packIndex: number, skip: Set<string>): BossQuestion | null {
  const pool = shuffle(dialogueTasks.filter((t) => t.packIndex === packIndex && !skip.has(t.id)));
  const t = pool[0];
  if (!t) return null;
  skip.add(t.id);
  const q = t.dialogue.question;
  return { kind: "dialogue", prompt: q.q, lines: t.dialogue.lines.map((l) => ({ who: l.who, hu: l.hu })), options: shuffle(q.options), answer: q.options[q.answer] };
}

export function bossQuestions(pack: ContentPack, size = BOSS_SIZE): BossQuestion[] {
  const n = packs.indexOf(pack);
  const items = pack.items.filter((i) => packIndexOf(i.id) === n);
  const forms = shuffle(bossFormTasks(pack));
  const verbs = shuffle(items.filter(isConjugable));
  const qs: BossQuestion[] = [];
  // 2 word-order + 2 dialogue questions when the pack has them, 3 conjugation, 5 suffix forms, the rest words.
  const used = new Set<string>();
  for (let k = 0; k < 2; k++) {
    const q = dialogueQuestion(n, used);
    if (q) qs.push(q);
  }
  const seenS = new Set<string>();
  for (let k = 0; k < 2; k++) {
    const q = sentenceQuestion(n);
    if (q && !seenS.has(q.answer)) {
      seenS.add(q.answer);
      qs.push(q);
    }
  }
  const nConj = Math.min(3, verbs.length);
  const nForm = Math.min(5, forms.length);
  const nWords = Math.min(size - qs.length - nForm - nConj, items.length);
  for (const v of verbs.slice(0, nConj)) {
    const q = conjQuestion(v);
    if (q) qs.push(q);
  }
  for (const t of forms.slice(0, nForm)) {
    const ds = formDistractors(t, 3);
    if (ds.length < 2) continue;
    qs.push({ kind: "form", prompt: t.ua, options: shuffle([t.result, ...ds]), answer: t.result });
  }
  shuffle(items)
    .slice(0, nWords)
    .forEach((it, k) => {
      const kind = k % 2 === 0 ? "recognize" : "recall";
      const field = kind === "recognize" ? "ua" : "hu";
      const ds = pickDistractors(it, items, field, 3);
      if (ds.length < 2) return;
      qs.push({ kind, prompt: kind === "recognize" ? it.hu : it.ua, options: shuffle([it[field], ...ds]), answer: it[field] });
    });
  return shuffle(qs);
}
