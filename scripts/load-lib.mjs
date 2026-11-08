// Loads src/lib modules for Node scripts by bundling them with esbuild
// (the app's TS imports have no extensions and use the @/ aliases).
import { build } from "esbuild";
import { createRequire } from "node:module";
import vm from "node:vm";

export async function loadLib(entry = "src/lib/harmony.ts") {
  const root = new URL("..", import.meta.url).pathname;
  const { outputFiles } = await build({
    entryPoints: [entry],
    absWorkingDir: root,
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    alias: { "@": "./src", "@content": "./content" },
    logLevel: "error",
  });
  const module = { exports: {} };
  vm.runInNewContext(outputFiles[0].text, { module, exports: module.exports, require: createRequire(import.meta.url), process, console });
  return module.exports;
}
