# Synthesizes one WAV per line of "<id>\t<text>" on stdin into OUT_DIR, loading
# the Piper model once. Called by scripts/gen-audio.sh.
#   python scripts/gen-audio.py MODEL.onnx OUT_DIR < words.tsv
import sys
import wave
from pathlib import Path

from piper import PiperVoice

model, out = sys.argv[1], Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
voice = PiperVoice.load(model)
n = 0
for line in sys.stdin:
    line = line.rstrip("\n")
    if not line:
        continue
    item_id, text = line.split("\t", 1)
    with wave.open(str(out / f"{item_id}.wav"), "wb") as f:
        voice.synthesize_wav(text, f)
    n += 1
print(f"synthesized {n} file(s)", file=sys.stderr)
