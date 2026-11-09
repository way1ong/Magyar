"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SessionDone } from "@/components/SessionDone";
import { harmonyTaskById, type BuilderTask } from "@/lib/builder";
import { patternShort } from "@/lib/content";
import { compare, type Verdict } from "@/lib/dictation";
import { fillFrame, glossForFrame, splitFrame } from "@/lib/frames";
import { harmonyChoice } from "@/lib/harmony";
import { answer, Rating, sessionCards } from "@/lib/scheduler";
import { queueWrite } from "@/lib/writes";
import { getTypingMode, shouldType, type TypingMode } from "@/lib/settings";
import type { CardRow } from "@/lib/db";
import { seedCards } from "@/lib/seed";
import { speak } from "@/lib/tts";
import { HuInput } from "@/components/HuInput";

/** A typed answer faster than this counts as Easy (read the sentence + type). */
const FAST_TYPED_MS = 8000;

type Outcome = Verdict | "revealed";
const VERDICT_TEXT: Record<Outcome, string> = {
  exact: "Правильно!",
  accents: "Майже — перевір довгі голосні.",
  wrong: "Не так.",
  revealed: "Правильна відповідь:",
};

/**
 * Harmony game. Card = a curated (stem, suffix) task — the same verified
 * examples the Builder uses, so only real forms come up (postán, bankban),
 * shown in a short context sentence. Two answer modes:
 *  - buttons: pick the right harmony variant (right → Good, fast → Easy, wrong → Again);
 *  - typing (settings: auto for well-known cards / always / never): write the
 *    whole word; exact → Good/Easy, only vowel marks wrong → Hard, else Again.
 */
export default function HarmonyPage() {
  const [queue, setQueue] = useState<CardRow[] | null>(null);
  const [mode, setMode] = useState<TypingMode>("auto");
  const [i, setI] = useState(0);
  const [choice, setChoice] = useState<{ correct: string; options: string[] } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    await seedCards();
    setMode(await getTypingMode());
    const q = (await sessionCards("harmony", 20, 8)).filter((c) => harmonyTaskById(c.itemId));
    setQueue(q.sort(() => Math.random() - 0.5));
    setI(0);
    setScore({ right: 0, total: 0 });
    setPicked(null);
    setOutcome(null);
    shownAt.current = Date.now();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const row = queue?.[i];
  const task: BuilderTask | undefined = row ? harmonyTaskById(row.itemId) : undefined;
  const cardKey = row ? `${i}:${row.key}` : "";

  useEffect(() => {
    if (!task) return;
    setChoice(harmonyChoice(task.stem.hu, task.pattern, task.stem.harmony, task.stem.forms));
    setPicked(null);
    setTyped("");
    setOutcome(null);
    shownAt.current = Date.now();
  }, [task]);

  if (queue === null) return <p className="muted">Завантажую…</p>;

  if (!row || !task || !choice) {
    return <SessionDone title="Гармонія голосних" score={score} onAgain={load} />;
  }

  const typing = shouldType(mode, row);
  const done = typing ? outcome !== null : picked !== null;
  const { correct, options } = choice;
  const { stem, pattern, base, suffix, result, frame } = task;
  const stemNote = base !== stem.hu && base !== stem.hu.replace(/[ae]$/, (v) => (v === "a" ? "á" : "é"))
    ? ` (${stem.hu} → ${base}-)`
    : "";
  // The chosen variant and the ending actually written differ for -val/-vel
  // after a consonant (bor+val → borral) and for linking suffixes after a
  // vowel (autó+on → autón) — say so, or the answer looks unrelated to the buttons.
  const suffixNote = !typing && !pattern.inflect && suffix !== correct
    ? pattern.assimilates
      ? ` — -${correct} після приголосної: v уподібнюється (${base} + ${correct} → ${result})`
      : ` — після голосної -${correct} скорочується до -${suffix}`
    : "";
  const gap = frame ? splitFrame(frame.hu, `${stem.hu}-?`) : null;
  const uaLine = frame ? fillFrame(frame.ua, glossForFrame(task.ua)) : task.ua;
  const ok = typing ? outcome === "exact" : picked === correct;
  const color = !done ? undefined : ok ? "var(--ok)" : outcome === "accents" ? "var(--warn)" : "var(--bad)";

  const pick = async (v: string) => {
    if (done) return;
    setPicked(v);
    const took = Date.now() - shownAt.current;
    const right = v === correct;
    setScore((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }));
    queueWrite(() => answer(row, right ? (took < 2500 ? Rating.Easy : Rating.Good) : Rating.Again, took));
    if (right) speak(result);
  };

  const finish = async (o: Outcome) => {
    if (done) return;
    const took = Date.now() - shownAt.current;
    setOutcome(o);
    const right = o === "exact";
    setScore((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }));
    const rating =
      o === "exact" ? (took < FAST_TYPED_MS ? Rating.Easy : Rating.Good) : o === "accents" ? Rating.Hard : Rating.Again;
    queueWrite(() => answer(row, rating, took));
    if (right) speak(result);
  };

  const check = () => {
    if (!typed.trim()) return;
    finish(compare(typed, result));
  };

  const next = () => {
    setPicked(null);
    setOutcome(null);
    setI((n) => n + 1);
  };

  return (
    <>
      <div className="row">
        <span className="muted">{pattern.name}</span>
        <span className="grow" />
        <span className="muted">
          {i + 1} / {queue.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>

      <div className="card big">
        <p className="muted" style={{ margin: 0 }}>{patternShort(pattern, stem)}</p>
        {gap ? (
          <p className="hu" lang="hu" style={{ fontSize: 26 }}>
            {gap[0]}
            <b>
              {stem.hu}
              <span className="muted">-?</span>
            </b>
            {gap[2]}
          </p>
        ) : (
          <p className="hu">
            {stem.hu}
            <span className="muted">-?</span>
          </p>
        )}
        <p className="ua">{done ? uaLine : `${stem.ua} · ${uaLine}`}</p>
        {done && (
          <>
            {typing && outcome && (
              <p className="muted" style={{ margin: "0 0 4px", color }}>{VERDICT_TEXT[outcome]}</p>
            )}
            <p className="example" style={{ color }}>
              {frame ? fillFrame(frame.hu, result) : result}
              {stemNote}
              {!typing && picked !== correct && ` — правильно: -${correct}`}
              {suffixNote}
            </p>
            {typing && outcome === "wrong" && typed.trim() && (
              <p className="muted" style={{ fontSize: 15, margin: 0 }}>
                ти написав: <s>{typed}</s>
              </p>
            )}
          </>
        )}
      </div>

      {typing ? (
        <>
          <HuInput
            id="harmony-input"
            value={typed}
            onChange={setTyped}
            onEnter={() => (done ? next() : check())}
            disabled={done}
            done={done}
            focusKey={cardKey}
            placeholder={`${stem.hu}…`}
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
      ) : (
        <>
          {picked && (
            <button className="btn primary" onClick={next} style={{ marginBottom: 12 }} ref={(el) => el?.scrollIntoView({ block: "nearest" })}>
              Далі
            </button>
          )}
          <div className="choices" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 3)}, 1fr)` }}>
            {options.map((v) => {
              let cls = "btn";
              if (picked) {
                if (v === correct) cls += " right";
                else if (v === picked) cls += " wrong";
              }
              return (
                <button key={v} className={cls} onClick={() => pick(v)} disabled={!!picked}>
                  -{v}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
