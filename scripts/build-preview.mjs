// Builds the app as ONE self-contained HTML file (preview/dist/magyar-preview.html)
// for publishing as a Claude artifact: inline JS + CSS, hash routing, no SW.
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const result = await build({
  absWorkingDir: root,
  entryPoints: ["preview/main.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  outdir: "preview/dist",
  alias: {
    "next/link": "./preview/shims/link.tsx",
    "next/navigation": "./preview/shims/navigation.ts",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_MAGYAR_PREVIEW": '"1"',
  },
  logLevel: "warning",
  logOverride: { "unsupported-directive": "silent" },
});

const js = result.outputFiles.find((f) => f.path.endsWith(".js")).text.replaceAll("</script", "<\\/script");
const css = result.outputFiles.find((f) => f.path.endsWith(".css")).text.replaceAll("</style", "<\\/style");
const built = new Date().toISOString().slice(0, 16).replace("T", " ");

const html = `<title>Превʼю Magyar</title>
<meta name="magyar-build" content="${built} UTC">
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
mkdirSync(`${root}preview/dist`, { recursive: true });
writeFileSync(`${root}preview/dist/magyar-preview.html`, html);
console.log(`✓ preview/dist/magyar-preview.html — ${(html.length / 1024).toFixed(0)} KB, built ${built} UTC`);
