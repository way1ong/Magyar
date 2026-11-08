import { builderTasks, shuffle, taskPackIndex, type BuilderTask } from "./builder";
import { conjugate, isConjugable, PERSONS, PRONOUN, PRONOUN_UA, slotsFor, tenseLabel, type Tense } from "./conj";
import { conjTaskById } from "./conjcards";
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
  kind: "recognize" | "recall" | "form" | "conj";
  prompt: string;
  /** Second line under the prompt: the sentence's translation, the verb and the person/tense asked. */
  hint?: string;
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
        hint: `${cloze ? cloze.ua + " · " : ""}${verb.hu} — ${verb.ua} · ${PRONOUN_UA[person]}, ${tenseLabel(tense)}`,
        options: shuffle([answer, ...others]),
        answer,
      };
    }
  }
  return null;
}
export function bossQuestions(pack: ContentPack, size = BOSS_SIZE): BossQuestion[] {
  const items = pack.items.filter((i) => packIndexOf(i.id) === packs.indexOf(pack));
  const forms = shuffle(bossFormTasks(pack));
  const verbs = shuffle(items.filter(isConjugable));
  const nConj = Math.min(Math.round(size * 0.2), verbs.length);
  const nForm = Math.min(Math.round(size * 0.3), forms.length);
  const nWords = Math.min(size - nForm - nConj, items.length);

  const qs: BossQuestion[] = [];
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
