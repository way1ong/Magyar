"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PersonalDone } from "@/components/PersonalDone";
import { ResumeOffer } from "@/components/ResumeOffer";
import { clearSeries, isScore, restoreSeries, useRememberSeries, useResumeOffer, type SavedSeries } from "@/lib/resume";
import { currentTopic, pAnswer, pMistakeCards, pSentenceById, pSessionCards, sameOrder, pMistakesRequested, seedPersonal, shuffle, takePMistakes, topicOf, type PSentenceTask, type PTopic } from "@/lib/personal";
import { Rating, type Grade } from "@/lib/scheduler";
import { queueWrite } from "@/lib/writes";
import { db, type PCardRow } from "@/lib/db";

const FAST_MS = 15000;

/** Word-order drill on the topic's example sentences and phrases (tiles only). */
export default function PersonalSentencesPage() {
  // Read on the client after mounting, so the prerendered page and the first client render match.
  const [topic, setTopic] = useState<PTopic | null | undefined>(undefined);
  // The saved series belongs to this topic (and level): another topic starts its own.
  const [series, setSeries] = useState<string | null>(null);
  useEffect(() => {
    const t = currentTopic() ?? null;
    setTopic(t);
    setSeries(t ? `psentences:${t.id}` : null);
  }, []);
  const [queue, setQueue] = useState<PCardRow[] | null>(null);
  const [i, setI] = useState(0);
  const [placedFor, setPlacedFor] = useState<{ key: string; idx: number[] }>({ key: "", idx: [] });
  const [outcome, setOutcome] = useState<"right" | "wrong" | "revealed" | null>(null);
  const [tries, setTries] = useState(0);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [mistakeMode, setMistakeMode] = useState(false);
  const [locked, setLocked] = useState(false);
  const shownAt = useRef(Date.now());

  // A fresh series, or the saved unfinished one (lib/resume.ts).
  const start = useCallback(async (saved: SavedSeries | null) => {
    if (!topic) return;
    await seedPersonal();
    const back = saved ? await restoreSeries(saved, (keys) => db.pcards.bulkGet(keys), (c: PCardRow) => !!pSentenceById(c.itemId) && topicOf(c.itemId) === topic) : null;
    const mm = back ? !!saved?.mistakes : takePMistakes("sentences");
    setMistakeMode(mm);
    const q = back ? back.rows : (mm ? await pMistakeCards(topic, ["sentence"]) : await pSessionCards(topic, "sentence", { limit: 15, newLimit: 6, minimum: 6 })).filter((c) => pSentenceById(c.itemId));
    setLocked(!back && !q.length && !mm);
    setQueue(back ? q : shuffle(q));
    setI(back ? back.index : 0);
    setScore(back && isScore(saved?.score) ? saved.score : { right: 0, total: 0 });
    setPlacedFor({ key: "", idx: [] });
    setOutcome(null);
    setTries(0);
    shownAt.current = Date.now();
  }, [topic]);
  const load = useCallback(() => start(null), [start]);

  const [offer, setOffer] = useResumeOffer(series, () => pMistakesRequested("sentences"), load);
  useRememberSeries(series, queue, i, outcome === "right" || outcome === "revealed", score, mistakeMode);

  const row = queue?.[i];
  const task: PSentenceTask | undefined = row ? pSentenceById(row.itemId) : undefined;
  const cardKey = row ? `${i}:${row.key}` : "";

  const tiles = useMemo(() => {
    if (!task) return [];
    const t = task.words.map((w, n) => ({ w, n }));
    let s = shuffle(t);
    if (t.length > 2 && s.every((x, k) => x.n === k)) s = shuffle(t);
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cardKey identifies the showing
  }, [cardKey]);

  useEffect(() => {
    setOutcome(null);
    setTries(0);
    shownAt.current = Date.now();
  }, [cardKey]);
  const placed = placedFor.key === cardKey ? placedFor.idx : [];
  const setPlaced = (idx: number[]) => setPlacedFor({ key: cardKey, idx });

  if (topic === undefined) return <p className="muted">Завантажую…</p>;
  if (!topic) return <p className="muted">Тему не вибрано.</p>;
  if (offer) {
    return (
      <ResumeOffer
        title="Речення"
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
  if (!row || !task) return <PersonalDone title="Речення" topic={topic} score={score} onAgain={load} mistakes={mistakeMode} locked={locked ? "Речення відкриються разом із рівнем фраз: спершу переглянь половину слів у «Картках»." : undefined} />;

  const done = outcome === "right" || outcome === "revealed";
  const answerWords = placed.map((k) => tiles[k]?.w ?? "");

  const grade = (rating: Grade, right: boolean) => {
    setScore((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }));
    const took = Date.now() - shownAt.current;
    queueWrite(() => pAnswer(row, rating, took));
  };
  const check = (next: number[]) => {
    const words = next.map((k) => tiles[k]?.w ?? "");
    if (sameOrder(words, task.words)) {
      setOutcome("right");
      const took = Date.now() - shownAt.current;
      grade(tries ? Rating.Hard : took < FAST_MS ? Rating.Easy : Rating.Good, true);
    } else {
      setOutcome("wrong");
      setTries((m) => m + 1);
    }
  };
  const place = (k: number) => {
    if (done || placed.includes(k)) return;
    const next = [...placed, k];
    setPlaced(next);
    setOutcome(null);
    if (next.length === tiles.length) check(next);
  };
  const unplace = (pos: number) => {
    if (done) return;
    setPlaced(placed.filter((_, p) => p !== pos));
    setOutcome(null);
  };
  const reveal = () => {
    if (done) return;
    setOutcome("revealed");
    if (placed.length === 0) setPlaced(task.words.map((_, n) => tiles.findIndex((t) => t.n === n)));
    grade(Rating.Again, false);
  };

  const color = outcome === "right" ? "var(--ok)" : outcome === "wrong" ? "var(--bad)" : outcome === "revealed" ? "var(--warn)" : undefined;
  const misplaced = (pos: number) => (outcome === "wrong" || outcome === "revealed") && answerWords[pos]?.toLowerCase() !== task.words[pos]?.toLowerCase();
  const complete = answerWords.length === tiles.length;

  return (
    <>
      <div className="row">
        <span className="muted">{topic.icon} Речення · склади речення зі слів</span>
        <span className="grow" />
        <span className="muted">
          {i + 1} / {queue.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>

      <div className="card big" style={{ paddingTop: 18, paddingBottom: 18 }}>
        <p className="ua" style={{ fontSize: 22, margin: 0 }}>{task.ua}</p>
        <div className="sentence-line" style={{ borderColor: color }} lang="hu">
          {answerWords.length === 0 && <span className="muted">торкайся слів у потрібному порядку</span>}
          {answerWords.map((w, pos) => (
            <span key={pos} style={{ whiteSpace: "nowrap" }}>
              <button className="tile placed" onClick={() => unplace(pos)} disabled={done} style={{ color: misplaced(pos) ? "var(--bad)" : color }}>
                {pos === 0 ? w[0].toUpperCase() + w.slice(1) : w}
              </button>
              {complete && pos === answerWords.length - 1 && <span style={{ color }}>{task.end}</span>}
            </span>
          ))}
        </div>
        {outcome === "wrong" && <p className="muted" style={{ margin: "6px 0 0", color: "var(--bad)" }}>Не той порядок — червоні слова не на своєму місці; торкнись слова, щоб прибрати його.</p>}
        {done && (
          <>
            <p className="example" lang="hu" style={{ color, fontSize: 22, margin: "10px 0 4px" }}>{task.hu}</p>
            <p className="muted" style={{ fontSize: 15, margin: 0 }}>{task.note}</p>
          </>
        )}
      </div>

      {done ? (
        <button className="btn primary" onClick={() => setI((n) => n + 1)} style={{ marginBottom: 12 }} ref={(el) => el?.scrollIntoView({ block: "nearest" })}>
          Далі
        </button>
      ) : (
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn ghost" onClick={() => { setPlaced([]); setOutcome(null); }} disabled={!placed.length}>
            Скинути
          </button>
          <button className="btn ghost" onClick={reveal}>
            Показати
          </button>
        </div>
      )}

      <div className="tiles" lang="hu">
        {tiles.map((t, k) => (
          <button key={k} className={`tile${placed.includes(k) ? " used" : ""}`} onClick={() => place(k)} disabled={done || placed.includes(k)}>
            {t.w}
          </button>
        ))}
      </div>
    </>
  );
}
