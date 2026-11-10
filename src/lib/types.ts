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

/**
 * Semantic role of a noun, derived from its tags (see roleOf in content.ts):
 * group ("group": család, csapat — a set of people), person ("person" tag),
 * place ("place"), time (day/month/season/daytime/time), food ("food"/"drink"),
 * abstract ("abstract": betegség, veszély — no "on" or "onto" it), else thing.
 * Decides which suffixes make sense in the Harmony game.
 */
export type Role = "person" | "place" | "thing" | "time" | "food" | "group" | "abstract";

/**
 * Stem behaviour before the accusative, plural and possessive suffixes
 * (see inflect.ts). Absent = fully regular (asztal → asztalt, asztalok).
 */
export interface ItemForms {
  /** Oblique stem: kéz → "kez", tükör → "tükr", ló → "lov". */
  stem?: string;
  /** Lowering stem: linking vowel a/e — házat, házak; also földet, könyvet for ö-words. */
  low?: boolean;
  /** 3rd-person possessive -ja/-je after a consonant: boltja, kertje. */
  j?: boolean;
  /** Full-form overrides for the irregular few: anya → anyja, szó → szavak. */
  acc?: string;
  pl?: string;
  p1?: string;
  p2?: string;
  p3?: string;
  /** -s adjective override (rare: ló → lovas is covered by `stem`). */
  s?: string;
  /** Comparative override for adjectives: nagy → nagyobb, jó → jobb, kicsi → kisebb. */
  comp?: string;
  /** Ordinal of a numeral when irregular: egy → "első", kettő → "második". */
  ord?: string;
  /** Adverb of an adjective when irregular: jó → "jól", lassú → "lassan", szabad → "szabadon". */
  adv?: string;
  /** -ú/-ű attribute adjective when irregular: erő → "erejű", idő → "idejű". */
  u?: string;
  /** -stul/-stül override. */
  stul?: string;
}

export interface Item {
  /** Stable id, e.g. "a1-01-haz". Never reuse an id for another word. */
  id: string;
  type: "word" | "phrase";
  hu: string;
  ua: string;
  pos: PartOfSpeech;
  /** Only for nouns/adjectives that take suffixes. */
  harmony?: Harmony;
  /** Nouns: stem changes before -t, -k, -m/-d/-a; adjectives: comparative override (inflect.ts). */
  forms?: ItemForms;
  /** Example sentence (hu) + translation (ua). */
  example?: { hu: string; ua: string };
  /** Free tags: theme, register, etc. */
  tags?: string[];
  /** Verbs: conjugation flags (lib/conj.ts). */
  conj?: VerbConj;
}

/** A suffix with its harmony variants. forms[harmony] is the variant used. */
export interface Pattern {
  id: string; // e.g. "suf-inessive"
  name: string; // "-ban / -ben"
  /** Two or three words for the exercises' result line: "у чомусь (де?)". */
  short?: string;
  /** Role-specific gloss when the meaning differs by role: -ról on a person = "про когось". */
  shortByRole?: Partial<Record<Role, string>>;
  meaning: string; // fuller Ukrainian explanation with examples
  /** Two-form suffixes have identical front and front_rounded. */
  forms: Record<Harmony, string>;
  /** Linking vowel rule for stems ending in a consonant (e.g. -on/-en/-ön): after a vowel just "-n". */
  linking?: boolean;
  /** The form used after a vowel-final stem, when it differs (-nként: óra → óránként). `linking` = "n". */
  afterVowel?: string | Record<Harmony, string>;
  /**
   * -val/-vel: after a consonant the v assimilates to it (busz+val → busszal,
   * vonat+val → vonattal; a digraph doubles its first letter: hegy → heggyel).
   */
  assimilates?: boolean;
  /** Final a/e do NOT lengthen before this suffix (óra+kor → órakor). */
  noLengthen?: boolean;
  /**
   * The suffix goes on a verb stem, which the content stores as the
   * infinitive: -ás/-és strips -ni / -ani / -eni (parkolni → parkol+ás,
   * takarítani → takarít+ás); `forms.stem` overrides irregular stems
   * (vásárolni → vásárl+ás). "plain" ignores `forms.stem` (the -hat/-het
   * potential goes on the full stem: dohányozhat, but dohányzás). Pair with attachesTo: ["verb"].
   */
  fromInfinitive?: boolean | "plain";
  /**
   * Accusative / plural / possessive: the ending depends on the stem's
   * linking vowel and stem changes (inflect.ts); `forms` then only lists
   * the default o/e/ö endings for display.
   */
  inflect?: "acc" | "pl" | "p1" | "p2" | "p3" | "s" | "comp" | "ord" | "adv" | "u";
  /**
   * Parts of speech this suffix attaches to. Default: ["noun", "adj"].
   * E.g. -szor/-szer/-ször (times) only goes on numerals.
   */
  attachesTo?: PartOfSpeech[];
  /** Only stems carrying this tag take the suffix (-ul/-ül → "language" adjectives). */
  attachesTag?: string;
  /**
   * Noun roles this suffix makes sense with (default: all). -ban on a person
   * ("apában") or -nak on a table are grammatical but nonsense — the Harmony
   * game only draws suffixes whose roles include the stem's role.
   */
  roles?: Role[];
  /**
   * Context sentences for exercises: "A ___ vagyok." / "Я в ___.", keyed by
   * the stem's role (nouns) or part of speech (adj/verb/num), "*" for any.
   * "___" is the inflected word; "a ___" is rendered "az ___" before a vowel.
   */
  frames?: Partial<Record<string, Frame>>;
  /**
   * Worked examples. Each one whose `stem` is an item with a known harmony
   * class also becomes a Builder task (card `builder:<itemId>+<patternId>`),
   * so `ua` must be a natural Ukrainian gloss of `result`, and `result`
   * must equal apply(stem) — `npm run content:check` verifies that.
   */
  examples: { stem: string; result: string; ua: string; frame?: Frame }[];
}

