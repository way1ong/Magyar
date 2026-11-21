"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PersonalDone } from "@/components/PersonalDone";
import { CtxLine } from "@/components/CtxLine";
import { ResumeOffer } from "@/components/ResumeOffer";
import { clearSeries, isScore, restoreSeries, useRememberSeries, useResumeOffer, type SavedSeries } from "@/lib/resume";
import { currentTopic, pAnswer, pItemById, pMistakeCards, pSessionCards, PLEVEL_TITLES, quizFor, pMistakesRequested, seedPersonal, shuffle, takeLevel, takePMistakes, topicOf, type PTopic } from "@/lib/personal";
import { Rating, type Grade } from "@/lib/scheduler";
import { queueWrite } from "@/lib/writes";
import { db, type PCardRow } from "@/lib/db";

const FAST_MS = 6000;

/** Quiz of a personal topic: a word, four options (HU→UA or UA→HU at random). Right → Good (fast → Easy), wrong → Again. */
export default function PersonalQuizPage() {
  // Read on the client after mounting, so the prerendered page and the first client render match.
  const [topic, setTopic] = useState<PTopic | null | undefined>(undefined);
  // The saved series belongs to this topic (and level): another topic starts its own.
  const [series, setSeries] = useState<string | null>(null);
  useEffect(() => {
    const t = currentTopic() ?? null;
    setTopic(t);
    setSeries(t ? `pquiz:${t.id}:${takeLevel()}` : null);
  }, []);
  const [level, setLevelState] = useState<1 | 2>(1);
  const [queue, setQueue] = useState<PCardRow[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
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
    const mm = back ? !!saved?.mistakes : takePMistakes("quiz");
    setMistakes(mm);
    const q = back ? back.rows : mm ? await pMistakeCards(topic, ["quiz"]) : await pSessionCards(topic, "quiz", { level: lv, limit: 15, newLimit: 8, minimum: 8 });
    setLocked(!back && !q.length && !mm && lv === 2);
    setQueue(back ? q : shuffle(q.filter((c) => pItemById(c.itemId))));
    setI(back ? back.index : 0);
    setScore(back && isScore(saved?.score) ? saved.score : { right: 0, total: 0 });
    setPicked(null);
    shownAt.current = Date.now();
  }, [topic]);
  const load = useCallback(() => start(null), [start]);

  const [offer, setOffer] = useResumeOffer(series, () => pMistakesRequested("quiz"), load);
  useRememberSeries(series, queue, i, picked !== null, score, mistakes);

  const row = queue?.[i];
  const item = row ? pItemById(row.itemId) : undefined;
  const cardKey = row ? `${i}:${row.key}` : "";
  const deal = useMemo(() => (item && topic ? quizFor(item, topic) : null), [item, topic]);

  useEffect(() => {
    setPicked(null);
    shownAt.current = Date.now();
  }, [cardKey]);

  if (topic === undefined) return <p className="muted">Завантажую…</p>;
  if (!topic) return <p className="muted">Тему не вибрано.</p>;
  if (offer) {
    return (
      <ResumeOffer
        title="Вікторина"
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
  if (!row || !item || !deal) {
    return <PersonalDone title={`Вікторина · ${PLEVEL_TITLES[level]}`} topic={topic} score={score} onAgain={load} mistakes={mistakes} locked={locked ? "Рівень фраз ще закритий: спершу переглянь половину слів у «Картках»." : undefined} />;
  }

  const done = picked !== null;
  const pick = (v: string) => {
    if (done) return;
    setPicked(v);
    const took = Date.now() - shownAt.current;
    const ok = v === deal.answer;
    const rating: Grade = ok ? (took < FAST_MS ? Rating.Easy : Rating.Good) : Rating.Again;
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
    queueWrite(() => pAnswer(row, rating, took));
  };

  return (
    <>
      <div className="row">
        <span className="muted">
          {topic.icon} Вікторина · {deal.dir === "hu" ? "що це означає?" : "як це угорською?"}
        </span>
        <span className="grow" />
        <span className="muted">
          {i + 1} / {queue.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>

      <div className="card big" style={{ minHeight: "28dvh" }}>
        {item.ctx && <CtxLine ctx={item.ctx} showUa={deal.dir === "ua" || done} />}
        <p className="hu" lang={deal.dir} style={item.level === 2 ? { fontSize: 24 } : undefined}>
          {deal.prompt}
        </p>
        {done && item.example && (
          <p className="example">
            {item.example.hu}
            <br />
            {item.example.ua}
          </p>
        )}
      </div>

      <div className="choices" style={{ gridTemplateColumns: "1fr" }}>
        {deal.options.map((v) => {
          let cls = "btn";
          if (done) {
            if (v === deal.answer) cls += " right";
            else if (v === picked) cls += " wrong";
          }
          return (
            <button key={v} className={cls} lang={deal.dir === "hu" ? "uk" : "hu"} onClick={() => pick(v)} disabled={done} style={{ textAlign: "left", minHeight: 52, fontSize: 18, fontWeight: 500 }}>
              {v}
            </button>
          );
        })}
      </div>
      {done && (
        <button className="btn primary" onClick={() => setI((n) => n + 1)} style={{ marginTop: 12 }} ref={(el) => el?.scrollIntoView({ block: "nearest" })}>
          Далі
        </button>
      )}
    </>
  );
}
