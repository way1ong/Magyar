import { allItems } from "./content";
import type { Item } from "./types";

/**
 * Dictation exercise: hear the Hungarian (TTS), type it. Card key:
 * `dictation:<itemId>`. Items with alternatives or gaps in `hu`
 * ("kettő / két", "Hol van a ...?") can't be dictated and are skipped.
 */
export const dictationItems: Item[] = allItems.filter((i) => !/[/…]|\.\.\./.test(i.hu));

/** Lowercase, drop punctuation, collapse whitespace — the comparable form. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip diacritics: á→a, ő→o, ű→u (NFD + remove combining marks). */
export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export type Verdict = "exact" | "accents" | "wrong";

/** "accents": the only mistakes are long/short vowel marks (a/á, o/ó/ö/ő …). */
export function compare(typed: string, expected: string): Verdict {
  const a = normalize(typed);
  const b = normalize(expected);
  if (a === b) return "exact";
  if (a && stripAccents(a) === stripAccents(b)) return "accents";
  return "wrong";
}

/** Letters a Ukrainian keyboard lacks — offered as tap-to-insert buttons. */
export const ACCENTS = ["á", "é", "í", "ó", "ö", "ő", "ú", "ü", "ű"];
