"use client";
import { useWriteState } from "@/lib/writes";

/** Banner above the tab bar when an answer could not be saved. */
export function WriteStatus() {
  const state = useWriteState();
  if (!state.startsWith("error:")) return null;
  return (
    <div className="write-status" role="alert">
      Відповідь не збереглась: {state.slice(6)}. Перезавантаж застосунок — прогрес до цього моменту на місці.
      <button className="btn" onClick={() => window.location.reload()} style={{ marginTop: 8 }}>
        Перезавантажити
      </button>
    </div>
  );
}
