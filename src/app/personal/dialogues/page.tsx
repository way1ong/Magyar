"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PersonalDone } from "@/components/PersonalDone";
import { ResumeOffer } from "@/components/ResumeOffer";
import { clearSeries, isScore, restoreSeries, useRememberSeries, useResumeOffer, type SavedSeries } from "@/lib/resume";
import { currentTopic, pAnswer, pDealFor, pDialogueById, pMistakeCards, pSessionCards, pMistakesRequested, seedPersonal, shuffle, takePMistakes, topicOf, type PTopic } from "@/lib/personal";
import { Rating, type Grade } from "@/lib/scheduler";
import { queueWrite } from "@/lib/writes";
import { db, type PCardRow } from "@/lib/db";

const FAST_MS = 25000;

/** Scenario dialogues of a personal topic: comprehension question or a missing line; translations after the answer. */
export default function PersonalDialoguesPage() {
  // Read on the client after mounting, so the prerendered page and the first client render match.
  const [topic, setTopic] = useState<PTopic | null | undefined>(undefined);
  // The saved series belongs to this topic (and level): another topic starts its own.
  const [series, setSeries] = useState<string | null>(null);
  useEffect(() => {
    const t = currentTopic() ?? null;
    setTopic(t);
    setSeries(t ? `pdialogues:${t.id}` : null);
  }, []);
  const [queue, setQueue] = useState<PCardRow[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [showUa, setShowUa] = useState(false);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [mistakeMode, setMistakeMode] = useState(false);
  const [locked, setLocked] = useState(false);
  const shownAt = useRef(Date.now());

  // A fresh series, or the saved unfinished one (lib/resume.ts).
  const start = useCallback(async (saved: SavedSeries | null) => {
    if (!topic) return;
    await seedPersonal();
    const back = saved ? await restoreSeries(saved, (keys) => db.pcards.bulkGet(keys), (c: PCardRow) => !!pDialogueById(c.itemId) && topicOf(c.itemId) === topic) : null;
    const mm = back ? !!saved?.mistakes : takePMistakes("dialogues");
    setMistakeMode(mm);
    const q = back ? back.rows : (mm ? await pMistakeCards(topic, ["dialogue"]) : await pSessionCards(topic, "dialogue", { limit: 6, newLimit: 3, minimum: 3 })).filter((c) => pDialogueById(c.itemId));
    setLocked(!back && !q.length && !mm);
    setQueue(back ? q : shuffle(q));
    setI(back ? back.index : 0);
    setScore(back && isScore(saved?.score) ? saved.score : { right: 0, total: 0 });
    setPicked(null);
    setShowUa(false);
    shownAt.current = Date.now();
  }, [topic]);
  const load = useCallback(() => start(null), [start]);

  const [offer, setOffer] = useResumeOffer(series, () => pMistakesRequested("dialogues"), load);
  useRememberSeries(series, queue, i, picked !== null, score, mistakeMode);

  const row = queue?.[i];
  const d = row ? pDialogueById(row.itemId) : undefined;
  const cardKey = row ? `${i}:${row.key}` : "";
  const first = row?.reps === 0;
  const deal = useMemo(() => (d && topic ? pDealFor(d, topic, first) : null), [d, topic, first]);

  useEffect(() => {
    setPicked(null);
    setShowUa(false);
    shownAt.current = Date.now();
  }, [cardKey]);

  if (topic === undefined) return <p className="muted">Завантажую…</p>;
  if (!topic) return <p className="muted">Тему не вибрано.</p>;
  if (offer) {
    return (
      <ResumeOffer
        title="Діалоги"
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
  if (!row || !d || !deal) return <PersonalDone title="Діалоги" topic={topic} score={score} onAgain={load} mistakes={mistakeMode} locked={locked ? "Діалоги відкриються з рівнем 3: спершу переглянь половину фраз у «Картках»." : undefined} />;

  const done = picked !== null;
  const right = picked === deal.answer;
  const pick = (v: string) => {
    if (done) return;
    setPicked(v);
    setShowUa(true);
    const took = Date.now() - shownAt.current;
    const ok = v === deal.answer;
    const rating: Grade = ok ? (took < FAST_MS ? Rating.Easy : Rating.Good) : Rating.Again;
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
    queueWrite(() => pAnswer(row, rating, took));
  };

  return (
    <>
      <div className="row">
        <span className="muted">{topic.icon} Діалоги · {deal.kind === "question" ? "прочитай і дай відповідь" : "яка репліка пропущена?"}</span>
        <span className="grow" />
        <span className="muted">
          {i + 1} / {queue.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>

      <div className="card" style={{ padding: "14px 14px 10px" }}>
        <p className="muted" style={{ margin: "0 0 10px", fontSize: 14 }}>
          {d.check && "⚠ "}
          {d.title}
        </p>
        <div className="chat" lang="hu">
          {d.lines.map((l, n) => {
            const hidden = deal.kind === "gap" && deal.line === n && !done;
            const isGap = deal.kind === "gap" && deal.line === n;
            return (
              <div key={n} className={`bubble ${l.who === d.lines[0].who ? "a" : "b"}${isGap ? " gap" : ""}`} style={isGap && done ? { borderColor: right ? "var(--ok)" : "var(--bad)" } : undefined}>
                <span className="who">{l.who}</span>
                <span>{hidden ? "…" : l.hu}</span>
                {showUa && !hidden && <span className="ua-line" lang="uk">{l.ua}</span>}
              </div>
            );
          })}
        </div>
        {!done && (
          <button className="btn ghost" onClick={() => setShowUa((v) => !v)} style={{ marginTop: 8, minHeight: 0, padding: "6px 12px", fontSize: 14 }}>
            {showUa ? "Сховати переклад" : "Показати переклад"}
          </button>
        )}
      </div>

      <p style={{ margin: "14px 0 8px", fontSize: 18 }}>
        <b>{deal.prompt}</b>
      </p>
      <div className="choices" style={{ gridTemplateColumns: "1fr" }}>
        {deal.options.map((v) => {
          let cls = "btn";
          if (done) {
            if (v === deal.answer) cls += " right";
            else if (v === picked) cls += " wrong";
          }
          return (
            <button key={v} className={cls} lang={deal.kind === "gap" ? "hu" : undefined} onClick={() => pick(v)} disabled={done} style={{ textAlign: "left", minHeight: 48, fontSize: 17, fontWeight: 500 }}>
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