/**
 * Per-verb conjugation flags (see lib/conj.ts). Absent = fully regular.
 * Only `tr` is about meaning; the rest describe the stem.
 */
export interface VerbConj {
  /** -ik verb: lakik, dolgozik (1sg lakom, 3sg lakik). */
  ik?: boolean;
  /** Transitive: has the definite conjugation (látom, látod, látja). */
  tr?: boolean;
  /** Present stem when not the infinitive minus -ni: alszik → "alsz". */
  stem?: string;
  /** Stem before vowel-initial endings (fleeting vowel): érez → "érz" (érzek, de éreztek). */
  vstem?: string;
  /** Past stem: aludni → "alud" (aludtam). */
  pastStem?: string;
  /** Imperative j-stem when the rule guesses wrong (lát → "láss", bocsát → "bocsáss"), or false: no imperative (tetszik). */
  imp?: string | false;
  /** Past-tense group when the rule guesses wrong: "t" (állt), "ott" (látott/láttam), "full" (hallottam), "tt" (lőtt). */
  past?: "t" | "ott" | "full" | "tt";
  /** No linking vowels despite a final consonant cluster: áll → állsz, állnak. */
  link?: false;
  /** Full-form overrides by slot key ("past.indef.3sg": "…"). */
  forms?: Record<string, string>;
}

/** A sentence with a "___" gap for the inflected word, and its translation. */
export interface Frame {
  hu: string;
  ua: string;
}

/** An extra worked example for a pattern defined in any pack (e.g. a1-01's -on/-en/-ön). */
export interface PackExample {
  pattern: string; // pattern id
  stem: string;
  result: string;
  ua: string;
  /** Overrides the pattern's frame for this example. */
  frame?: Frame;
}

/** A curated sentence for the word-order exercise, with the rule it illustrates. */
export interface Sentence {
  id: string; // "a1-01-s01"
  hu: string;
  ua: string;
  /** Ukrainian note on the word order shown after the answer. */
  note?: string;
}

/** A short dialogue for the comprehension exercise. */
export interface Dialogue {
  id: string; // "a1-01-d01"
  title: string;
  lines: { who: string; hu: string; ua: string }[];
  /** Comprehension question in Ukrainian with options and the index of the right one. */
  question: { q: string; options: string[]; answer: number };
}

export interface ContentPack {
  id: string; // "a1-01"
  level: "A0" | "A1" | "A2" | "B1" | "B2";
  title: string;
  items: Item[];
  patterns: Pattern[];
  /**
   * Builder tasks for this pack's words with suffixes from any pack
   * ("hétfőn" — у понеділок). Same rules as Pattern.examples.
   */
  examples?: PackExample[];
  /** Sentences for the "Речення" exercise (word order), with notes. */
  sentences?: Sentence[];
  /** Dialogues for the "Діалоги" exercise. */
  dialogues?: Dialogue[];
}
