"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { builderTaskById, shuffle, suffixOptions, type BuilderTask } from "@/lib/builder";
import { patternShort } from "@/lib/content";
import { endsWithVowel, finalConsonant, lengthenFinal } from "@/lib/harmony";
import { answer, dueCards, Rating } from "@/lib/scheduler";
import type { CardRow } from "@/lib/db";
import { seedCards } from "@/lib/seed";
import { speak } from "@/lib/tts";

/** A correct answer faster than this counts as Easy (three taps + reading). */
const FAST_MS = 5000;

interface Block {
  id: string;
  text: string;
  isStem: boolean;
}

function makeBlocks(t: BuilderTask): Block[] {
  return shuffle([
    { id: "stem", text: t.stem.hu, isStem: true },
    ...suffixOptions(t).map((s, i) => ({ id: `s${i}`, text: s, isStem: false })),
  ]);
}

/** Why the result isn't just stem + suffix glued together (or null). */
function note(t: BuilderTask): string | null {
  const stem = t.stem.hu;
  if (t.pattern.inflect) {
    const lengthened = lengthenFinal(stem);
    if (t.base !== stem && t.base !== lengthened) return `Основа змінюється: ${stem} → ${t.base}- перед суфіксом.`;
    if (t.base === lengthened && lengthened !== stem)
      return `Кінцеве -${stem.at(-1)} перед суфіксом завжди подовжується: ${stem} → ${lengthened}- (крім -kor, -i, -ként).`;
    if (t.stem.forms?.low) return "«Знижена» основа: сполучна голосна a/e, а не o/ö.";
    return null;
  }
  const av = t.pattern.afterVowel ?? (t.pattern.linking ? "n" : undefined);
  if (av && endsWithVowel(stem)) return `Після голосної — лише -${av}.`;
  const c = t.pattern.assimilates ? finalConsonant(stem) : null;
  if (c) {
    const form = t.pattern.forms[t.stem.harmony];
    return c.length > 1
      ? `Після приголосної v → ${c}: ${stem} + ${form} = ${t.result} (${c}${c} пишеться ${c[0]}${c}).`
      : `Після приголосної v подвоює приголосний: ${stem} + ${form} = ${t.result}.`;
  }
  const base = t.pattern.noLengthen ? stem : lengthenFinal(stem);
  if (base !== stem) return `Кінцеве -${stem.at(-1)} перед суфіксом завжди подовжується: ${stem} → ${base}- (крім -kor, -i, -ként).`;
  return null;
}

/**
 * Builder. Card = (stem, pattern) from a pattern example. Show the Ukrainian
 * meaning, assemble the word from shuffled blocks: the stem first, then the
 * right suffix. Right → Good (fast right → Easy), wrong → Again.
 */
export default function BuilderPage() {
  const [queue, setQueue] = useState<CardRow[] | null>(null);
  const [i, setI] = useState(0);
  // Blocks are dealt per card position; `key` guards against a stale deal.
  const [deal, setDeal] = useState<{ key: string; blocks: Block[] } | null>(null);
  const [placed, setPlaced] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    await seedCards();
    const q = (await dueCards("builder", 20, 8)).filter((r) => builderTaskById(r.itemId));
    setQueue(shuffle(q));
    setI(0);
    setScore({ right: 0, total: 0 });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const row = queue?.[i];
  const task = row ? builderTaskById(row.itemId) : undefined;

  const dealKey = row ? `${i}:${row.key}` : "";

  // Deal fresh blocks for every card shown.
  useEffect(() => {
    if (!task) return;
    setDeal({ key: dealKey, blocks: makeBlocks(task) });
    setPlaced([]);
    setVerdict(null);
    shownAt.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dealKey identifies the card
  }, [dealKey]);

  if (queue === null) return <p className="muted">Завантажую…</p>;

  if (!row || !task) {
    return (
      <>
        <h1 className="title">Конструктор</h1>
        <div className="card big">
          <p className="hu">{score.total ? `${score.right} / ${score.total}` : "✓"}</p>
          <p className="muted">
            {score.total ? "Сесію завершено." : "Нічого не назбиралось — зайди пізніше."}
          </p>
        </div>
        <Link href="/" className="btn">На головну</Link>
        <button className="btn ghost" onClick={load} style={{ marginTop: 8 }}>
          Ще раз
        </button>
      </>
    );
  }

  const blocks = deal?.key === dealKey ? deal.blocks : [];
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const placedBlocks = placed.map((id) => byId.get(id)).filter((b): b is Block => !!b);
  const done = verdict !== null;

  const toggle = (id: string) => {
    if (done) return;
    setPlaced((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const check = async () => {
    if (done || placedBlocks.length < 2) return;
    const took = Date.now() - shownAt.current;
    const [first, second] = placedBlocks;
    const ok =
      placedBlocks.length === 2 && first.isStem && !second.isStem && second.text === task.suffix;
    setVerdict(ok);
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
    speak(task.result);
    await answer(row, ok ? (took < FAST_MS ? Rating.Easy : Rating.Good) : Rating.Again, took);
  };

  const next = () => {
    setPlaced([]);
    setVerdict(null);
    setI((n) => n + 1);
  };
  const why = note(task);

  return (
    <>
      <div className="row">
        <span className="muted">Збери слово</span>
        <span className="grow" />
        <span className="muted">
          {i + 1} / {queue.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>

      <div className="card big">
        <p className="prompt">{task.ua}</p>

        <div className={`slots${done ? (verdict ? " right" : " wrong") : ""}`}>
          {placedBlocks.length === 0 && <span className="muted">торкнись блоків нижче</span>}
          {placedBlocks.map((b, n) => {
            return (
              <span key={b.id} style={{ display: "contents" }}>
                {n > 0 && <span className="plus">+</span>}
                <button className={`block${b.isStem ? " stem" : ""}`} onClick={() => toggle(b.id)} disabled={done}>
                  {b.isStem ? b.text : `-${b.text}`}
                </button>
              </span>
            );
          })}
        </div>

        {done && (
          <div className="example">
            <p className="hu" style={{ color: verdict ? "var(--ok)" : "var(--bad)", fontSize: 30 }}>
              {task.result}
            </p>
            {!verdict && (
              <p style={{ margin: "6px 0 0" }}>
                правильно: {task.stem.hu} + -{task.suffix}
              </p>
            )}
            <p style={{ margin: "6px 0 0" }}>
              <b lang="hu">{task.stem.hu}</b> — {task.stem.ua} · <b lang="hu">{task.pattern.name}</b> — {patternShort(task.pattern, task.stem)}
            </p>
            {why && <p style={{ margin: "6px 0 0" }}>{why}</p>}
          </div>
        )}
      </div>

      {!done && (
        <div className="blocks">
          {blocks.map((b) => {
            const used = placed.includes(b.id);
            return (
              <button
                key={b.id}
                className={`block${b.isStem ? " stem" : ""}${used ? " used" : ""}`}
                onClick={() => toggle(b.id)}
                disabled={used}
              >
                {b.isStem ? b.text : `-${b.text}`}
              </button>
            );
          })}
        </div>
      )}

      {done ? (
        <button className="btn primary" onClick={next}>
          Далі
        </button>
      ) : (
        <button className="btn primary" onClick={check} disabled={placedBlocks.length < 2}>
          Перевірити
        </button>
      )}
    </>
  );
}
