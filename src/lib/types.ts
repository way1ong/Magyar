/**
 * Content model. Content lives in /content/*.json, is read-only on the phone,
 * and is edited in the repo. Progress lives in IndexedDB (see db.ts).
 */

/** Vowel class of the LAST syllable of a stem — decides the suffix form. */
export type Harmony = "back" | "front" | "front_rounded";

export type PartOfSpeech =
  | "noun"
  | "verb"
  | "adj"
  | "adv"
  | "pron"
  | "num"
  | "phrase"
  | "other";

export interface Item {
  /** Stable id, e.g. "a1-01-haz". Never reuse an id for another word. */
  id: string;
  type: "word" | "phrase";
  hu: string;
  ua: string;
  pos: PartOfSpeech;
  /** Only for nouns/adjectives that take suffixes. */
  harmony?: Harmony;
  /** Example sentence (hu) + translation (ua). */
  example?: { hu: string; ua: string };
  /** Free tags: theme, register, etc. */
  tags?: string[];
}

/** A suffix with its harmony variants. forms[harmony] is the variant used. */
export interface Pattern {
  id: string; // e.g. "suf-inessive"
  name: string; // "-ban/-ben — у чомусь (де?)"
  meaning: string; // short Ukrainian explanation
  /** Two-form suffixes have identical front and front_rounded. */
  forms: Record<Harmony, string>;
  /** Linking vowel rule for stems ending in a consonant (e.g. -on/-en/-ön). */
  linking?: boolean;
  /**
   * Parts of speech this suffix attaches to. Default: ["noun", "adj"].
   * E.g. -szor/-szer/-ször (times) only goes on numerals.
   */
  attachesTo?: PartOfSpeech[];
  /**
   * Worked examples. Each one whose `stem` is an item with a known harmony
   * class also becomes a Builder task (card `builder:<itemId>+<patternId>`),
   * so `ua` must be a natural Ukrainian gloss of `result`, and `result`
   * must equal apply(stem) — `npm run content:check` verifies that.
   */
  examples: { stem: string; result: string; ua: string }[];
}

/** An extra worked example for a pattern defined in any pack (e.g. a1-01's -on/-en/-ön). */
export interface PackExample {
  pattern: string; // pattern id
  stem: string;
  result: string;
  ua: string;
}

export interface ContentPack {
  id: string; // "a1-01"
  level: "A0" | "A1" | "A2" | "B1";
  title: string;
  items: Item[];
  patterns: Pattern[];
  /**
   * Builder tasks for this pack's words with suffixes from any pack
   * ("hétfőn" — у понеділок). Same rules as Pattern.examples.
   */
  examples?: PackExample[];
}
