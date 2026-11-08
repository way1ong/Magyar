import { roleOf } from "./content";
import type { Frame, Item, Pattern } from "./types";

/**
 * Context sentence for a (pattern, stem) pair: "A ___ vagyok." → "A házban vagyok."
 * Picked by the stem's role (nouns) or part of speech, "*" as a fallback.
 */
export function frameFor(p: Pattern, stem: Item): Frame | undefined {
  const f = p.frames;
  if (!f) return undefined;
  // A tag-specific frame wins (transport: "___ megyek."), then the role / part of speech.
  for (const t of stem.tags ?? []) if (f[t]) return f[t];
  const key = stem.pos === "noun" ? roleOf(stem) : stem.pos;
  return f[key] ?? f["*"];
}

const VOWELS = /^[aáeéiíoóöőuúüű]/i;

/**
 * Put a word into a frame: "a ___" becomes "az ___" before a vowel (az
 * asztalon), a word at the start of the sentence is capitalised.
 */
export function fillFrame(text: string, word: string): string {
  const w = text.startsWith("___") ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  const art = VOWELS.test(word) ? "$1z ___" : "$1 ___";
  return text.replace(/\b([Aa]) ___/g, art).replace("___", w);
}

/** The same, but split around the gap so the UI can style the word: ["A ", "házban", " vagyok."]. */
export function splitFrame(text: string, word: string): [string, string, string] {
  const filled = fillFrame(text, word);
  const w = text.startsWith("___") ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  const at = filled.indexOf(w);
  return [filled.slice(0, at), w, filled.slice(at + w.length)];
}

/**
 * The Ukrainian gloss as it goes into a Ukrainian frame: glosses carry their
 * own preposition ("у будинку"), accusative ones a verb hint to drop ("(бачу) стіл").
 */
export const glossForFrame = (ua: string) => ua.replace(/^\([^)]*\)\s*/, "").split(";")[0].trim();
