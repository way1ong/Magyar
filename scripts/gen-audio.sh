#!/usr/bin/env bash
# Generates pronunciation audio with Piper (hu_HU-anna-medium) + ffmpeg.
#   scripts/gen-audio.sh [pack-id ...]        # default: every pack
# Needs: python3 -m venv .piper && .piper/bin/pip install piper-tts; ffmpeg;
# the voice model in .piper/model/ (hu_HU-anna-medium.onnx + .onnx.json from
# https://huggingface.co/rhasspy/piper-voices/tree/main/hu/hu_HU/anna/medium).
# Skips items that already have public/audio/<id>.mp3 and items whose `hu`
# has alternatives or gaps ("kettő / két", "Hol van a ...?"). Then rebuilds
# content/audio.json (the manifest the app ships).
set -euo pipefail
cd "$(dirname "$0")/.."
PIPER=${PIPER:-.piper/bin/piper}
MODEL=${MODEL:-.piper/model/hu_HU-anna-medium.onnx}
mkdir -p public/audio
tmp=$(mktemp -d)
node --no-warnings -e '
  const fs = require("node:fs");
  const packs = process.argv.slice(1);
  for (const f of fs.readdirSync("content").filter((f) => /^a\d-\d\d\.json$/.test(f))) {
    const p = JSON.parse(fs.readFileSync("content/" + f, "utf8"));
    if (packs.length && !packs.includes(p.id)) continue;
    for (const i of p.items) if (!/[/…]|\.\.\./.test(i.hu) && !fs.existsSync(`public/audio/${i.id}.mp3`)) console.log(`${i.id}\t${i.hu}`);
  }' "$@" > "$tmp/words.tsv"
n=0
while IFS=$'\t' read -r id text; do
  printf '%s' "$text" | "$PIPER" -m "$MODEL" -f "$tmp/$id.wav" >/dev/null 2>&1
  ffmpeg -hide_banner -loglevel error -y -i "$tmp/$id.wav" -ac 1 -ar 22050 -codec:a libmp3lame -b:a 32k "public/audio/$id.mp3"
  n=$((n + 1))
done < "$tmp/words.tsv"
rm -rf "$tmp"
node scripts/audio-manifest.mjs
echo "generated $n file(s)"
