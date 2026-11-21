// Static export for GitHub Pages: no server, so the backup API route is moved
// aside for the build (Next refuses to export route handlers) and put back
// afterwards. Output: out/ with everything under /Magyar.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const api = "src/app/api";
const aside = "src/.api-aside";
if (existsSync(api)) renameSync(api, aside);
let code = 1;
try {
  const r = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    env: { ...process.env, MAGYAR_STATIC: "1", NEXT_PUBLIC_MAGYAR_STATIC: "1" },
  });
  code = r.status ?? 1;
} finally {
  if (existsSync(aside)) renameSync(aside, api);
}
if (code === 0) {
  writeFileSync("out/.nojekyll", ""); // GitHub Pages must serve _next/
  precache();
}
process.exit(code);

/**
 * Offline: list every file of the export in out/sw.js (self.__PRECACHE__) with
 * a hash of the build (self.__BUILD__), so the installed app downloads all of
 * it at once and works without a network, and every deploy is a new worker.
 * Pages are listed as their URLs (review/index.html → review/).
 */
function precache() {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(full.slice("out/".length).split("\\").join("/"));
    }
  };
  walk("out");
  const keep = files.filter((f) => f !== "sw.js" && f !== ".nojekyll" && f !== "404.html" && !f.startsWith("404/")).sort();
  const hash = createHash("sha1");
  for (const f of keep) hash.update(f).update(readFileSync(join("out", f)));
  const build = hash.digest("hex").slice(0, 10);
  const urls = keep.map((f) => (f === "index.html" ? "" : f.endsWith("/index.html") ? f.slice(0, -"index.html".length) : f));
  const sw = readFileSync("out/sw.js", "utf8");
  writeFileSync("out/sw.js", `self.__BUILD__ = ${JSON.stringify(build)};\nself.__PRECACHE__ = ${JSON.stringify(urls)};\n` + sw);
  const kb = Math.round(keep.reduce((n, f) => n + statSync(join("out", f)).size, 0) / 1024);
  console.log(`✓ sw.js: ${urls.length} files (${kb} KB) precached for offline, build ${build}`);
}
