// Prints every verb's conjugation (present/past, indefinite/definite) as a
// Markdown table for human review: npm run content:conj > conj.md
import { readdirSync, readFileSync } from "node:fs";
import { loadLib } from "./load-lib.mjs";
const { paradigmOf, isConjugable, isTransitive } = await loadLib("src/lib/conj.ts");
const dir = new URL("../content/", import.meta.url);
const row = (it, tense, def) => paradigmOf(it, tense, def).map((x) => x.form).join(" ");
console.log("| пакет | дієслово | теперішній (неозн.) | теперішній (озн.) | минулий (неозн.) | минулий (озн.) | conj |\n|---|---|---|---|---|---|---|");
for (const f of readdirSync(dir).filter((f) => /^[ab]\d-\d\d\.json$/.test(f)).sort()) {
  const pack = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
  for (const it of pack.items) {
    if (!isConjugable(it)) continue;
    const tr = isTransitive(it);
    console.log(`| ${pack.id} | ${it.hu} | ${row(it, "pres", false)} | ${tr ? row(it, "pres", true) : "—"} | ${row(it, "past", false)} | ${tr ? row(it, "past", true) : "—"} | ${it.conj ? JSON.stringify(it.conj) : ""} |`);
  }
}
