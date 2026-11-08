"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { packs } from "@/lib/content";
import { bossQuestions, type BossQuestion } from "@/lib/boss";
import { BOSS_PASS, bossResults, packProgress, recordBoss, unlockedCount, type BossResult, type PackProgress } from "@/lib/progress";
import { seedCards } from "@/lib/seed";
import { speak } from "@/lib/tts";
import type { ContentPack } from "@/lib/types";

const KIND_LABEL: Record<BossQuestion["kind"], string> = {
  recognize: "Що це означає?",
  recall: "Як це угорською?",
  form: "Яка форма правильна?",
  conj: "Яка форма дієслова?",
};

/**
 * Boss screen: the test for the current gate pack (the last open pack).
 * Pass (≥ 80%) records the result and opens the next pack.
 */
export default function BossPage() {
  const [pack, setPack] = useState<ContentPack | null>(null);
  const [prev, setPrev] = useState<BossResult | undefined>();
  const [prog, setProg] = useState<PackProgress | undefined>();
  const [qs, setQs] = useState<BossQuestion[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const [started, setStarted] = useState(false);
  // Guards against a double tap on "Результат" while the result is being saved.
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<{ res: BossResult; score: number; opened?: ContentPack } | null>(null);
  const answered = useRef(0);

  const load = useCallback(async () => {
    const res = await bossResults();
    const n = await unlockedCount(res);
    const p = packs[n - 1];
    const prog = (await packProgress())[n - 1];
    setPack(p);
    setPrev(res.get(p.id));
    setProg(prog);
    setQs(bossQuestions(p));
    setI(0);
    setPicked(null);
    setRight(0);
    setStarted(false);
    setFinishing(false);
    setResult(null);
    answered.current = 0;
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!pack) return <p className="muted">Завантажую…</p>;

  const q = qs[i];

  const finish = async (rightCount: number) => {
    const score = qs.length ? rightCount / qs.length : 0;
    const wasOpen = await unlockedCount();
    const res = await recordBoss(pack.id, score);
    const nowOpen = await unlockedCount();
    const opened = nowOpen > wasOpen ? packs[nowOpen - 1] : undefined;
    if (opened) await seedCards(true);
    setResult({ res, score, opened });
  };

  const pick = (v: string) => {
    if (picked || !q) return;
    setPicked(v);
    const ok = v === q.answer;
    if (ok) setRight((r) => r + 1);
    if (q.kind !== "recognize") speak(q.answer);
    answered.current += 1;
  };

  const next = () => {
    if (finishing) return;
    if (i + 1 >= qs.length) {
      setFinishing(true);
      finish(right);
      return;
    }
    setPicked(null);
    setI((n) => n + 1);
  };

  if (result) {
    const pct = Math.round(result.score * 100);
    const passed = result.score >= BOSS_PASS;
    return (
      <>
        <h1 className="title">Бос: {pack.id}</h1>
        <div className="card big">
          <p className="hu" style={{ color: passed ? "var(--ok)" : "var(--bad)" }}>{pct}%</p>
          <p className="ua">{passed ? "Пройдено!" : `Не вистачило — треба ${Math.round(BOSS_PASS * 100)}%.`}</p>
          {result.opened && <p className="example">🔓 Відкрито пакет {result.opened.id} — {result.opened.title}</p>}
          {passed && !result.opened && (
            <p className="example">{prev?.passed ? "Цей бос уже був пройдений." : "Це був останній пакет — нові зʼявляться з оновленням."}</p>
          )}
        </div>
        <Link href="/" className="btn primary">На головну</Link>
        <button className="btn ghost" onClick={load} style={{ marginTop: 8 }}>
          Ще раз
        </button>
      </>
    );
  }

  if (!started || !q) {
    return (
      <>
        <h1 className="title">Бос: {pack.id}</h1>
        <div className="card">
          <p style={{ marginTop: 0 }}><b>{pack.title}</b></p>
          <p className="muted">
            {qs.length} питань упереміш: значення, слово, правильна форма. Без підказок і без повторного прослуховування.
            Треба {Math.round(BOSS_PASS * 100)}% — тоді відкриється наступний пакет.
          </p>
          {prog && prog.total > 0 && (
            <p className="muted">
              Картки пакета: у роботі {prog.started} з {prog.total}, у повторенні {prog.known}.
              {prog.started / prog.total < 0.5 ? " Краще спершу пройти більше карток — бос без підказок." : ""}
            </p>
          )}
          {prev && (
            <p className="muted" style={{ marginBottom: 0 }}>
              Спроб: {prev.attempts}, найкращий результат: {Math.round(prev.best * 100)}%{prev.passed ? " — пройдено" : ""}.
            </p>
          )}
        </div>
        <button className="btn primary" onClick={() => setStarted(true)} disabled={qs.length < 5}>
          Почати
        </button>
        <Link href="/" className="btn ghost" style={{ marginTop: 8 }}>На головну</Link>
      </>
    );
  }

  return (
    <>
      <div className="row">
        <span className="muted">{KIND_LABEL[q.kind]}</span>
        <span className="grow" />
        <span className="muted">
          {i + 1} / {qs.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(i / qs.length) * 100}%` }} />
      </div>

      <div className="card big">
        <p className="hu" lang={q.kind === "recall" ? undefined : "hu"} style={{ fontSize: q.kind === "recognize" ? 34 : q.kind === "conj" ? 24 : 28 }}>{q.prompt}</p>
        {q.hint && <p className="ua" style={{ marginTop: 0, fontSize: 16 }}>{q.hint}</p>}
      </div>

      <div className="choices" style={{ gridTemplateColumns: "1fr" }}>
        {q.options.map((v) => {
          let cls = "btn";
          if (picked) {
            if (v === q.answer) cls += " right";
            else if (v === picked) cls += " wrong";
          }
          return (
            <button key={v} className={cls} onClick={() => pick(v)} disabled={!!picked} style={{ fontSize: 20, minHeight: 56 }}>
              {v}
            </button>
          );
        })}
      </div>

      {picked && (
        <button className="btn primary" onClick={next} disabled={finishing} style={{ marginTop: 12 }}>
          {finishing ? "Рахую…" : i + 1 >= qs.length ? "Результат" : "Далі"}
        </button>
      )}
    </>
  );
}
