import { allItems, packIndexOf, packs } from "./content";

/**
 * "Речення": rebuild a Hungarian sentence from its shuffled words, given the
 * translation. Tasks come from the packs' curated `sentences` (each with a
 * note on the word order) and from every example sentence and multi-word
 * phrase in the content (3–12 words, no placeholders). The curated order is
 * the neutral one; Hungarian allows others, which the note explains.
 * Card key: `sentence:<id>` — the sentence id, or the item id for examples.
 */
export interface SentenceTask {
  id: string;
  hu: string;
  ua: string;
  /** Words to arrange, in the right order, with the sentence-final mark stripped. */
  words: string[];
  /** ".", "!" or "?" — shown at the end of the answer line. */
  end: string;
  note: string;
  packIndex: number;
}

export const QUESTION_WORDS = new Set(["ki", "kik", "kit", "kinek", "kivel", "kié", "mi", "mik", "mit", "mire", "miről", "hol", "hova", "hová", "honnan", "mikor", "mióta", "meddig", "hogy", "hogyan", "miért", "mennyi", "mennyibe", "hány", "hányadik", "hánykor", "melyik", "milyen", "merre"]);
const PREFIXES = new Set(["el", "meg", "ki", "be", "fel", "föl", "le", "át", "haza", "vissza", "össze", "oda", "ide", "rá", "szét", "tovább", "végig", "körül", "előre", "hátra", "alá", "elő", "túl"]);
const FOG = /\b(fogok|fogsz|fog|fogunk|fogtok|fognak|fogom|fogod|fogja|fogjuk|fogjátok|fogják)\b/;

/** A note for sentences that have none: the most visible word-order rule in them. */
export function autoNote(hu: string): string {
  const low = hu.toLowerCase();
  const words = low.replace(/[.!?…,;:()]/g, " ").split(/\s+/).filter(Boolean);
  if (/\bhogy\b/.test(low) && words[0] !== "hogy") return "Підрядне з hogy: перед hogy кома, після нього звичайний порядок слів.";
  if (/\bha\b/.test(low) || /\bmert\b/.test(low) || /\bamikor\b/.test(low)) return "Складне речення: сполучник (ha, mert, amikor) відкриває підрядне, між частинами кома.";
  if (FOG.test(low)) return "Майбутнє з fog: відокремлений префікс перед fog, інфінітив після (el fogok menni).";
  if (QUESTION_WORDS.has(words[0])) return "Питальне слово стоїть просто перед дієсловом; підмет — після дієслова.";
  if (/\bnem\b|\bnincs\b|\bne\b/.test(low)) return "Заперечення: nem (ne, nincs) стоїть просто перед тим, що заперечує — зазвичай перед дієсловом.";
  if (hu.trim().endsWith("!")) return "Наказ: дієслово на початку, відокремлений префікс після нього (nézd meg), обʼєкт далі.";
  if (words.some((w, i) => i > 0 && PREFIXES.has(w))) return "Відокремлений префікс після дієслова: перед дієсловом стоїть щось у фокусі.";
  if (hu.trim().endsWith("?")) return "Питання без питального слова: порядок як у твердженні, різниця лише в інтонації.";
  return "Нейтральний порядок: тема, потім те, що просто перед дієсловом (фокус), дієслово, решта.";
}

/** Words that stay capitalised when shuffled: seen capitalised mid-sentence somewhere in the content. */
const properNouns = new Set<string>(["Ön", "Önök", "Önt", "Önnek", "Önnel"]);
const sources: { id: string; hu: string; ua: string; note?: string }[] = [];
for (const p of packs) {
  for (const sn of p.sentences ?? []) sources.push(sn);
}
for (const it of allItems) {
  if (it.example?.hu && it.example.ua) sources.push({ id: it.id, hu: it.example.hu, ua: it.example.ua });
  else if (it.type === "phrase") sources.push({ id: it.id, hu: it.hu, ua: it.ua });
}
for (const s of sources) {
  const ws = s.hu.split(/\s+/);
  ws.forEach((w, i) => {
    const bare = w.replace(/[.!?…,;:()"]/g, "");
    // Capitalised after another word that does not end a clause, and not a question word (Milyen after "Kérdés:").
    if (i > 0 && /^[A-ZÁÉÍÓÖŐÚÜŰ]/.test(bare) && !/[.!?:]$/.test(ws[i - 1]) && !QUESTION_WORDS.has(bare.toLowerCase())) properNouns.add(bare);
  });
}

function toTask(src: { id: string; hu: string; ua: string; note?: string }): SentenceTask | null {
  const hu = src.hu.trim();
  if (/[…_/]/.test(hu) || /\.\.\./.test(hu)) return null;
  const m = hu.match(/^(.*?)([.!?]+)$/);
  const body = (m ? m[1] : hu).trim();
  const end = m ? m[2] : "";
  const words = body.split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 12) return null;
  // The first word loses its capital unless it is a proper noun, so it does not give its place away.
  const first = words[0];
  if (!properNouns.has(first.replace(/[,;:]/g, "")) && !/^[A-ZÁÉÍÓÖŐÚÜŰ]{2}/.test(first)) words[0] = first[0].toLowerCase() + first.slice(1);
  return { id: src.id, hu, ua: src.ua, words, end, note: src.note ?? autoNote(hu), packIndex: packIndexOf(src.id) };
}

const seen = new Set<string>();
const tasks = new Map<string, SentenceTask>();
for (const s of sources) {
  const t = toTask(s);
  if (!t) continue;
  const key = t.hu.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  tasks.set(t.id, t);
}

export const sentenceTasks: SentenceTask[] = [...tasks.values()];
export const sentenceTaskById = (id: string) => tasks.get(id);

/** Case-insensitive comparison of the learner's order with the sentence. */
export const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((w, i) => w.toLowerCase() === b[i].toLowerCase());
