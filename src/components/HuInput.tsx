"use client";
import { useEffect, useRef, useState } from "react";
import { ACCENTS } from "@/lib/dictation";

/** Compact Hungarian keyboard for phones without a Latin layout. */
const KEYBOARD = [
  ["q", "w", "e", "r", "t", "z", "u", "i", "o", "p", "ő", "ú"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "é", "á", "ű"],
  ["y", "x", "c", "v", "b", "n", "m", "ö", "ü", "ó", "í"],
];

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  /** Enter pressed (the caller decides: check or go on). */
  onEnter: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Change this to clear focus onto the input again (e.g. the card key). */
  focusKey?: string;
  /** Hide the helpers (accent row / keyboard), e.g. once the answer is shown. */
  done?: boolean;
}

/**
 * Text input for Hungarian answers with the letters a Ukrainian keyboard
 * lacks as tap-to-insert buttons, and an optional full on-screen Hungarian
 * keyboard (for phones without a Latin layout). Shared by Dictation and the
 * Harmony typing mode.
 */
export function HuInput({ id, value, onChange, onEnter, disabled, placeholder, focusKey, done }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [keyboard, setKeyboard] = useState(false);

  useEffect(() => {
    if (!keyboard) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focusKey identifies the card
  }, [focusKey]);

  /** Insert a letter at the caret and keep the caret after it ("" = backspace). */
  const insert = (ch: string) => {
    const el = inputRef.current;
    const s = el?.selectionStart ?? value.length;
    const e = el?.selectionEnd ?? s;
    const from = ch === "" && s === e ? Math.max(0, s - 1) : s;
    const next = value.slice(0, from) + ch + value.slice(e);
    const caret = from + ch.length;
    onChange(next);
    // With the on-screen keyboard open, keep the phone's own keyboard closed.
    if (keyboard) return;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        lang="hu"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          onEnter();
        }}
        placeholder={placeholder ?? "Напиши угорською…"}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        readOnly={disabled || keyboard}
        aria-disabled={disabled}
        className={`dictation-input${disabled ? " done" : ""}`}
        inputMode={keyboard ? "none" : "text"}
        aria-label="Відповідь угорською"
      />

      {!done && !keyboard && (
        <>
          <p className="muted" style={{ fontSize: 13, margin: "6px 0 4px" }}>
            Літери, яких нема на клавіатурі; решту — з латинської розкладки, або{" "}
            <button type="button" className="linkish" onClick={() => setKeyboard(true)}>
              відкрий угорську клавіатуру
            </button>
          </p>
          <div className="accents" aria-label="Угорські літери">
            {ACCENTS.map((ch) => (
              <button key={ch} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(ch)}>
                {ch}
              </button>
            ))}
          </div>
        </>
      )}
      {!done && keyboard && (
        <div className="hu-keyboard" aria-label="Угорська клавіатура">
          {KEYBOARD.map((row, r) => (
            <div className="hu-row" key={r}>
              {row.map((ch) => (
                <button key={ch} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(ch)}>
                  {ch}
                </button>
              ))}
            </div>
          ))}
          <div className="hu-row">
            <button type="button" className="wide" onMouseDown={(e) => e.preventDefault()} onClick={() => setKeyboard(false)}>
              сховати
            </button>
            <button type="button" className="wide space" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(" ")}>
              пробіл
            </button>
            <button type="button" className="wide" onMouseDown={(e) => e.preventDefault()} onClick={() => insert("")}>
              ⌫
            </button>
          </div>
        </div>
      )}
    </>
  );
}
