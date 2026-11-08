import { allItems } from "./content";
import { conjugate, PERSONS, type Person } from "./conj";
import type { ConjTask } from "./conjcards";

/**
 * Real sentences for the conjugation drill: a verb form found in an example
 * or phrase of the content becomes a gap — "Kijevben ___." (én, минулий) →
 * születtem. The verb's own example is tried first, then every sentence.
 * Forms shorter than three letters or equal to a non-verb word (vár, fél)
 * are skipped, and a form shared by the present and the imperative
 * (várjuk) counts as imperative only in a sentence ending in "!".
 * Computed lazily per task and cached — a scan is ~6 persons × 900 sentences.
 */
export interface Cloze {
  /** Sentence with the form replaced by ___ . */
  hu: string;
  /** Its translation. */
  ua: string;
  /** The original sentence. */
  full: string;
  person: Person;
  form: string;
}

interface Sentence {
  hu: string;
  ua: string;
  owner: string;
  /** Lower-cased text for a cheap substring check before the regex. */
  low: string;
}

let sentences: Sentence[] | null = null;
let nonVerbs: Set<string> | null = null;

function corpus(): Sentence[] {
  if (sentences) return sentences;
  sentences = [];
  for (const it of allItems) {
    if (it.example?.hu && it.example.ua) sentences.push({ hu: it.example.hu, ua: it.example.ua, owner: it.id, low: it.example.hu.toLowerCase() });
    if (it.type === "phrase" && /\s/.test(it.hu)) sentences.push({ hu: it.hu, ua: it.ua, owner: it.id, low: it.hu.toLowerCase() });
  }
  return sentences;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const formRe = (form: string) => new RegExp(`(^|[^\\p{L}])(${escapeRe(form).replace(/ /g, "\\s+")})(?=[^\\p{L}]|$)`, "iu");

const cache = new Map<string, Cloze[]>();

/** Every sentence/person pair that fits the task; the verb's own example first. */
export function clozesFor(task: ConjTask): Cloze[] {
  const hit = cache.get(task.id);
  if (hit) return hit;
  nonVerbs ??= new Set(allItems.filter((i) => i.type === "word" && i.pos !== "verb").map((i) => i.hu.toLowerCase()));
  const out: Cloze[] = [];
  const { item, tense, def } = task;
  for (const person of PERSONS) {
    const form = conjugate(item, { tense, def, person });
    if (!form || form.length < 3 || nonVerbs.has(form.toLowerCase())) continue;
    const twin = tense === "pres" ? "imp" : tense === "imp" ? "pres" : null;
    const ambiguous = twin ? conjugate(item, { tense: twin, def, person }) === form : false;
    const low = form.toLowerCase().split(" ")[0];
    const re = formRe(form);
    const all = corpus();
    const own = all.filter((s) => s.owner === item.id);
    const rest = all.filter((s) => s.owner !== item.id);
    for (const s of [...own, ...rest]) {
      if (!s.low.includes(low)) continue;
      if (ambiguous && (tense === "imp") !== s.hu.trim().endsWith("!")) continue;
      const m = re.exec(s.hu);
      if (!m) continue;
      const start = m.index + m[1].length;
      out.push({ hu: s.hu.slice(0, start) + "___" + s.hu.slice(start + m[2].length), ua: s.ua, full: s.hu, person, form });
      if (out.length >= 6) break;
    }
    if (out.length >= 6) break;
  }
  cache.set(task.id, out);
  return out;
}

/** One cloze at random, or null when no sentence uses the task's forms. */
export function pickCloze(task: ConjTask): Cloze | null {
  const xs = clozesFor(task);
  return xs.length ? xs[Math.floor(Math.random() * xs.length)] : null;
}
