"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { harmonyTaskById, type BuilderTask } from "@/lib/builder";
import { patternShort } from "@/lib/content";
import { fillFrame, glossForFrame, splitFrame } from "@/lib/frames";
import { harmonyChoice } from "@/lib/harmony";
import { answer, dueCards, Rating } from "@/lib/scheduler";
import type { CardRow } from "@/lib/db";
import { seedCards } from "@/lib/seed";
import { speak } from "@/lib/tts";

/**
 * Harmony game. Card = a curated (stem, suffix) task — the same verified
 * examples the Builder uses, so only real forms come up (postán, bankban),
 * shown in a short context sentence. Pick the right harmony variant.
 * Right → Good (fast right → Easy), wrong → Again.
 */
export default function HarmonyPage() {
  const [queue, setQueue] = useState<CardRow[] | null>(null);
  const [i, setI] = useState(0);
  const [choice, setChoice] = useState<{ correct: string; options: string[] } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    await seedCards();
    const q = (await dueCards("harmony", 20, 8)).filter((c) => harmonyTaskById(c.itemId));
    setQueue(q.sort(() => Math.random() - 0.5));
    setI(0);
    setPicked(null);
    shownAt.current = Date.now();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const row = queue?.[i];
  const task: BuilderTask | undefined = row ? harmonyTaskById(row.itemId) : undefined;

  useEffect(() => {
    if (!task) return;
    setChoice(harmonyChoice(task.stem.hu, task.pattern, task.stem.harmony, task.stem.forms));
    setPicked(null);
    shownAt.current = Date.now();
  }, [task]);

  if (queue === null) return <p className="muted">Завантажую…</p>;

  if (!row || !task || !choice) {
    return (
      <>
        <h1 className="title">Гармонія голосних</h1>
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

  const { correct, options } = choice;
  const { stem, pattern, base, suffix, result, frame } = task;
  const stemNote = base !== stem.hu && base !== stem.hu.replace(/[ae]$/, (v) => (v === "a" ? "á" : "é"))
    ? ` (${stem.hu} → ${base}-)`
    : "";
  // The chosen variant and the ending actually written differ for -val/-vel
  // after a consonant (bor+val → borral) and for linking suffixes after a
  // vowel (autó+on → autón) — say so, or the answer looks unrelated to the buttons.
  const suffixNote = !pattern.inflect && suffix !== correct
    ? pattern.assimilates
      ? ` — -${correct} після приголосної: v уподібнюється (${base} + ${correct} → ${result})`
      : ` — після голосної -${correct} скорочується до -${suffix}`
    : "";
  const gap = frame ? splitFrame(frame.hu, `${stem.hu}-?`) : null;
  const uaLine = frame ? fillFrame(frame.ua, glossForFrame(task.ua)) : task.ua;

  const pick = async (v: string) => {
    if (picked) return;
    setPicked(v);
    const took = Date.now() - shownAt.current;
    const ok = v === correct;
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
    await answer(row, ok ? (took < 2500 ? Rating.Easy : Rating.Good) : Rating.Again, took);
    if (ok) speak(result);
  };

  const next = () => {
    setPicked(null);
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
        <p className="ua">{picked ? uaLine : `${stem.ua} · ${uaLine}`}</p>
        {picked && (
          <p className="example" style={{ color: picked === correct ? "var(--ok)" : "var(--bad)" }}>
            {frame ? fillFrame(frame.hu, result) : result}
            {stemNote}
            {picked !== correct && ` — правильно: -${correct}`}
            {suffixNote}
          </p>
        )}
      </div>

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

      {picked && (
        <button className="btn primary" onClick={next} style={{ marginTop: 12 }}>
          Далі
        </button>
      )}
    </>
  );
}
