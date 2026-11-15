"use client";
import Link from "next/link";
import type { PTopic } from "@/lib/personal";

/**
 * End-of-session screen for the personal topics: no day plan here, just the
 * score, another round, and the way back to the topic.
 */
interface Props {
  title: string;
  topic: PTopic;
  score: { right: number; total: number } | number;
  onAgain: () => void;
  mistakes?: boolean;
  /** Nothing to practise yet because the level is still closed. */
  locked?: string;
}

export function PersonalDone({ title, topic, score, onAgain, mistakes, locked }: Props) {
  const total = typeof score === "number" ? score : score.total;
  return (
    <>
      <h1 className="title">{title}</h1>
      <div className="card big">
        <p className="hu">{typeof score === "object" && score.total ? `${score.right} / ${score.total}` : !total && locked ? "🔒" : "✓"}</p>
        <p className="muted">
          {total ? (typeof score === "number" ? `Зроблено ${score}.` : "Сесію завершено.") : mistakes ? "Помилок у цій вправі за тиждень нема." : locked ?? "У цій вправі поки нема карток."}
        </p>
      </div>
      {total > 0 && (
        <button className="btn primary" onClick={onAgain} style={{ marginBottom: 8 }}>
          Ще раз
        </button>
      )}
      <Link href="/personal/topic" className={total ? "btn" : "btn primary"}>
        {topic.icon} До теми «{topic.title}»
      </Link>
      <Link href="/" className="btn ghost" style={{ marginTop: 8 }}>
        На головну
      </Link>
    </>
  );
}
