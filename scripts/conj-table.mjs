// Prints every verb's conjugation (present/past/imperative/conditional, indefinite/definite) as a
// Markdown table for human review: npm run content:conj > conj.md
import { readdirSync, readFileSync } from "node:fs";
import { loadLib } from "./load-lib.mjs";
const { paradigmOf, isConjugable, isTransitive, hasImperative } = await loadLib("src/lib/conj.ts");
const dir = new URL("../content/", import.meta.url);
const row = (it, tense, def) => paradigmOf(it, tense, def).map((x) => x.form).join(" ");
console.log("| пакет | дієслово | теперішній (неозн.) | теперішній (озн.) | минулий (неозн.) | минулий (озн.) | наказовий (неозн.) | наказовий (озн.) | умовний (неозн.) | умовний (озн.) | conj |\n|---|---|---|---|---|---|---|---|---|---|---|");
for (const f of readdirSync(dir).filter((f) => /^[abc]\d-\d\d\.json$/.test(f)).sort()) {
  const pack = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
  for (const it of pack.items) {
    if (!isConjugable(it)) continue;
    const tr = isTransitive(it);
    const imp = hasImperative(it);
    console.log(`| ${pack.id} | ${it.hu} | ${row(it, "pres", false)} | ${tr ? row(it, "pres", true) : "—"} | ${row(it, "past", false)} | ${tr ? row(it, "past", true) : "—"} | ${imp ? row(it, "imp", false) : "—"} | ${imp && tr ? row(it, "imp", true) : "—"} | ${row(it, "cond", false)} | ${tr ? row(it, "cond", true) : "—"} | ${it.conj ? JSON.stringify(it.conj) : ""} |`);
  }
}
