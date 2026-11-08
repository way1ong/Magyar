"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { itemById } from "@/lib/content";
import { answer, dueCards, previewIntervals, Rating, type Grade } from "@/lib/scheduler";
import type { CardRow } from "@/lib/db";
import { seedCards } from "@/lib/seed";
import { speak } from "@/lib/tts";

/** One session: due "recognize" (HU→UA) and "recall" (UA→HU) cards, shuffled together. */
export default function ReviewPage() {
  const [queue, setQueue] = useState<CardRow[] | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    await seedCards();
    const [a, b] = await Promise.all([dueCards("recognize", 15, 6), dueCards("recall", 15, 6)]);
    const all = [...a, ...b].sort(() => Math.random() - 0.5);
    setQueue(all);
    setI(0);
    setFlipped(false);
    shownAt.current = Date.now();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const row = queue?.[i];
  const item = row ? itemById(row.itemId) : undefined;

  const grade = async (g: Grade) => {
    if (!row) return;
    await answer(row, g, Date.now() - shownAt.current);
    setDone((d) => d + 1);
    setFlipped(false);
    shownAt.current = Date.now();
    setI((n) => n + 1);
  };

  if (queue === null) return <p className="muted">Завантажую…</p>;

  if (!row || !item) {
    return (
      <>
        <h1 className="title">Картки</h1>
        <div className="card big">
          <p className="hu">✓</p>
          <p className="ua">{done ? `Зроблено ${done}` : "Нічого не назбиралось"}</p>
          <p className="muted">Наступні картки зʼявляться, коли настане їхній час.</p>
        </div>
        <Link href="/" className="btn">На головну</Link>
        <button className="btn ghost" onClick={load} style={{ marginTop: 8 }}>
          Перевірити ще раз
        </button>
      </>
    );
  }

  const front = row.exercise === "recognize" ? item.hu : item.ua;
  const back = row.exercise === "recognize" ? item.ua : item.hu;
  const intervals = previewIntervals(row);

  return (
    <>
      <div className="row">
        <span className="muted">{row.exercise === "recognize" ? "HU → UA" : "UA → HU"}</span>
        <span className="grow" />
        <span className="muted">
          {i + 1} / {queue.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>

      <button className="card big" onClick={() => setFlipped(true)} style={{ width: "100%", cursor: "pointer" }}>
        <p className="hu">{front}</p>
        {flipped && (
          <>
            <p className="ua">{back}</p>
            {item.example && (
              <p className="example">
                {item.example.hu}
                <br />
                {item.example.ua}
              </p>
            )}
          </>
        )}
        {!flipped && <p className="muted" style={{ marginTop: 16 }}>торкнись, щоб відкрити</p>}
      </button>

      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn ghost" onClick={() => speak(item.hu)}>
          🔊 Вимова
        </button>
      </div>

      {flipped ? (
        <div className="grade">
          <button className="btn again" onClick={() => grade(Rating.Again)}>
            Ні <small>{intervals[Rating.Again]}</small>
          </button>
          <button className="btn hard" onClick={() => grade(Rating.Hard)}>
            Важко <small>{intervals[Rating.Hard]}</small>
          </button>
          <button className="btn good" onClick={() => grade(Rating.Good)}>
            Так <small>{intervals[Rating.Good]}</small>
          </button>
          <button className="btn" onClick={() => grade(Rating.Easy)}>
            Легко <small>{intervals[Rating.Easy]}</small>
          </button>
        </div>
      ) : (
        <button className="btn primary" onClick={() => setFlipped(true)}>
          Показати відповідь
        </button>
      )}
    </>
  );
}
