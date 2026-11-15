"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PersonalDone } from "@/components/PersonalDone";
import { currentTopic, pAnswer, pItemById, pMistakeCards, pSessionCards, PLEVEL_TITLES, seedPersonal, shuffle, takeLevel, takePMistakes, type PTopic } from "@/lib/personal";
import { previewIntervals, Rating, type Grade } from "@/lib/scheduler";
import { queueWrite } from "@/lib/writes";
import type { PCardRow } from "@/lib/db";

/** Flashcards of a personal topic: HU→UA and UA→HU of one level, shuffled together. */
export default function PersonalCardsPage() {
  const [topic] = useState<PTopic | undefined>(() => (typeof window === "undefined" ? undefined : currentTopic()));
  const [level, setLevelState] = useState<1 | 2>(1);
  const [queue, setQueue] = useState<PCardRow[] | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [mistakes, setMistakes] = useState(false);
  const [locked, setLocked] = useState(false);
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    if (!topic) return;
    await seedPersonal();
    const lv = takeLevel();
    setLevelState(lv);
    const mm = takePMistakes("cards");
    setMistakes(mm);
    const q = mm
      ? await pMistakeCards(topic, ["recognize", "recall"])
      : [...(await pSessionCards(topic, "recognize", { level: lv, limit: 12, newLimit: 6, minimum: 6 })), ...(await pSessionCards(topic, "recall", { level: lv, limit: 12, newLimit: 6, minimum: 6 }))];
    setLocked(!q.length && !mm && lv === 2);
    setQueue(shuffle(q.filter((c) => pItemById(c.itemId))));
    setI(0);
    setDone(0);
    setFlipped(false);
    shownAt.current = Date.now();
  }, [topic]);

  useEffect(() => {
    load();
  }, [load]);

  if (!topic) return <p className="muted">Тему не вибрано.</p>;
  const row = queue?.[i];
  const item = row ? pItemById(row.itemId) : undefined;

  const grade = (g: Grade) => {
    if (!row) return;
    const took = Date.now() - shownAt.current;
    queueWrite(() => pAnswer(row, g, took));
    setDone((d) => d + 1);
    setFlipped(false);
    shownAt.current = Date.now();
    setI((n) => n + 1);
  };

  if (queue === null) return <p className="muted">Завантажую…</p>;
  if (!row || !item) {
    return <PersonalDone title={`Картки · ${PLEVEL_TITLES[level]}`} topic={topic} score={done} onAgain={load} mistakes={mistakes} locked={locked ? "Рівень фраз ще закритий: спершу переглянь половину слів у «Картках»." : undefined} />;
  }

  const front = row.exercise === "recognize" ? item.hu : item.ua;
  const back = row.exercise === "recognize" ? item.ua : item.hu;
  const intervals = previewIntervals(row);

  return (
    <>
      <div className="row">
        <span className="muted">
          {topic.icon} {row.exercise === "recognize" ? "Що це означає?" : "Як це угорською?"}
        </span>
        <span className="grow" />
        <span className="muted">
          {i + 1} / {queue.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>

      <button className="card big" onClick={() => setFlipped(true)} style={{ width: "100%", cursor: "pointer" }}>
        <p className="hu" lang={row.exercise === "recognize" ? "hu" : "uk"} style={item.level === 2 ? { fontSize: 26 } : undefined}>
          {front}
        </p>
        {flipped && (
          <>
            <p className="ua" lang={row.exercise === "recognize" ? "uk" : "hu"}>
              {item.check && "⚠ "}
              {back}
            </p>
            {item.example && (
              <p className="example">
                {item.example.hu}
                <br />
                {item.example.ua}
              </p>
            )}
            {item.note && <p className="muted" style={{ fontSize: 14, margin: "6px 0 0" }}>{item.note}</p>}
          </>
        )}
        {!flipped && <p className="muted" style={{ marginTop: 16 }}>торкнись, щоб відкрити</p>}
      </button>

      {flipped ? (
        <>
          <div className="grade">
            <button className="btn again" onClick={() => grade(Rating.Again)}>
              Не знаю <small>{intervals[Rating.Again]}</small>
            </button>
            <button className="btn hard" onClick={() => grade(Rating.Hard)}>
              Важко <small>{intervals[Rating.Hard]}</small>
            </button>
            <button className="btn good" onClick={() => grade(Rating.Good)}>
              Знаю <small>{intervals[Rating.Good]}</small>
            </button>
            <button className="btn" onClick={() => grade(Rating.Easy)}>
              Легко <small>{intervals[Rating.Easy]}</small>
            </button>
          </div>
          <p className="muted" style={{ fontSize: 13, textAlign: "center", margin: "8px 0 0" }}>
            Під кнопкою — через скільки картка повернеться.
          </p>
        </>
      ) : (
        <button className="btn primary" onClick={() => setFlipped(true)}>
          Показати відповідь
        </button>
      )}
    </>
  );
}
