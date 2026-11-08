import audio from "@content/audio.json";

/**
 * Pronunciation: a recorded file (Piper, /public/audio/<itemId>.mp3, listed
 * in content/audio.json) when the item has one, otherwise the system TTS
 * (Web Speech API; on Android the Google engine with a Hungarian voice).
 */
const recorded = new Set<string>(audio.ids);
const IS_PREVIEW = process.env.NEXT_PUBLIC_MAGYAR_PREVIEW === "1";

export const hasRecording = (itemId: string) => recorded.has(itemId);

let current: HTMLAudioElement | null = null;

/**
 * The preview build (a claude.ai artifact) may publish only a few hundred
 * files, so there the audio comes as one JSON per pack ({itemId: base64})
 * next to the page, fetched on first use. The app serves /audio/<id>.mp3.
 */
const bundles = new Map<string, Promise<Record<string, string>>>();
const blobUrls = new Map<string, string>();

async function previewUrl(itemId: string): Promise<string | null> {
  const cached = blobUrls.get(itemId);
  if (cached) return cached;
  const pack = itemId.slice(0, 5);
  let bundle = bundles.get(pack);
  if (!bundle) {
    bundle = fetch(`audio/${pack}.json`).then((r) => (r.ok ? r.json() : {}));
    bundles.set(pack, bundle);
  }
  const b64 = (await bundle)[itemId];
  if (!b64) return null;
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
  blobUrls.set(itemId, url);
  return url;
}

/** Play the recording of a content item. Resolves false if there is none or it fails. */
export async function playRecording(itemId: string): Promise<boolean> {
  if (typeof window === "undefined" || !recorded.has(itemId)) return false;
  const src = IS_PREVIEW ? await previewUrl(itemId) : `/audio/${itemId}.mp3`;
  if (!src) return false;
  return new Promise((resolve) => {
    current?.pause();
    const a = new Audio(src);
    current = a;
    a.onerror = () => resolve(false);
    a.play().then(() => resolve(true), () => resolve(false));
  });
}

/** Say a content item: its recording, else TTS of `text`. */
export async function speakItem(itemId: string, text: string) {
  if (await playRecording(itemId)) return true;
  return speak(text);
}
const isHungarian = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-").startsWith("hu");

/**
 * Is a Hungarian voice available? `null` while the voice list hasn't loaded
 * yet (some engines fill it asynchronously; iOS only after the first use).
 */
export function hungarianVoice(): SpeechSynthesisVoice | null | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return undefined;
  return voices.find(isHungarian) ?? null;
}

/**
 * Speak Hungarian. Refuses (returns false) when the device has voices but
 * none of them is Hungarian: hearing "ház" read by an English voice teaches
 * the wrong thing. With an empty voice list the engine picks by `lang`.
 */
export function speak(text: string, lang = "hu-HU") {
  const voice = hungarianVoice();
  if (voice === null) return false;
  current?.pause();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.85;
  try {
    if (voice) u.voice = voice;
  } catch {
    // Some engines reject the object; `lang` still lets them pick a voice.
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}
