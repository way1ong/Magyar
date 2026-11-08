/**
 * Pronunciation via the system TTS (Web Speech API). On Android this is the
 * Google TTS engine, which has a Hungarian voice once it is installed. Later
 * this can be swapped for pre-generated Piper audio files in /public/audio.
 */
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
