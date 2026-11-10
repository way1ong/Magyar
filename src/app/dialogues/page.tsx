"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SessionDone } from "@/components/SessionDone";
import { dealFor, dialogueTaskById, type DialogueTask } from "@/lib/dialogues";
import { mistakeCards, takeMistakeMode } from "@/lib/mistakes";
import { answer, Rating, sessionCards, type Grade } from "@/lib/scheduler";
import { queueWrite } from "@/lib/writes";
import type { CardRow } from "@/lib/db";
import { seedCards } from "@/lib/seed";

const FAST_MS = 25000;

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Dialogue comprehension: read the exchange, then either answer a question
 * about it (Ukrainian) or pick the missing line. After the answer every line
 * gets its translation. Right → Good (fast → Easy), wrong → Again.
 */
export default function DialoguesPage() {
  const [queue, setQueue] = useState<CardRow[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [showUa, setShowUa] = useState(false);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [mistakeMode, setMistakeMode] = useState(false);
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    await seedCards();
    const q = (await (takeMistakeMode("dialogue") ? (setMistakeMode(true), mistakeCards("dialogue")) : (setMistakeMode(false), sessionCards("dialogue", 10, 4, 4)))).filter((c) => dialogueTaskById(c.itemId));
    setQueue(shuffle(q));
    setI(0);
    setScore({ right: 0, total: 0 });
    setPicked(null);
    setShowUa(false);
    shownAt.current = Date.now();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const row = queue?.[i];
  const task: DialogueTask | undefined = row ? dialogueTaskById(row.itemId) : undefined;
  const cardKey = row ? `${i}:${row.key}` : "";
  const deal = useMemo(() => (task ? dealFor(task) : null), [task]);

  useEffect(() => {
    setPicked(null);
    setShowUa(false);
    shownAt.current = Date.now();
  }, [cardKey]);

  if (queue === null) return <p className="muted">Завантажую…</p>;
  if (!row || !task || !deal) return <SessionDone title="Діалоги" score={score} onAgain={load} step="dialogue" mistakes={mistakeMode} />;

  const d = task.dialogue;
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
    queueWrite(() => answer(row, rating, took));
  };

  return (
    <>
      <div className="row">
        <span className="muted">Діалоги · {deal.kind === "question" ? "розуміння" : "пропущена репліка"}</span>
        <span className="grow" />
        <span className="muted">
          {i + 1} / {queue.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>

      <div className="card" style={{ padding: "14px 14px 10px" }}>
        <p className="muted" style={{ margin: "0 0 10px", fontSize: 14 }}>{d.title}</p>
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
            <button key={v} className={cls} lang={deal.kind === "gap" ? "hu" : undefined} onClick={() => pick(v)} disabled={done} style={{ textAlign: "left", minHeight: 48 }}>
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
