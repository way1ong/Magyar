import { endsWithVowel, finalConsonant, lengthenFinal } from "./harmony";
import type { Harmony, ItemForms } from "./types";

/**
 * Noun inflection that changes more than the suffix: accusative, plural,
 * the singular possessives, the "-s" adjective (kertes, cukros) and the
 * comparative of adjectives (olcsóbb, nagyobb). The suffix itself is regular; what varies is
 *  - the linking vowel: o/e/ö by harmony, or a/e for "lowering" stems
 *    (ház → házat, könyv → könyvet) — `forms.low`;
 *  - the stem: shortening (kéz → kezet), fleeting vowel (tükör → tükröt),
 *    v-stems (ló → lovat) — `forms.stem`;
 *  - -ja/-je vs -a/-e in the 3rd-person possessive — `forms.j`;
 *  - the odd irregular (anya → anyja, fiú → fia, szó → szavak) — full-form
 *    overrides in `forms`.
 * Nouns without `forms` follow the default rules. content:forms prints
 * every derived form for review.
 */
export type InflectKind = "acc" | "pl" | "p1" | "p2" | "p3" | "s" | "comp";

/** Accusative after these consonants takes no linking vowel (asztalt, embert, buszt). */
const NO_LINK = new Set(["l", "r", "n", "ny", "s", "sz", "z", "zs", "j", "ly"]);

/** Candidate endings for the Harmony game's multiple choice. */
export const INFLECT_VARIANTS: Record<InflectKind, string[]> = {
  acc: ["t", "ot", "et", "öt", "at"],
  pl: ["k", "ok", "ek", "ök", "ak"],
  p1: ["m", "om", "em", "öm", "am"],
  p2: ["d", "od", "ed", "öd", "ad"],
  p3: ["a", "e", "ja", "je"],
  s: ["s", "os", "es", "ös", "as"],
  comp: ["bb", "abb", "ebb", "obb"],
};

function commonPrefix(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(0, i);
}

export function linkingVowel(h: Harmony, low: boolean): string {
  if (low) return h === "back" ? "a" : "e";
  return h === "back" ? "o" : h === "front" ? "e" : "ö";
}

export interface Inflected {
  /** The stem as it appears in the word (kez-, tükr-, almá-). */
  base: string;
  suffix: string;
  /** The whole word; equals base + suffix except for full-form overrides. */
  result: string;
}

export function inflect(hu: string, h: Harmony, forms: ItemForms | undefined, kind: InflectKind): Inflected {
  const stemChanged = !!forms?.stem;
  const base = forms?.stem ?? (endsWithVowel(hu) ? lengthenFinal(hu) : hu);
  // What the ending attaches to: the oblique stem when there is one (szó → szav-).
  const vowelFinal = endsWithVowel(base);
  const lv = linkingVowel(h, !!forms?.low);
  const je = h === "back" ? "ja" : "je";
  const ae = h === "back" ? "a" : "e";

  const override = forms?.[kind];
  if (override) {
    // Split an irregular form at the longest shared prefix: anya/anyja → any- + ja.
    const b = override.startsWith(base) ? base : commonPrefix(hu, override);
    return { base: b, suffix: override.slice(b.length), result: override };
  }

  let suffix: string;
  switch (kind) {
    case "acc":
      // Lowering and changed stems always take the linking vowel (házat, kezet).
      suffix =
        vowelFinal || (!forms?.low && !stemChanged && NO_LINK.has(finalConsonant(hu) ?? "")) ? "t" : lv + "t";
      break;
    case "pl":
      suffix = vowelFinal ? "k" : lv + "k";
      break;
    case "p1":
      suffix = vowelFinal ? "m" : lv + "m";
      break;
    case "p2":
      suffix = vowelFinal ? "d" : lv + "d";
      break;
    case "p3":
      suffix = vowelFinal || forms?.j ? je : ae;
      break;
    case "s":
      // "having X" adjective: kertes, cukros, szobás — linking vowel as in the plural.
      suffix = vowelFinal ? "s" : lv + "s";
      break;
    case "comp":
      // Comparative of adjectives: olcsóbb, drágább; after a consonant -abb/-ebb
      // (nagyobb, szebb, jobb, kisebb, több are overrides in `forms.comp`).
      suffix = vowelFinal ? "bb" : (h === "back" ? "a" : "e") + "bb";
      break;
  }
  return { base, suffix, result: base + suffix };
}
