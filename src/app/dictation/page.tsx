"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { itemById } from "@/lib/content";
import { compare, type Verdict } from "@/lib/dictation";
import { HuInput } from "@/components/HuInput";
import { shuffle } from "@/lib/builder";
import { answer, dueCards, Rating } from "@/lib/scheduler";
import type { CardRow } from "@/lib/db";
import { seedCards } from "@/lib/seed";
import { speakItem } from "@/lib/tts";
import { VoiceHint } from "@/components/VoiceHint";
import { AUDIO_ENABLED } from "@/lib/config";
import { hasRecording } from "@/lib/tts";

/** An exact answer faster than this counts as Easy (listen + type). */
const FAST_MS = 8000;

type Outcome = Verdict | "revealed";

const VERDICT_TEXT: Record<Outcome, string> = {
  exact: "Правильно!",
  accents: "Майже — перевір довгі голосні.",
  wrong: "Не так.",
  revealed: "Правильна відповідь:",
};

/**
 * Dictation. Card = a content item. The word is spoken by the system TTS;
 * type it. Exact → Good (fast → Easy), only diacritics wrong → Hard,
 * wrong or revealed → Again.
 */
export default function DictationPage() {
  const [queue, setQueue] = useState<CardRow[] | null>(null);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    await seedCards();
    const q = (await dueCards("dictation", 20, 8)).filter((r) => itemById(r.itemId));
    setQueue(shuffle(q));
    setI(0);
    setScore({ right: 0, total: 0 });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const row = queue?.[i];
  const item = row ? itemById(row.itemId) : undefined;
  const cardKey = row ? `${i}:${row.key}` : "";

  // New card: speak it, clear the input, focus.
  useEffect(() => {
    if (!item) return;
    setTyped("");
    setOutcome(null);
    shownAt.current = Date.now();
    speakItem(item.id, item.hu);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cardKey identifies the card
  }, [cardKey]);

  if (!AUDIO_ENABLED) {
    return (
      <>
        <h1 className="title">Диктант</h1>
        <div className="card big">
          <p className="hu">🔇</p>
          <p className="muted">Диктант вимкнено, поки нема якісної угорської озвучки.</p>
        </div>
        <Link href="/" className="btn">На головну</Link>
      </>
    );
  }

  if (queue === null) return <p className="muted">Завантажую…</p>;

  if (!row || !item) {
    return (
      <>
        <h1 className="title">Диктант</h1>
        <div className="card big">
          <p className="hu">{score.total ? `${score.right} / ${score.total}` : "✓"}</p>
          <p className="muted">
            {score.total ? "Сесію завершено." : "Нічого не назбиралось — зайди пізніше."}
          </p>
        </div>
        <Link href="/" className="btn">На головну</Link>
        <button className="btn ghost" onClick={load} style={{ marginTop: 8 }}>
          Ще раз
        </button>
      </>
    );
  }

  const done = outcome !== null;

  const finish = async (o: Outcome) => {
    if (done) return;
    const took = Date.now() - shownAt.current;
    setOutcome(o);
    const ok = o === "exact";
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
    const rating =
      o === "exact" ? (took < FAST_MS ? Rating.Easy : Rating.Good) : o === "accents" ? Rating.Hard : Rating.Again;
    await answer(row, rating, took);
  };

  const check = () => {
    if (!typed.trim()) return;
    finish(compare(typed, item.hu));
  };

  const next = () => {
    setOutcome(null);
    setI((n) => n + 1);
  };

  const color =
    outcome === "exact" ? "var(--ok)" : outcome === "accents" ? "var(--warn)" : "var(--bad)";

  return (
    <>
      <div className="row">
        <span className="muted">Послухай і напиши</span>
        <span className="grow" />
        <span className="muted">
          {i + 1} / {queue.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>

      <div className="card" style={{ textAlign: "center" }}>
        <button className="btn" onClick={() => speakItem(item.id, item.hu)} style={{ fontSize: 22, minHeight: 72 }}>
          🔊 Послухати ще раз
        </button>
        <VoiceHint hasRecording={hasRecording(item.id)} />
        {done && (
          <div style={{ marginTop: 14 }}>
            <p className="muted" style={{ margin: 0, color }}>{VERDICT_TEXT[outcome]}</p>
            <p className="hu" style={{ fontSize: 30, color }}>{item.hu}</p>
            <p className="ua" style={{ marginTop: 4 }}>{item.ua}</p>
            {outcome === "wrong" && typed.trim() && (
              <p className="muted" style={{ fontSize: 15 }}>
                ти написав: <s>{typed}</s>
              </p>
            )}
          </div>
        )}
      </div>

      <HuInput
        id="dictation-input"
        value={typed}
        onChange={setTyped}
        onEnter={() => (done ? next() : check())}
        disabled={done}
        done={done}
        focusKey={cardKey}
      />

      {done ? (
        <button className="btn primary" onClick={next}>
          Далі
        </button>
      ) : (
        <div className="row">
          <button className="btn ghost" onClick={() => finish("revealed")}>
            Показати
          </button>
          <button className="btn primary" onClick={check} disabled={!typed.trim()}>
            Перевірити
          </button>
        </div>
      )}
    </>
  );
}
