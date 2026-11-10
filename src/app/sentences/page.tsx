"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SessionDone } from "@/components/SessionDone";
import { mistakeCards, takeMistakeMode } from "@/lib/mistakes";
import { sameOrder, sentenceTaskById, type SentenceTask } from "@/lib/sentences";
import { answer, Rating, sessionCards, type Grade } from "@/lib/scheduler";
import { queueWrite } from "@/lib/writes";
import type { CardRow } from "@/lib/db";
import { seedCards } from "@/lib/seed";
import { speak } from "@/lib/tts";

const FAST_MS = 15000;

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Word-order drill: the translation is shown, the Hungarian words are
 * shuffled into tiles; tap them into the answer line. A full line is
 * checked at once: right on the first try → Good (fast → Easy), right after
 * a wrong try → Hard, revealed → Again. The note explains the order.
 */
export default function SentencesPage() {
  const [queue, setQueue] = useState<CardRow[] | null>(null);
  const [i, setI] = useState(0);
  // Placed tile indices are kept together with the card they belong to, so a
  // new card never reads them against its own (shorter) tile set.
  const [placedFor, setPlacedFor] = useState<{ key: string; idx: number[] }>({ key: "", idx: [] });
  const [outcome, setOutcome] = useState<"right" | "wrong" | "revealed" | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [mistakeMode, setMistakeMode] = useState(false);
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    await seedCards();
    const q = (await (takeMistakeMode("sentence") ? (setMistakeMode(true), mistakeCards("sentence")) : (setMistakeMode(false), sessionCards("sentence", 20, 8)))).filter((c) => sentenceTaskById(c.itemId));
    setQueue(shuffle(q));
    setI(0);
    setScore({ right: 0, total: 0 });
    setPlacedFor({ key: "", idx: [] });
    setOutcome(null);
    setMistakes(0);
    shownAt.current = Date.now();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const row = queue?.[i];
  const task: SentenceTask | undefined = row ? sentenceTaskById(row.itemId) : undefined;
  const cardKey = row ? `${i}:${row.key}` : "";

  // Tiles are shuffled once per showing; a tile is a word plus its original index (duplicates stay distinct).
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
    setMistakes(0);
    shownAt.current = Date.now();
  }, [cardKey]);
  const placed = placedFor.key === cardKey ? placedFor.idx : [];
  const setPlaced = (idx: number[]) => setPlacedFor({ key: cardKey, idx });

  if (queue === null) return <p className="muted">Завантажую…</p>;
  if (!row || !task) return <SessionDone title="Речення" score={score} onAgain={load} step="sentence" mistakes={mistakeMode} />;

  const done = outcome === "right" || outcome === "revealed";
  const answerWords = placed.map((k) => tiles[k]?.w ?? "");

  const grade = async (rating: Grade, right: boolean) => {
    setScore((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }));
    const took = Date.now() - shownAt.current;
    queueWrite(() => answer(row, rating, took));
    if (right) speak(task.hu);
  };

  const check = async (next: number[]) => {
    const words = next.map((k) => tiles[k]?.w ?? "");
    if (sameOrder(words, task.words)) {
      setOutcome("right");
      const took = Date.now() - shownAt.current;
      await grade(mistakes ? Rating.Hard : took < FAST_MS ? Rating.Easy : Rating.Good, true);
    } else {
      setOutcome("wrong");
      setMistakes((m) => m + 1);
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
  const reveal = async () => {
    if (done) return;
    setOutcome("revealed");
    setPlaced(task.words.map((_, n) => tiles.findIndex((t) => t.n === n)));
    await grade(Rating.Again, false);
  };
  const nextCard = () => setI((n) => n + 1);

  const color = outcome === "right" ? "var(--ok)" : outcome === "wrong" ? "var(--bad)" : outcome === "revealed" ? "var(--warn)" : undefined;

  return (
    <>
      <div className="row">
        <span className="muted">Речення · порядок слів</span>
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
            <button key={pos} className="tile placed" onClick={() => unplace(pos)} disabled={done} style={{ color }}>
              {pos === 0 ? w[0].toUpperCase() + w.slice(1) : w}
            </button>
          ))}
          {answerWords.length === tiles.length && <span style={{ color }}>{task.end}</span>}
        </div>
        {outcome === "wrong" && <p className="muted" style={{ margin: "6px 0 0", color: "var(--bad)" }}>Не той порядок — торкнись слова, щоб прибрати його.</p>}
        {done && (
          <>
            <p className="example" lang="hu" style={{ color, fontSize: 22, margin: "10px 0 4px" }}>{task.hu}</p>
            <p className="muted" style={{ fontSize: 15, margin: 0 }}>{task.note}</p>
          </>
        )}
      </div>

      {done ? (
        <button className="btn primary" onClick={nextCard} style={{ marginBottom: 12 }} ref={(el) => el?.scrollIntoView({ block: "nearest" })}>
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
