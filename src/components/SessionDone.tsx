"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DAY_PLAN, dayDone, markDayStep, nextDayStep, type DayStep } from "@/lib/day";

/**
 * End-of-session screen shared by the exercises. "Ще раз" always starts a
 * new batch (see sessionCards): due cards, then new ones, then the soonest
 * ahead of schedule — the learner never has to wait for the clock. A finished
 * session ticks the exercise off today's plan and offers the next step.
 */
interface Props {
  title: string;
  /** Right/total for graded drills, or just the number of cards done (flashcards). */
  score: { right: number; total: number } | number;
  onAgain: () => void;
  /** Which step of the day's plan this exercise is. */
  step?: DayStep;
  /** The session was a rerun of recent mistakes. */
  mistakes?: boolean;
  /** Nothing to do yet because readiness holds the new cards back (readiness.ts): shown instead of the score; the step still counts as done. */
  heldBack?: string;
}

export function SessionDone({ title, score, onAgain, step, mistakes, heldBack }: Props) {
  const total = typeof score === "number" ? score : score.total;
  const [next, setNext] = useState<(typeof DAY_PLAN)[number] | null | undefined>(undefined);
  useEffect(() => {
    if (!step || (!total && !heldBack)) return;
    let alive = true;
    (mistakes ? dayDone() : markDayStep(step)).then((done) => alive && setNext(nextDayStep(done)));
    return () => {
      alive = false;
    };
  }, [step, total, mistakes, heldBack]);
  return (
    <>
      <h1 className="title">{title}</h1>
      <div className="card big">
        <p className="hu">{typeof score === "object" && score.total ? `${score.right} / ${score.total}` : !total && heldBack ? "⏳" : "✓"}</p>
        <p className="muted">
          {total ? (typeof score === "number" ? `Зроблено ${score}.` : "Сесію завершено.") : mistakes ? "Помилок у цій вправі за тиждень нема." : heldBack ?? "У цій вправі поки нема карток."}
        </p>
        {!total && heldBack && (
          <Link href="/review" className="btn primary" style={{ marginTop: 10 }}>
            🃏 До «Карток»
          </Link>
        )}
        {next === null && total > 0 && !mistakes && <p className="example">План дня виконано 🎉</p>}
      </div>
      {next && (
        <Link href={next.href} className="btn primary" style={{ marginBottom: 8 }}>
          Далі за планом: {next.icon} {next.label}
        </Link>
      )}
      <button className={next ? "btn" : "btn primary"} onClick={onAgain}>
        Ще раз
      </button>
      <Link href="/" className="btn ghost" style={{ marginTop: 8 }}>
        На головну
      </Link>
    </>
  );
}
