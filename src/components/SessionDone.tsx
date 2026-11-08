"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Exercise } from "@/lib/db";
import { nextDue } from "@/lib/scheduler";

/**
 * End-of-session screen shared by the exercises. Besides the score it says
 * when the next card comes due, so "Ще раз" with nothing due does not look
 * broken, and offers to practise the soonest cards ahead of time.
 */
interface Props {
  title: string;
  /** Right/total for graded drills, or just the number of cards done (flashcards). */
  score: { right: number; total: number } | number;
  exercises: Exercise[];
  /** Load the cards that are due now. */
  onAgain: () => void;
  /** Load the soonest cards even though they are not due yet. */
  onAhead: () => void;
}

export function formatWait(ms: number): string {
  const min = Math.ceil(ms / 60000);
  if (min < 1) return "менш як за хвилину";
  if (min < 60) return `через ${min} хв`;
  const h = Math.round(min / 60);
  if (h < 24) return `через ${h} год`;
  const d = Math.round(h / 24);
  return d === 1 ? "завтра" : `через ${d} ${d < 5 ? "дні" : "днів"}`;
}

export function SessionDone({ title, score, exercises, onAgain, onAhead }: Props) {
  const [next, setNext] = useState<number | null | undefined>(undefined);
  const key = exercises.join(",");
  useEffect(() => {
    let alive = true;
    nextDue(key.split(",") as Exercise[]).then((t) => alive && setNext(t ?? null));
    return () => {
      alive = false;
    };
  }, [key]);

  const dueNow = next !== undefined && next !== null && next <= Date.now();
  return (
    <>
      <h1 className="title">{title}</h1>
      <div className="card big">
        <p className="hu">{typeof score === "object" && score.total ? `${score.right} / ${score.total}` : "✓"}</p>
        <p className="muted">
          {typeof score === "number"
            ? score
              ? `Зроблено ${score}.`
              : "Зараз нічого не назбиралось."
            : score.total
              ? "Сесію завершено."
              : "Зараз нічого не назбиралось."}
        </p>
        {next === null && <p className="example">Усі картки нові або ще не почались.</p>}
        {next && !dueNow && <p className="example">Наступні картки {formatWait(next - Date.now())}.</p>}
      </div>
      <Link href="/" className="btn">На головну</Link>
      <button className="btn ghost" onClick={onAgain} style={{ marginTop: 8 }}>
        Ще раз{dueNow ? "" : " (що вже на черзі)"}
      </button>
      <button className="btn ghost" onClick={onAhead} style={{ marginTop: 8 }}>
        Пройти наперед
      </button>
    </>
  );
}
