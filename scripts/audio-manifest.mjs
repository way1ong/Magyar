// Rebuilds content/audio.json: the item ids that have public/audio/<id>.mp3.
// The app bundles this list so it knows when to play a file instead of TTS.
import { readdirSync, writeFileSync } from "node:fs";
const ids = readdirSync(new URL("../public/audio/", import.meta.url))
  .filter((f) => f.endsWith(".mp3"))
  .map((f) => f.slice(0, -4))
  .sort();
writeFileSync(new URL("../content/audio.json", import.meta.url), JSON.stringify({ voice: "piper hu_HU-anna-medium", ids }, null, 2) + "\n");
console.log(`✓ content/audio.json: ${ids.length} audio file(s)`);
