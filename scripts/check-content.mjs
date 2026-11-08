// Validates /content/*.json: unique ids, required fields, harmony sanity,
// and that every pattern example is exactly what apply() produces.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = new URL("../content/", import.meta.url);
const HARMONY = ["back", "front", "front_rounded"];
const POS = ["noun", "verb", "adj", "adv", "pron", "num", "phrase", "other"];
// Tags that explain why the explicit harmony differs from guessHarmony().
const EXCEPTION_TAGS = ["mixed-vowel", "compound", "exception"];

const ids = new Set();
let errors = 0;
let warnings = 0;
const err = (m) => { console.error("✗", m); errors++; };
const warn = (m) => { console.warn("!", m); warnings++; };

// Use the app's own rules (src/lib/harmony.ts). Needs Node ≥ 22.18 (built-in
// TypeScript type stripping); on older Node the apply() checks are skipped.
let harmony = null;
try {
  harmony = await import(new URL("../src/lib/harmony.ts", import.meta.url));
} catch (e) {
  warn(`can't load src/lib/harmony.ts (${e.code ?? e.message}) — skipping apply()/guessHarmony checks; use Node ≥ 22.18`);
}

const packs = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => ({ f, pack: JSON.parse(readFileSync(join(dir.pathname, f), "utf8")) }));

// Pass 1: items and ids across all packs (examples may reference earlier packs).
const stems = new Map(); // hu → item, for words with a harmony class
for (const { f, pack } of packs) {
  if (!pack.id || !pack.level || !Array.isArray(pack.items)) err(`${f}: bad pack shape`);
  for (const it of pack.items) {
    if (!it.id || !it.hu || !it.ua || !it.pos || !it.type) err(`${f}: item missing fields: ${JSON.stringify(it)}`);
    if (ids.has(it.id)) err(`${f}: duplicate id ${it.id}`);
    ids.add(it.id);
    if (!POS.includes(it.pos)) err(`${it.id}: bad pos "${it.pos}"`);
    if (it.harmony && !HARMONY.includes(it.harmony)) err(`${it.id}: bad harmony`);
    if (it.type === "word" && (it.pos === "noun" || it.pos === "adj") && !it.harmony) {
      err(`${it.id}: noun/adj needs "harmony"`);
    }
    if (it.type === "word" && it.harmony) {
      if (stems.has(it.hu)) err(`${it.id}: stem "${it.hu}" already defined by ${stems.get(it.hu).id}`);
      else stems.set(it.hu, it);
      if (harmony) {
        const guess = harmony.guessHarmony(it.hu);
        const explained = (it.tags ?? []).some((t) => EXCEPTION_TAGS.includes(t));
        if (guess !== it.harmony && !explained) {
          warn(`${it.id}: harmony "${it.harmony}" ≠ guess "${guess}" — tag it mixed-vowel/compound/exception if intended`);
        }
      }
    }
  }
}

// Pass 2: patterns and their examples.
for (const { f, pack } of packs) {
  let tasks = 0;
  for (const p of pack.patterns ?? []) {
    if (!p.id || !p.forms?.back || !p.forms?.front || !p.forms?.front_rounded) err(`${f}: pattern ${p.id} missing forms`);
    if (ids.has(p.id)) err(`${f}: duplicate id ${p.id}`);
    ids.add(p.id);
    if (p.attachesTo && (!Array.isArray(p.attachesTo) || p.attachesTo.some((x) => !POS.includes(x)))) {
      err(`${p.id}: bad attachesTo ${JSON.stringify(p.attachesTo)}`);
    }
    for (const ex of p.examples ?? []) {
      if (!ex.stem || !ex.result || !ex.ua) { err(`${p.id}: example missing fields: ${JSON.stringify(ex)}`); continue; }
      const stem = stems.get(ex.stem);
      if (!stem) {
        warn(`${p.id}: example stem "${ex.stem}" is not a word with harmony — not used by the Builder`);
        continue;
      }
      tasks++;
      if (harmony) {
        const got = harmony.apply(stem.hu, p, stem.harmony);
        if (got !== ex.result) err(`${p.id}: ${ex.stem} → apply() gives "${got}", example says "${ex.result}"`);
      }
    }
  }
  console.log(`✓ ${f}: ${pack.items.length} items, ${(pack.patterns ?? []).length} patterns, ${tasks} builder tasks`);
}

if (warnings) console.warn(`${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
