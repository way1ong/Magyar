import type { Harmony, Pattern } from "./types";

const BACK = new Set(["a", "á", "o", "ó", "u", "ú"]);
const FRONT = new Set(["e", "é", "i", "í"]);
const FRONT_ROUNDED = new Set(["ö", "ő", "ü", "ű"]);
const VOWELS = new Set([...BACK, ...FRONT, ...FRONT_ROUNDED]);

/**
 * Heuristic harmony detection: look at the last vowel of the stem.
 * Mixed-vowel words are exceptions (kávé → back, papír → back): the content
 * pack sets `harmony` explicitly; this is only a fallback for new words.
 */
export function guessHarmony(stem: string): Harmony {
  const chars = [...stem.toLowerCase()];
  for (let i = chars.length - 1; i >= 0; i--) {
    const c = chars[i];
    if (FRONT_ROUNDED.has(c)) return "front_rounded";
    if (BACK.has(c)) return "back";
    if (FRONT.has(c)) {
      // i/í/é are often neutral: a back vowel earlier wins.
      if (c === "i" || c === "í" || c === "é") {
        for (let j = i - 1; j >= 0; j--) {
          if (BACK.has(chars[j])) return "back";
          if (FRONT_ROUNDED.has(chars[j])) return "front_rounded";
          if (chars[j] === "e") return "front";
        }
      }
      return "front";
    }
  }
  return "back";
}

export const endsWithVowel = (s: string) => VOWELS.has([...s.toLowerCase()].at(-1) ?? "");

/** All distinct suffix variants of a pattern (for multiple-choice options). */
export function variantsOf(p: Pattern): string[] {
  return [...new Set(Object.values(p.forms))];
}

/** Final short a/e lengthen before most suffixes: alma→almá-, szoba→szobá-. */
export function lengthenFinal(stem: string): string {
  if (stem.endsWith("a")) return stem.slice(0, -1) + "á";
  if (stem.endsWith("e")) return stem.slice(0, -1) + "é";
  return stem;
}

/**
 * Apply a pattern to a stem. Handles final-vowel lengthening and the
 * "-n after a vowel" rule for linking-vowel suffixes (autó+n, alma→almán).
 * Does NOT model consonant-stem changes (ház→házat, kéz→kezet).
 */
export function apply(stem: string, p: Pattern, h: Harmony): string {
  const base = lengthenFinal(stem);
  if (p.linking && endsWithVowel(stem)) return base + "n";
  return base + p.forms[h];
}
