// Validates /content/*.json: unique ids, required fields, harmony sanity,
// and that every pattern example is exactly what apply() produces.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = new URL("../content/", import.meta.url);
const HARMONY = ["back", "front", "front_rounded"];
const POS = ["noun", "verb", "adj", "adv", "pron", "num", "phrase", "other"];
const ROLES = ["person", "place", "thing", "time", "food", "group", "abstract"];
// Tags that explain why the explicit harmony differs from guessHarmony().
const EXCEPTION_TAGS = ["mixed-vowel", "compound", "exception"];

const ids = new Set();
let errors = 0;
let warnings = 0;
const err = (m) => { console.error("✗", m); errors++; };
const warn = (m) => { console.warn("!", m); warnings++; };

// Use the app's own rules (src/lib/harmony.ts), bundled with esbuild.
import { loadLib } from "./load-lib.mjs";
const harmony = await loadLib("src/lib/harmony.ts");

const packs = readdirSync(dir)
  .filter((f) => /^[ab]\d-\d\d\.json$/.test(f))
  .sort()
  .map((f) => ({ f, pack: JSON.parse(readFileSync(join(dir.pathname, f), "utf8")) }));

// Pass 1: items and ids across all packs (examples may reference earlier packs).
const stems = new Map(); // hu → item, for words with a harmony class
const allTags = new Set();
for (const { f, pack } of packs) {
  if (!pack.id || !pack.level || !Array.isArray(pack.items)) err(`${f}: bad pack shape`);
  for (const it of pack.items) {
    if (!it.id || !it.hu || !it.ua || !it.pos || !it.type) err(`${f}: item missing fields: ${JSON.stringify(it)}`);
    if (ids.has(it.id)) err(`${f}: duplicate id ${it.id}`);
    ids.add(it.id);
    if (!POS.includes(it.pos)) err(`${it.id}: bad pos "${it.pos}"`);
    for (const t of it.tags ?? []) allTags.add(t);
    if (it.harmony && !HARMONY.includes(it.harmony)) err(`${it.id}: bad harmony`);
    if (it.type === "word" && (it.pos === "noun" || it.pos === "adj") && !it.harmony) {
      err(`${it.id}: noun/adj needs "harmony"`);
    }
    if (it.type === "word" && it.pos === "verb" && !it.hu.includes(" ") && !it.harmony) err(`${it.id}: verb needs "harmony" (for conjugation)`);
    if (it.conj) {
      if (it.pos !== "verb") err(`${it.id}: conj only makes sense on verbs`);
      const ok = ["ik", "tr", "stem", "vstem", "pastStem", "past", "link", "forms", "imp"];
      for (const k of Object.keys(it.conj)) if (!ok.includes(k)) err(`${it.id}: unknown conj.${k}`);
      if (it.conj.past && !["t", "ott", "full", "tt"].includes(it.conj.past)) err(`${it.id}: bad conj.past "${it.conj.past}"`);
      if (it.conj.link !== undefined && it.conj.link !== false) err(`${it.id}: conj.link may only be false`);
      if (it.conj.imp !== undefined && it.conj.imp !== false && typeof it.conj.imp !== "string") err(`${it.id}: conj.imp must be a stem or false`);
    }
    if (it.forms) {
      const ok = ["stem", "low", "j", "acc", "pl", "p1", "p2", "p3", "s", "comp", "ord", "adv", "u"];
      for (const k of Object.keys(it.forms)) if (!ok.includes(k)) err(`${it.id}: unknown forms.${k}`);
      if (it.pos === "verb") {
        if (Object.keys(it.forms).some((k) => k !== "stem")) err(`${it.id}: a verb's forms may only override "stem" (for -ás/-és)`);
      } else if (it.pos === "num") {
        if (Object.keys(it.forms).some((k) => !["stem", "low", "ord"].includes(k))) err(`${it.id}: a numeral's forms may only be stem/low/ord (for -dik)`);
      } else if (it.pos !== "noun" && it.pos !== "adj") err(`${it.id}: forms only make sense on nouns, adjectives, verbs and numerals`);
    }
    if (it.type === "word" && it.harmony) {
      if (stems.has(it.hu)) err(`${it.id}: stem "${it.hu}" already defined by ${stems.get(it.hu).id}`);
      else stems.set(it.hu, it);
      if (harmony) {
        // Verbs: the class is that of the stem, not of the infinitive's -ni (főzni → főz → front_rounded).
        const guess = harmony.guessHarmony(it.pos === "verb" ? (it.conj?.stem ?? harmony.infinitiveStem(it.hu)) : it.hu);
        const explained = (it.tags ?? []).some((t) => EXCEPTION_TAGS.includes(t));
        if (guess !== it.harmony && !explained) {
          warn(`${it.id}: harmony "${it.harmony}" ≠ guess "${guess}" — tag it mixed-vowel/compound/exception if intended`);
        }
      }
    }
  }
}

