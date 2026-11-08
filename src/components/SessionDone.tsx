"use client";
import Link from "next/link";

/**
 * End-of-session screen shared by the exercises. "Ще раз" always starts a
 * new batch (see sessionCards): due cards, then new ones, then the soonest
 * ahead of schedule — the learner never has to wait for the clock.
 */
interface Props {
  title: string;
  /** Right/total for graded drills, or just the number of cards done (flashcards). */
  score: { right: number; total: number } | number;
  onAgain: () => void;
}

export function SessionDone({ title, score, onAgain }: Props) {
  const total = typeof score === "number" ? score : score.total;
  return (
    <>
      <h1 className="title">{title}</h1>
      <div className="card big">
        <p className="hu">{typeof score === "object" && score.total ? `${score.right} / ${score.total}` : "✓"}</p>
        <p className="muted">
          {total ? (typeof score === "number" ? `Зроблено ${score}.` : "Сесію завершено.") : "У цій вправі поки нема карток."}
        </p>
      </div>
      <button className="btn primary" onClick={onAgain}>
        Ще раз
      </button>
      <Link href="/" className="btn ghost" style={{ marginTop: 8 }}>
        На головну
      </Link>
    </>
  );
}
