/**
 * Feature switches.
 * AUDIO_ENABLED: pronunciation (recordings + system TTS) and the Dictation
 * exercise. Off until there is a Hungarian voice that handles single words
 * well — Piper swallowed short words, and the phone's own TTS has no
 * Hungarian voice. Candidates: Google Cloud TTS (hu-HU WaveNet), Azure,
 * human recordings from Wikimedia Commons. Flip to true, regenerate audio
 * with scripts/gen-audio.sh, rebuild.
 */
export const AUDIO_ENABLED = false;
