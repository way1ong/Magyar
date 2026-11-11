// Prints every noun's derived forms (accusative, plural, my/your/his-her) as
// a Markdown table for human review: node scripts/forms-table.mjs > forms.md
import { readdirSync, readFileSync } from "node:fs";
import { loadLib } from "./load-lib.mjs";
const { inflect } = await loadLib("src/lib/inflect.ts");
const dir = new URL("../content/", import.meta.url);
console.log("| пакет | слово | знахідний | множина | мій | твій | його/її | -s | forms |\n|---|---|---|---|---|---|---|---|---|");
for (const f of readdirSync(dir).filter((f) => /^[abc]\d-\d\d\.json$/.test(f)).sort()) {
  const pack = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
  for (const it of pack.items) {
    if (it.pos !== "noun" || !it.harmony) continue;
    const w = (k) => inflect(it.hu, it.harmony, it.forms, k).result;
    console.log(`| ${pack.id} | ${it.hu} | ${w("acc")} | ${w("pl")} | ${w("p1")} | ${w("p2")} | ${w("p3")} | ${w("s")} | ${it.forms ? JSON.stringify(it.forms) : ""} |`);
  }
}
