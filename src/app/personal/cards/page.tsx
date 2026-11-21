"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PersonalDone } from "@/components/PersonalDone";
import { AltLine, CtxLine } from "@/components/CtxLine";
import { ResumeOffer } from "@/components/ResumeOffer";
import { clearSeries, isScore, restoreSeries, useRememberSeries, useResumeOffer, type SavedSeries } from "@/lib/resume";
import { currentTopic, pAnswer, pItemById, pMistakeCards, pSessionCards, PLEVEL_TITLES, pMistakesRequested, seedPersonal, shuffle, takeLevel, takePMistakes, topicOf, type PTopic } from "@/lib/personal";
import { previewIntervals, Rating, type Grade } from "@/lib/scheduler";
import { queueWrite } from "@/lib/writes";
import { db, type PCardRow } from "@/lib/db";

/** Flashcards of a personal topic: HU→UA and UA→HU of one level, shuffled together. */
export default function PersonalCardsPage() {
  // Read on the client after mounting, so the prerendered page and the first client render match.
  const [topic, setTopic] = useState<PTopic | null | undefined>(undefined);
  // The saved series belongs to this topic (and level): another topic starts its own.
  const [series, setSeries] = useState<string | null>(null);
  useEffect(() => {
    const t = currentTopic() ?? null;
    setTopic(t);
    setSeries(t ? `pcards:${t.id}:${takeLevel()}` : null);
  }, []);
  const [level, setLevelState] = useState<1 | 2>(1);
  const [queue, setQueue] = useState<PCardRow[] | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [mistakes, setMistakes] = useState(false);
  const [locked, setLocked] = useState(false);
  const shownAt = useRef(Date.now());

  // A fresh series, or the saved unfinished one (lib/resume.ts).
  const start = useCallback(async (saved: SavedSeries | null) => {
    if (!topic) return;
    await seedPersonal();
    const lv = takeLevel();
    setLevelState(lv);
    const back = saved ? await restoreSeries(saved, (keys) => db.pcards.bulkGet(keys), (c: PCardRow) => !!pItemById(c.itemId) && topicOf(c.itemId) === topic) : null;
    const mm = back ? !!saved?.mistakes : takePMistakes("cards");
    setMistakes(mm);
    const q = back ? back.rows : mm
      ? await pMistakeCards(topic, ["recognize", "recall"])
      : [...(await pSessionCards(topic, "recognize", { level: lv, limit: 12, newLimit: 6, minimum: 6 })), ...(await pSessionCards(topic, "recall", { level: lv, limit: 12, newLimit: 6, minimum: 6 }))];
    setLocked(!back && !q.length && !mm && lv === 2);
    setQueue(back ? q : shuffle(q.filter((c) => pItemById(c.itemId))));
    setI(back ? back.index : 0);
    setDone(back && typeof saved?.score === "number" ? saved.score : 0);
    setFlipped(false);
    shownAt.current = Date.now();
  }, [topic]);
  const load = useCallback(() => start(null), [start]);

  const [offer, setOffer] = useResumeOffer(series, () => pMistakesRequested("cards"), load);
  useRememberSeries(series, queue, i, false, done, mistakes);

  if (topic === undefined) return <p className="muted">Завантажую…</p>;
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

  if (offer) {
    return (
      <ResumeOffer
        title="Картки"
        saved={offer}
        back={{ href: "/personal/topic", label: `${topic.icon} До теми «${topic.title}»` }}
        onContinue={() => {
          setOffer(null);
          start(offer);
        }}
        onRestart={() => {
          if (series) clearSeries(series);
          setOffer(null);
          load();
        }}
      />
    );
  }
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
        {item.ctx && <CtxLine ctx={item.ctx} showUa={row.exercise === "recall" || flipped} />}
        <p className="hu" lang={row.exercise === "recognize" ? "hu" : "uk"} style={item.level === 2 ? { fontSize: 26 } : undefined}>
          {front}
        </p>
        {flipped && (
          <>
            <p className="ua" lang={row.exercise === "recognize" ? "uk" : "hu"}>
              {item.check && "⚠ "}
              {back}
            </p>
            {row.exercise === "recall" && <AltLine alt={item.alt} />}
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
