"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PersonalDone } from "@/components/PersonalDone";
import { ResumeOffer } from "@/components/ResumeOffer";
import { clearSeries, isScore, restoreSeries, useRememberSeries, useResumeOffer, type SavedSeries } from "@/lib/resume";
import { currentTopic, pAnswer, pMistakeCards, pSessionCards, pTextById, pMistakesRequested, seedPersonal, shuffle, takePMistakes, topicOf, type PTopic } from "@/lib/personal";
import { Rating, type Grade } from "@/lib/scheduler";
import { queueWrite } from "@/lib/writes";
import { db, type PCardRow } from "@/lib/db";

/**
 * Reading texts of a personal topic: read, then answer 2–3 questions about
 * the content. One card per text; all right → Good (Easy when quick), one
 * miss → Hard, more → Again.
 */
export default function PersonalTextsPage() {
  // Read on the client after mounting, so the prerendered page and the first client render match.
  const [topic, setTopic] = useState<PTopic | null | undefined>(undefined);
  // The saved series belongs to this topic (and level): another topic starts its own.
  const [series, setSeries] = useState<string | null>(null);
  useEffect(() => {
    const t = currentTopic() ?? null;
    setTopic(t);
    setSeries(t ? `ptexts:${t.id}` : null);
  }, []);
  const [queue, setQueue] = useState<PCardRow[] | null>(null);
  const [i, setI] = useState(0);
  const [showUa, setShowUa] = useState(false);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [mistakeMode, setMistakeMode] = useState(false);
  const [locked, setLocked] = useState(false);
  const shownAt = useRef(Date.now());

  // A fresh series, or the saved unfinished one (lib/resume.ts).
  const start = useCallback(async (saved: SavedSeries | null) => {
    if (!topic) return;
    await seedPersonal();
    const back = saved ? await restoreSeries(saved, (keys) => db.pcards.bulkGet(keys), (c: PCardRow) => !!pTextById(c.itemId) && topicOf(c.itemId) === topic) : null;
    const mm = back ? !!saved?.mistakes : takePMistakes("texts");
    setMistakeMode(mm);
    const q = back ? back.rows : (mm ? await pMistakeCards(topic, ["text"]) : await pSessionCards(topic, "text", { limit: 3, newLimit: 2, minimum: 2 })).filter((c) => pTextById(c.itemId));
    setLocked(!back && !q.length && !mm);
    setQueue(back ? q : shuffle(q));
    setI(back ? back.index : 0);
    setScore(back && isScore(saved?.score) ? saved.score : { right: 0, total: 0 });
    setAnswers([]);
    setShowUa(false);
    shownAt.current = Date.now();
  }, [topic]);
  const load = useCallback(() => start(null), [start]);

  const [offer, setOffer] = useResumeOffer(series, () => pMistakesRequested("texts"), load);
  useRememberSeries(series, queue, i, answers.length > 0 && answers.length >= (pTextById(queue?.[i]?.itemId ?? "")?.questions.length ?? Infinity), score, mistakeMode);

  const row = queue?.[i];
  const text = row ? pTextById(row.itemId) : undefined;
  const cardKey = row ? `${i}:${row.key}` : "";

  useEffect(() => {
    setAnswers([]);
    setShowUa(false);
    shownAt.current = Date.now();
  }, [cardKey]);
  // Options are shuffled once per showing so the right one is not always first.
  const shuffled = useMemo(() => (text ? text.questions.map((q) => shuffle(q.options)) : []), [text]);

  if (topic === undefined) return <p className="muted">Завантажую…</p>;
  if (!topic) return <p className="muted">Тему не вибрано.</p>;
  if (offer) {
    return (
      <ResumeOffer
        title="Тексти"
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
  if (!row || !text) return <PersonalDone title="Тексти" topic={topic} score={score} onAgain={load} mistakes={mistakeMode} locked={locked ? "Тексти відкриються з рівнем 3: спершу переглянь половину фраз у «Картках»." : undefined} />;

  const qs = text.questions;
  const current = answers.length; // index of the question being answered
  const allDone = current >= qs.length;

  const pick = (qi: number, v: string) => {
    if (qi !== current) return;
    const next = [...answers, v];
    setAnswers(next);
    if (next.length === qs.length) {
      const wrong = next.filter((a, k) => a !== qs[k].options[qs[k].answer]).length;
      const took = Date.now() - shownAt.current;
      const rating: Grade = wrong === 0 ? (took < 60000 ? Rating.Easy : Rating.Good) : wrong === 1 ? Rating.Hard : Rating.Again;
      setScore((s) => ({ right: s.right + (wrong === 0 ? 1 : 0), total: s.total + 1 }));
      queueWrite(() => pAnswer(row, rating, took));
    }
  };

  const paragraphs = text.hu.split(/\n+/);
  const uaParagraphs = text.ua.split(/\n+/);

  return (
    <>
      <div className="row">
        <span className="muted">{topic.icon} Тексти · прочитай і відповідай</span>
        <span className="grow" />
        <span className="muted">
          {i + 1} / {queue.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>

      <div className="card" style={{ padding: "14px 16px" }}>
        <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
          {text.check && "⚠ "}
          {text.title}
        </p>
        <div lang="hu" style={{ fontSize: 18, lineHeight: 1.5 }}>
          {paragraphs.map((p, n) => (
            <p key={n} style={{ margin: "0 0 10px" }}>
              {p}
              {showUa && uaParagraphs[n] && (
                <>
                  <br />
                  <span className="muted" lang="uk" style={{ fontSize: 15 }}>
                    {uaParagraphs[n]}
                  </span>
                </>
              )}
            </p>
          ))}
        </div>
        <button className="btn ghost" onClick={() => setShowUa((v) => !v)} style={{ minHeight: 0, padding: "6px 12px", fontSize: 14 }}>
          {showUa ? "Сховати переклад" : "Показати переклад"}
        </button>
      </div>

      {qs.map((q, qi) => {
        if (qi > current) return null;
        const a = answers[qi] ?? null;
        const right = q.options[q.answer];
        return (
          <div key={qi} style={{ marginTop: 14 }}>
            <p style={{ margin: "0 0 8px", fontSize: 17 }}>
              <b>
                {qi + 1}. {q.q}
              </b>
            </p>
            <div className="choices" style={{ gridTemplateColumns: "1fr" }}>
              {(shuffled[qi] ?? q.options).map((v) => {
                let cls = "btn";
                if (a !== null) {
                  if (v === right) cls += " right";
                  else if (v === a) cls += " wrong";
                }
                return (
                  <button key={v} className={cls} onClick={() => pick(qi, v)} disabled={a !== null} style={{ textAlign: "left", minHeight: 46, fontSize: 16, fontWeight: 500 }}>
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {allDone && (
        <button className="btn primary" onClick={() => setI((n) => n + 1)} style={{ marginTop: 12 }} ref={(el) => el?.scrollIntoView({ block: "nearest" })}>
          Далі
        </button>
      )}
    </>
  );
}
