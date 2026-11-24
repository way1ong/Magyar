"use client";
import type { ReactNode } from "react";

/**
 * Answer options of a multiple-choice drill stay hidden until asked for:
 * first recall the answer, then check it among the options. The page keeps
 * `shown` per question and resets it for the next one; once answered, the
 * options are always visible.
 */
export function RevealOptions({ shown, onShow, hint = "Спершу згадай відповідь сам, потім відкрий варіанти.", children }: { shown: boolean; onShow: () => void; hint?: string; children: ReactNode }) {
  if (shown) return <>{children}</>;
  return (
    <>
      <p className="muted" style={{ textAlign: "center", fontSize: 14, margin: "0 0 8px" }}>
        {hint}
      </p>
      <button className="btn primary" onClick={onShow}>
        Показати варіанти
      </button>
    </>
  );
}
