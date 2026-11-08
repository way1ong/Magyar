"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { harmonyPatternsFor, itemById, patternShort } from "@/lib/content";
import { applyParts, endsWithVowel, harmonyChoice } from "@/lib/harmony";
import { answer, dueCards, Rating } from "@/lib/scheduler";
import type { CardRow } from "@/lib/db";
import type { Pattern } from "@/lib/types";
import { seedCards } from "@/lib/seed";
import { speak } from "@/lib/tts";

/**
 * Harmony game. Card = a stem (noun/adj with a known vowel class).
 * Each time it comes up, a random suffix pattern is drawn: pick the right form.
 * Right → Good (fast right → Easy), wrong → Again.
 */
export default function HarmonyPage() {
  const [queue, setQueue] = useState<CardRow[] | null>(null);
  const [i, setI] = useState(0);
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [choice, setChoice] = useState<{ correct: string; options: string[] } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    await seedCards();
    const q = await dueCards("harmony", 20, 8);
    setQueue(q.sort(() => Math.random() - 0.5));
    setI(0);
    setPicked(null);
    shownAt.current = Date.now();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const row = queue?.[i];
  const item = row ? itemById(row.itemId) : undefined;

  // Draw a pattern for the current stem. Skip linking-vowel suffixes for
  // vowel-final stems (there the answer is just "-n", not a harmony choice).
  useEffect(() => {
    if (!item) return;
    const pool = harmonyPatternsFor(item).filter((p) => !((p.linking || p.afterVowel) && endsWithVowel(item.hu)));
    const p = pool[Math.floor(Math.random() * pool.length)];
    setPattern(p);
    setChoice(item.harmony ? harmonyChoice(item.hu, p, item.harmony, item.forms) : null);
    setPicked(null);
    shownAt.current = Date.now();
  }, [item]);

  if (queue === null) return <p className="muted">Завантажую…</p>;

  if (!row || !item || !item.harmony || !pattern || !choice) {
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
  const { base, result } = applyParts(item.hu, pattern, item.harmony, item.forms);
  const stemNote = base !== item.hu && base !== item.hu.replace(/[ae]$/, (v) => (v === "a" ? "á" : "é"))
    ? ` (${item.hu} → ${base}-)`
    : "";

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
        <p className="muted" style={{ margin: 0 }}>{patternShort(pattern, item)}</p>
        <p className="hu">
          {item.hu}
          <span className="muted">-?</span>
        </p>
        <p className="ua">{item.ua}</p>
        {picked && (
          <p className="example" style={{ color: picked === correct ? "var(--ok)" : "var(--bad)" }}>
            {result}
            {stemNote}
            {picked !== correct && ` — правильно: -${correct}`}
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
