"use client";
import { useEffect, useState } from "react";
import { hungarianVoice } from "@/lib/tts";

/** Tells the learner why nothing is heard: no TTS at all, or no Hungarian voice. */
export function VoiceHint({ hasRecording = false }: { hasRecording?: boolean }) {
  const [state, setState] = useState<"unknown" | "ok" | "no-voice" | "none">("unknown");
  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setState("none");
      return;
    }
    const check = () => {
      const v = hungarianVoice();
      if (v === undefined) return; // voices not loaded yet
      setState(v ? "ok" : "no-voice");
    };
    check();
    window.speechSynthesis.addEventListener("voiceschanged", check);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", check);
  }, []);
  if (hasRecording || state === "ok" || state === "unknown") return null;
  return (
    <p className="muted" style={{ fontSize: 14, margin: "6px 0 10px" }}>
      {state === "none"
        ? "У цьому браузері нема озвучки."
        : "Угорського голосу нема, тому слова не озвучуються. Android: Налаштування → Мова → Синтез мовлення → додати угорську. Windows: Параметри → Час і мова → Мова → додати Magyar з функцією «Мовлення»."}
    </p>
  );
}
