// Validates /content/*.json: unique ids, required fields, harmony sanity.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = new URL("../content/", import.meta.url);
const ids = new Set();
let errors = 0;
const err = (m) => { console.error("✗", m); errors++; };

for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const pack = JSON.parse(readFileSync(join(dir.pathname, f), "utf8"));
  if (!pack.id || !pack.level || !Array.isArray(pack.items)) err(`${f}: bad pack shape`);
  for (const it of pack.items) {
    if (!it.id || !it.hu || !it.ua || !it.pos || !it.type) err(`${f}: item missing fields: ${JSON.stringify(it)}`);
    if (ids.has(it.id)) err(`${f}: duplicate id ${it.id}`);
    ids.add(it.id);
    if (it.harmony && !["back", "front", "front_rounded"].includes(it.harmony)) err(`${it.id}: bad harmony`);
  }
  for (const p of pack.patterns ?? []) {
    if (!p.id || !p.forms?.back || !p.forms?.front || !p.forms?.front_rounded) err(`${f}: pattern ${p.id} missing forms`);
    if (ids.has(p.id)) err(`${f}: duplicate id ${p.id}`);
    ids.add(p.id);
  }
  console.log(`✓ ${f}: ${pack.items.length} items, ${(pack.patterns ?? []).length} patterns`);
}
process.exit(errors ? 1 : 0);
