/**
 * Pronunciation via the system TTS (Web Speech API). On Android this is the
 * Google TTS engine, which has a Hungarian voice. Later this can be swapped
 * for pre-generated Piper audio files in /public/audio.
 */
export function speak(text: string, lang = "hu-HU") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.9;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("hu"));
  if (voice) u.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}
