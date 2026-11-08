"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SessionDone } from "@/components/SessionDone";
import { conjTaskById, randomPerson, type ConjTask } from "@/lib/conjcards";
import { conjugate, isTransitive, paradigmOf, PRONOUN, PRONOUN_UA, slotsFor, tenseLabel } from "@/lib/conj";
import { compare, type Verdict } from "@/lib/dictation";
import { answer, Rating, sessionCards, type Grade } from "@/lib/scheduler";
import { getTypingMode, shouldType, type TypingMode } from "@/lib/settings";
import type { CardRow } from "@/lib/db";
import { seedCards } from "@/lib/seed";
import { speak } from "@/lib/tts";
import { HuInput } from "@/components/HuInput";

const FAST_MS = 4000;
const FAST_TYPED_MS = 10000;

type Outcome = Verdict | "revealed";
const VERDICT_TEXT: Record<Outcome, string> = {
  exact: "Правильно!",
  accents: "Майже — перевір довгі голосні.",
  wrong: "Не так.",
  revealed: "Правильна відповідь:",
};

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Conjugation drill. Card = verb × tense × definiteness; each time a random
 * person is asked: "(ő) ___ azt." → olvassa. Buttons (the right form among
 * other forms of the same verb) or typing, per the typing setting. After
 * the answer the whole six-form table is shown.
 */
export default function ConjPage() {
  const [queue, setQueue] = useState<CardRow[] | null>(null);
  const [mode, setMode] = useState<TypingMode>("auto");
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    await seedCards();
    setMode(await getTypingMode());
    const q = (await sessionCards("conj", 20, 8)).filter((c) => conjTaskById(c.itemId));
    setQueue(shuffle(q));
    setI(0);
    setScore({ right: 0, total: 0 });
    setPicked(null);
    setOutcome(null);
    shownAt.current = Date.now();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const row = queue?.[i];
  const task: ConjTask | undefined = row ? conjTaskById(row.itemId) : undefined;
  const cardKey = row ? `${i}:${row.key}` : "";

  // The person and the button options are fixed per card showing.
  const deal = useMemo(() => {
    if (!task) return null;
    const person = randomPerson();
    const correct = conjugate(task.item, { tense: task.tense, def: task.def, person });
    const pool = slotsFor(task.item)
      .map((s) => ({ s, f: conjugate(task.item, s) }))
      .filter((x) => x.f && x.f !== correct)
      .sort((a, b) => Number(b.s.tense === task.tense) - Number(a.s.tense === task.tense) || Math.random() - 0.5);
    const others = [...new Set(pool.map((x) => x.f))].slice(0, 3);
    return { person, correct, options: shuffle([correct, ...others]) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cardKey identifies the showing
  }, [cardKey]);

  useEffect(() => {
    setPicked(null);
    setTyped("");
    setOutcome(null);
    shownAt.current = Date.now();
  }, [cardKey]);

  if (queue === null) return <p className="muted">Завантажую…</p>;

  if (!row || !task || !deal) {
    return <SessionDone title="Дієвідміна" score={score} onAgain={load} />;
  }

  const { item, tense, def } = task;
  const { person, correct, options } = deal;
  const typing = shouldType(mode, row);
  const done = typing ? outcome !== null : picked !== null;
  const ok = typing ? outcome === "exact" : picked === correct;
  const color = !done ? undefined : ok ? "var(--ok)" : outcome === "accents" ? "var(--warn)" : "var(--bad)";
  const tr = isTransitive(item);
  const object = def ? "azt" : tr ? "valamit" : "";
  const imp = tense === "imp";
  const mark = imp ? "!" : ".";
  const defLabel = def
    ? "означена відміна — конкретний обʼєкт (azt, a könyvet)"
    : tr
      ? "неозначена відміна — обʼєкт невизначений (valamit, egy könyvet)"
      : "неозначена відміна";

  const grade = async (rating: Grade, right: boolean) => {
    const took = Date.now() - shownAt.current;
    setScore((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }));
    await answer(row, rating, took);
    if (right) speak(correct);
  };

  const pick = async (v: string) => {
    if (done) return;
    setPicked(v);
    const took = Date.now() - shownAt.current;
    const right = v === correct;
    await grade(right ? (took < FAST_MS ? Rating.Easy : Rating.Good) : Rating.Again, right);
  };

  const finish = async (o: Outcome) => {
    if (done) return;
    setOutcome(o);
    const took = Date.now() - shownAt.current;
    await grade(o === "exact" ? (took < FAST_TYPED_MS ? Rating.Easy : Rating.Good) : o === "accents" ? Rating.Hard : Rating.Again, o === "exact");
  };

  const check = () => {
    if (!typed.trim()) return;
    finish(compare(typed, correct));
  };

  const next = () => {
    setPicked(null);
    setOutcome(null);
    setI((n) => n + 1);
  };

  const table = paradigmOf(item, tense, def);

  return (
    <>
      <div className="row">
        <span className="muted">Дієвідміна · {tenseLabel(tense)}</span>
        <span className="grow" />
        <span className="muted">
          {i + 1} / {queue.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>

      <div className="card big">
        <p className="muted" style={{ margin: 0 }}>{defLabel}</p>
        <p className="hu" lang="hu" style={{ fontSize: 26 }}>
          ({PRONOUN[person]}) <b>___</b>
          {object && ` ${object}`}{mark}
        </p>
        <p className="ua">
          <b lang="hu">{item.hu}</b> — {item.ua} · {PRONOUN_UA[person]}, {tense === "pot" ? "може / можна" : imp ? "наказ / хай" : tense === "cond" ? "умовний (би)" : tenseLabel(tense)}
        </p>
        {done && (
          <>
            {typing && outcome && <p className="muted" style={{ margin: "0 0 4px", color }}>{VERDICT_TEXT[outcome]}</p>}
            <p className="example" lang="hu" style={{ color, fontSize: 24 }}>
              ({PRONOUN[person]}) {correct}
              {object && ` ${object}`}{mark}
            </p>
            {typing && outcome === "wrong" && typed.trim() && (
              <p className="muted" style={{ fontSize: 15, margin: 0 }}>
                ти написав: <s>{typed}</s>
              </p>
            )}
            <table className="conj-table" lang="hu">
              <tbody>
                {table.map((r) => (
                  <tr key={r.person} className={r.person === person ? "hit" : ""}>
                    <td className="muted">{PRONOUN[r.person]}</td>
                    <td>{r.form}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {typing ? (
        <>
          <HuInput
            id="conj-input"
            value={typed}
            onChange={setTyped}
            onEnter={() => (done ? next() : check())}
            disabled={done}
            done={done}
            focusKey={cardKey}
            placeholder="форма дієслова…"
          />
          {done ? (
            <button className="btn primary" onClick={next}>
              Далі
            </button>
          ) : (
            <div className="row">
              <button className="btn ghost" onClick={() => finish("revealed")}>
                Показати
              </button>
              <button className="btn primary" onClick={check} disabled={!typed.trim()}>
                Перевірити
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {picked && (
            <button className="btn primary" onClick={next} style={{ marginBottom: 12 }} ref={(el) => el?.scrollIntoView({ block: "nearest" })}>
              Далі
            </button>
          )}
          <div className="choices" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {options.map((v) => {
              let cls = "btn";
              if (picked) {
                if (v === correct) cls += " right";
                else if (v === picked) cls += " wrong";
              }
              return (
                <button key={v} className={cls} lang="hu" onClick={() => pick(v)} disabled={!!picked}>
                  {v}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