// Pass 2: patterns (all packs), so pack-level examples can use any of them.
const patterns = new Map();
for (const { f, pack } of packs) {
  for (const p of pack.patterns ?? []) {
    if (!p.id || !p.forms?.back || !p.forms?.front || !p.forms?.front_rounded) err(`${f}: pattern ${p.id} missing forms`);
    if (ids.has(p.id)) err(`${f}: duplicate id ${p.id}`);
    ids.add(p.id);
    patterns.set(p.id, p);
    if (p.attachesTo && (!Array.isArray(p.attachesTo) || p.attachesTo.some((x) => !POS.includes(x)))) {
      err(`${p.id}: bad attachesTo ${JSON.stringify(p.attachesTo)}`);
    }
    if (p.attachesTag !== undefined && typeof p.attachesTag !== "string") err(`${p.id}: attachesTag must be a string`);
    if (p.roles && (!Array.isArray(p.roles) || p.roles.some((r) => !ROLES.includes(r)))) err(`${p.id}: bad roles ${JSON.stringify(p.roles)}`);
    if (p.inflect && !["acc", "pl", "p1", "p2", "p3", "s", "comp", "ord", "adv", "u"].includes(p.inflect)) err(`${p.id}: bad inflect "${p.inflect}"`);
    if (!p.short) warn(`${p.id}: no "short" gloss — exercises fall back to the meaning`);
    if (p.afterVowel !== undefined && typeof p.afterVowel !== "string" && !(p.afterVowel?.back && p.afterVowel?.front && p.afterVowel?.front_rounded)) err(`${p.id}: afterVowel must be a string or {back, front, front_rounded}`);
    if (p.fromInfinitive !== undefined && typeof p.fromInfinitive !== "boolean" && p.fromInfinitive !== "plain") err(`${p.id}: fromInfinitive must be true/false or "plain"`);
    const FRAME_KEYS = [...ROLES, "adj", "verb", "num", "*"];
    for (const [k, fr] of Object.entries(p.frames ?? {})) {
      if (!FRAME_KEYS.includes(k) && !allTags.has(k)) err(`${p.id}: frames.${k} — unknown role/pos/tag`);
      if (!fr?.hu?.includes("___") || !fr?.ua?.includes("___")) err(`${p.id}: frames.${k} needs "___" in hu and ua`);
    }
    if (!p.frames) warn(`${p.id}: no "frames" — Harmony and Builder show the word without a sentence`);
    if (p.fromInfinitive && !(p.attachesTo ?? []).includes("verb")) err(`${p.id}: fromInfinitive needs attachesTo: ["verb"]`);
    if (p.attachesTag && (p.attachesTo ?? []).includes("verb")) {
      for (const { pack: q } of packs) for (const it of q.items) {
        if (it.pos === "verb" && (it.tags ?? []).includes(p.attachesTag) && !it.harmony) warn(`${it.id}: tagged "${p.attachesTag}" for ${p.id} but has no harmony — not a stem`);
      }
    }
  }
}

// Pass 3: examples. Each one whose stem is a known word becomes a Builder task,
// so its result must be exactly what apply() produces.
const taskIds = new Set();
const checkExample = (where, p, ex) => {
  if (!ex.stem || !ex.result || !ex.ua) { err(`${where}: example missing fields: ${JSON.stringify(ex)}`); return 0; }
  const stem = stems.get(ex.stem);
  if (!stem) {
    warn(`${where}: example stem "${ex.stem}" is not a word with harmony — not used by the Builder`);
    return 0;
  }
  const id = `${stem.id}+${p.id}`;
  if (taskIds.has(id)) { warn(`${where}: duplicate builder task ${id} — only the first is used`); return 0; }
  taskIds.add(id);
  if (harmony) {
    const got = harmony.apply(stem.hu, p, stem.harmony, stem.forms);
    if (got !== ex.result) err(`${where}: ${ex.stem} → apply() gives "${got}", example says "${ex.result}"`);
  }
  return 1;
};
for (const { f, pack } of packs) {
  let tasks = 0;
  for (const p of pack.patterns ?? []) for (const ex of p.examples ?? []) tasks += checkExample(p.id, p, ex);
  for (const ex of pack.examples ?? []) {
    const p = patterns.get(ex.pattern);
    if (!p) { err(`${f}: example for unknown pattern "${ex.pattern}"`); continue; }
    tasks += checkExample(`${f} examples/${p.id}`, p, ex);
  }
  console.log(`✓ ${f}: ${pack.items.length} items, ${(pack.patterns ?? []).length} patterns, ${tasks} builder tasks`);
}

if (warnings) console.warn(`${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
