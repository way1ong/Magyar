"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { currentTopic, PLEVEL_TITLES, requestPMistakes, seedPersonal, setLevel, topicProgress, type PTopic, type TopicProgress } from "@/lib/personal";

const PAGE_TITLES: Record<string, string> = { cards: "Картки", quiz: "Вікторина", sentences: "Речення", dialogues: "Діалоги", texts: "Тексти" };

/** One personal topic: three levels with their exercises, mistakes, and the word list by theme. */
export default function PersonalTopicPage() {
  const [topic, setTopic] = useState<PTopic | undefined>(undefined);
  const [prog, setProg] = useState<TopicProgress | null>(null);

  const load = useCallback(async () => {
    const t = currentTopic();
    setTopic(t);
    if (!t) return;
    await seedPersonal();
    setProg(await topicProgress(t));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (topic === undefined) return <p className="muted">Завантажую…</p>;
  if (!topic) {
    return (
      <>
        <h1 className="title">Персональні теми</h1>
        <p className="muted">Тему не вибрано.</p>
        <Link href="/personal" className="btn primary">
          До списку тем
        </Link>
      </>
    );
  }

  const lv = prog?.levels;
  const Lock = ({ level }: { level: 2 | 3 }) => {
    const l = lv?.[level];
    if (!l || l.open) return null;
    const prev = level === 2 ? "слів" : "фраз";
    return (
      <p className="muted" style={{ margin: "6px 0 0", fontSize: 14 }}>
        🔒 Відкриється, коли переглянеш у «Картках» ще {l.need} {prev} (половину рівня {level - 1}).
      </p>
    );
  };
  const Counts = ({ level }: { level: 1 | 2 | 3 }) => {
    const l = lv?.[level];
    return (
      <span className="muted" style={{ fontSize: 14 }}>
        {l ? `бачено ${l.seen} / ${l.total} · у роботі ${l.inWork} · міцно ${l.strong}` : "…"}
      </span>
    );
  };
  const mistakesTotal = prog ? Object.values(prog.mistakes).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <p className="muted" style={{ margin: "0 0 6px" }}>
        <Link href="/personal">Персональні теми</Link> ›
      </p>
      <h1 className="title" style={{ marginTop: 0 }}>
        {topic.icon} {topic.title}
      </h1>
      <p className="muted" lang="hu" style={{ marginTop: -8 }}>
        {topic.titleHu}
      </p>
      <p className="muted">{topic.intro}</p>
      {prog && prog.dueTotal > 0 && <p className="muted">На повторення зараз: {prog.dueTotal}.</p>}

      <div className="card" style={{ marginBottom: 10 }}>
        <div className="stat" style={{ borderBottom: 0, padding: "0 0 4px" }}>
          <span>
            <b>Рівень 1 · {PLEVEL_TITLES[1]}</b>
          </span>
          <Counts level={1} />
        </div>
        <div className="row">
          <Link href="/personal/cards" className="btn primary" onClick={() => setLevel(1)} style={{ flex: 1 }}>
            🃏 Картки
          </Link>
          <Link href="/personal/quiz" className="btn" onClick={() => setLevel(1)} style={{ flex: 1 }}>
            ❓ Вікторина
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 10, opacity: lv && !lv[2].open ? 0.75 : 1 }}>
        <div className="stat" style={{ borderBottom: 0, padding: "0 0 4px" }}>
          <span>
            <b>Рівень 2 · {PLEVEL_TITLES[2]}</b>
          </span>
          <Counts level={2} />
        </div>
        {lv?.[2].open ? (
          <>
            <div className="row" style={{ marginBottom: 8 }}>
              <Link href="/personal/cards" className="btn primary" onClick={() => setLevel(2)} style={{ flex: 1 }}>
                🃏 Картки
              </Link>
              <Link href="/personal/quiz" className="btn" onClick={() => setLevel(2)} style={{ flex: 1 }}>
                ❓ Вікторина
              </Link>
            </div>
            <Link href="/personal/sentences" className="btn">
              📝 Речення: склади з блоків
            </Link>
          </>
        ) : (
          <Lock level={2} />
        )}
      </div>

      <div className="card" style={{ marginBottom: 10, opacity: lv && !lv[3].open ? 0.75 : 1 }}>
        <div className="stat" style={{ borderBottom: 0, padding: "0 0 4px" }}>
          <span>
            <b>Рівень 3 · {PLEVEL_TITLES[3]}</b>
          </span>
          <Counts level={3} />
        </div>
        {lv?.[3].open ? (
          <div className="row">
            <Link href="/personal/dialogues" className="btn primary" style={{ flex: 1 }}>
              💬 Діалоги
            </Link>
            <Link href="/personal/texts" className="btn" style={{ flex: 1 }}>
              📄 Тексти
            </Link>
          </div>
        ) : (
          <Lock level={3} />
        )}
      </div>

      {mistakesTotal > 0 && prog && (
        <div className="card" style={{ marginBottom: 10 }}>
          <b>⚠️ Помилки за тиждень: {mistakesTotal}</b>
          <div className="row" style={{ flexWrap: "wrap", marginTop: 8 }}>
            {Object.entries(prog.mistakes)
              .filter(([, n]) => n > 0)
              .map(([page, n]) => (
                <Link key={page} href={`/personal/${page}`} className="btn ghost" onClick={() => requestPMistakes(page)} style={{ flex: "1 1 40%", minHeight: 40, fontSize: 15 }}>
                  {PAGE_TITLES[page]} <span className="badge">{n}</span>
                </Link>
              ))}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 18, marginTop: 20 }}>Словник теми</h2>
      <p className="muted" style={{ fontSize: 14 }}>
        Торкнись теми, щоб розгорнути. ⚠ — перевірити з носієм.
      </p>
      {topic.themes.map((th) => {
        const words = topic.items.filter((it) => it.theme === th.id);
        if (!words.length) return null;
        return (
          <details key={th.id} className="card" style={{ marginBottom: 8, padding: "10px 14px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              {th.title} <span className="muted" style={{ fontWeight: 400 }}>· {words.length}</span>
            </summary>
            <div style={{ marginTop: 8 }}>
              {words.map((it) => (
                <div key={it.id} className="stat" style={{ padding: "6px 0", alignItems: "flex-start" }}>
                  <span>
                    <span lang="hu" style={{ fontWeight: 600 }}>
                      {it.check && "⚠ "}
                      {it.hu}
                    </span>
                    <br />
                    <span className="muted" style={{ fontSize: 14 }}>
                      {it.ua}
                    </span>
                    {it.note && (
                      <>
                        <br />
                        <span className="muted" style={{ fontSize: 13 }}>
                          {it.note}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {it.level === 2 ? "фраза" : it.pos ?? ""}
                  </span>
                </div>
              ))}
            </div>
          </details>
        );
      })}
      <Link href="/personal" className="btn ghost" style={{ marginTop: 10 }}>
        До списку тем
      </Link>
    </>
  );
}
