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
      // i/í/é are neutral for back/front: an earlier back vowel wins (papír).
      // Rounding (e vs ö) follows the LAST vowel, so an earlier ö/ü still
      // gives "front": kereszteződés → kereszteződéshez, töri → törihez.
      if (c === "i" || c === "í" || c === "é") {
        for (let j = i - 1; j >= 0; j--) {
          if (BACK.has(chars[j])) return "back";
          if (FRONT_ROUNDED.has(chars[j]) || chars[j] === "e") return "front";
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

const DIGRAPHS = ["dzs", "cs", "dz", "gy", "ly", "ny", "sz", "ty", "zs"];

/** The stem's final consonant, digraph-aware ("busz" → "sz"); null after a vowel. */
export function finalConsonant(stem: string): string | null {
  if (endsWithVowel(stem)) return null;
  const s = stem.toLowerCase();
  return DIGRAPHS.find((d) => s.endsWith(d)) ?? s.slice(-1);
}

/**
 * The suffix as it attaches to this stem: the harmony variant, "n" for a
 * linking suffix after a vowel, or the assimilated form of -val/-vel after a
 * consonant (busz → "szal", vonat → "tal").
 */
export function suffixFor(stem: string, p: Pattern, h: Harmony): string {
  if (p.linking && endsWithVowel(stem)) return "n";
  const form = p.forms[h];
  const c = p.assimilates ? finalConsonant(stem) : null;
  return c ? c + form.slice(1) : form;
}

/**
 * Apply a pattern to a stem. Handles final-vowel lengthening, the
 * "-n after a vowel" rule for linking-vowel suffixes (autó+n, alma→almán)
 * and -val/-vel assimilation (busz+val → busszal; gy+gy is written ggy).
 * Does NOT model consonant-stem changes (ház→házat, kéz→kezet).
 */
export function apply(stem: string, p: Pattern, h: Harmony): string {
  const base = p.noLengthen ? stem : lengthenFinal(stem);
  const suffix = suffixFor(stem, p, h);
  const c = p.assimilates ? finalConsonant(stem) : null;
  // Doubled digraph is spelled with its first letter doubled: hegy+gyel → heggyel.
  if (c && c.length > 1) return base.slice(0, -c.length) + c[0] + c + suffix.slice(c.length);
  // Three identical consonants simplify to two: toll+val → tollal, jobb+val → jobbal.
  if (c && base.endsWith(c + c)) return base + suffix.slice(1);
  return base + suffix;
}
