// Static export for GitHub Pages: no server, so the backup API route is moved
// aside for the build (Next refuses to export route handlers) and put back
// afterwards. Output: out/ with everything under /Magyar.
import { spawnSync } from "node:child_process";
import { existsSync, renameSync, writeFileSync } from "node:fs";

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
if (code === 0) writeFileSync("out/.nojekyll", ""); // GitHub Pages must serve _next/
process.exit(code);
