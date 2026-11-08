import audio from "@content/audio.json";

/**
 * Pronunciation: a recorded file (Piper, /public/audio/<itemId>.mp3, listed
 * in content/audio.json) when the item has one, otherwise the system TTS
 * (Web Speech API; on Android the Google engine with a Hungarian voice).
 */
const recorded = new Set<string>(audio.ids);
/** Preview build serves audio next to the page; the app serves it from the root. */
const AUDIO_BASE = process.env.NEXT_PUBLIC_MAGYAR_PREVIEW === "1" ? "audio/" : "/audio/";

export const hasRecording = (itemId: string) => recorded.has(itemId);

let current: HTMLAudioElement | null = null;

/** Play the recording of a content item. Resolves false if there is none or it fails. */
export function playRecording(itemId: string): Promise<boolean> {
  if (typeof window === "undefined" || !recorded.has(itemId)) return Promise.resolve(false);
  return new Promise((resolve) => {
    current?.pause();
    const a = new Audio(`${AUDIO_BASE}${itemId}.mp3`);
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
