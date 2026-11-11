import type { Harmony, Item, ItemForms, Pattern } from "./types";
import { conjugate, splitPrefix } from "./conj";
import { INFLECT_VARIANTS, inflect } from "./inflect";

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
 * Verb stem from the dictionary infinitive: parkolni → parkol, takarítani →
 * takarít, érteni → ért (the -a-/-e- before -ni is a linking vowel; no
 * Hungarian verb stem ends in a short a/e).
 */
export const infinitiveStem = (inf: string) => inf.replace(/ni$/, "").replace(/[ae]$/, "");

/**
 * Stem + suffix + whole word for a pattern on a stem. `forms` carries the
 * noun's stem behaviour for inflecting patterns (kéz → kez+et).
 */
export function applyParts(stem: string, p: Pattern, h: Harmony, forms?: ItemForms, item?: Item): { base: string; suffix: string; result: string } {
  if (p.fromInfinitive === "past") {
    // Past participle = past tense 3sg indefinite (olvasott, írt, főtt, evett): the
    // conjugation model already knows the linking vowel and the irregular stems.
    const result = item ? conjugate(item, { tense: "past", def: false, person: "3sg" }) : infinitiveStem(stem) + p.forms[h];
    const m = result.match(/^(.*?)([aeoö]?t{1,2})$/);
    return m ? { base: m[1], suffix: m[2], result } : { base: result, suffix: "", result };
  }
  if (p.fromInfinitive === "caus") {
    // Causative -tat/-tet: after a stem in -t the t doubles (fizet → fizettet,
    // javít → javíttat); a one-syllable stem takes -at/-et (ír → írat, mos →
    // mosat); longer stems take -tat/-tet (olvas → olvastat, csinál → csináltat).
    const base = infinitiveStem(stem);
    const v = h === "back" ? "a" : "e";
    // The syllable count is of the verb without its prefix: aláír → aláírat, megír → megírat.
    const syllables = (infinitiveStem(splitPrefix(stem)[1]).match(/[aáeéiíoóöőuúüű]/g) ?? []).length;
    // A stem in vowel + t doubles the t (fizet → fizettet, javít → javíttat); after a
    // consonant cluster ending in t only -at/-et is added (fest → festet, ereszt → eresztet).
    const suffix = /[aáeéiíoóöőuúüű]t$/.test(base) ? `t${v}t` : base.endsWith("t") ? `${v}t` : syllables <= 1 ? `${v}t` : `t${v}t`;
    return { base, suffix, result: base + suffix };
  }
  if (p.fromInfinitive) {
    const base = (p.fromInfinitive === "plain" ? undefined : forms?.stem) ?? infinitiveStem(stem);
    return { base, suffix: p.forms[h], result: base + p.forms[h] };
  }
  if (p.inflect) return inflect(stem, h, forms, p.inflect);
  const base = p.noLengthen ? stem : lengthenFinal(stem);
  const form = p.forms[h];
  const avRaw = p.afterVowel ?? (p.linking ? "n" : undefined);
  const av = typeof avRaw === "object" ? avRaw[h] : avRaw;
  if (av && endsWithVowel(stem)) return { base, suffix: av, result: base + av };
  const c = p.assimilates ? finalConsonant(stem) : null;
  if (!c) return { base, suffix: form, result: base + form };
  const suffix = c + form.slice(1);
  // Doubled digraph is spelled with its first letter doubled: hegy+gyel → heggyel.
  if (c.length > 1) return { base, suffix, result: base.slice(0, -c.length) + c[0] + c + suffix.slice(c.length) };
  // Three identical consonants simplify to two: toll+val → tollal, jobb+val → jobbal.
  if (base.endsWith(c + c)) return { base, suffix, result: base + suffix.slice(1) };
  return { base, suffix, result: base + suffix };
}

/**
 * The suffix as it attaches to this stem: the harmony variant, "n" for a
 * linking suffix after a vowel, the assimilated form of -val/-vel after a
 * consonant (busz → "szal"), or the inflectional ending (ház → "at").
 */
export const suffixFor = (stem: string, p: Pattern, h: Harmony, forms?: ItemForms, item?: Item) => applyParts(stem, p, h, forms, item).suffix;

/**
 * Apply a pattern to a stem. Handles final-vowel lengthening, the
 * "-n after a vowel" rule for linking-vowel suffixes (autó+n, alma→almán),
 * -val/-vel assimilation (busz+val → busszal) and, for inflecting patterns,
 * stem changes and linking vowels (kéz → kezet, ház → házat).
 */
export const apply = (stem: string, p: Pattern, h: Harmony, forms?: ItemForms, item?: Item) => applyParts(stem, p, h, forms, item).result;

/**
 * Multiple-choice for the Harmony game: the right ending and the candidates.
 * Case suffixes: the harmony variants (-ban/-ben). Inflecting suffixes: the
 * actual ending among its linking-vowel variants (-at vs -ot/-et/-öt/-t).
 */
const VERB_VARIANTS: Record<string, string[]> = { past: ["t", "tt", "ott", "ett", "ött"], caus: ["at", "et", "tat", "tet"] };

export function harmonyChoice(stem: string, p: Pattern, h: Harmony, forms?: ItemForms, item?: Item): { correct: string; options: string[] } {
  const verbVariants = typeof p.fromInfinitive === "string" ? VERB_VARIANTS[p.fromInfinitive] : undefined;
  if (!p.inflect && !verbVariants) return { correct: p.forms[h], options: variantsOf(p) };
  const correct = verbVariants ? applyParts(stem, p, h, forms, item).suffix : inflect(stem, h, forms, p.inflect!).suffix;
  const others = (verbVariants ?? INFLECT_VARIANTS[p.inflect!]).filter((v) => v !== correct);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const options = [correct, ...others.slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { correct, options };
}
