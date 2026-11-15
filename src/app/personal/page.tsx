"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { seedPersonal, setCurrentTopic, topics, topicSummary } from "@/lib/personal";

/**
 * Hub of the personal topics: own vocabularies outside the levelled course,
 * always open, with their own progress.
 */
export default function PersonalPage() {
  const [sums, setSums] = useState<Record<string, { total: number; seen: number; checks: number }> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      await seedPersonal();
      const out: Record<string, { total: number; seen: number; checks: number }> = {};
      for (const t of topics) out[t.id] = await topicSummary(t);
      if (alive) setSums(out);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <h1 className="title">Персональні теми</h1>
      <p className="muted">
        Словники для своїх справ, окремо від курсу: доступні завжди, прогрес свій. У кожній темі три рівні — слова, фрази й речення, діалоги й тексти.
      </p>
      {topics.map((t) => {
        const s = sums?.[t.id];
        return (
          <Link key={t.id} href="/personal/topic" className="card" onClick={() => setCurrentTopic(t.id)} style={{ display: "block", marginBottom: 10, textDecoration: "none", color: "inherit" }}>
            <div className="stat" style={{ borderBottom: 0, padding: "0 0 6px" }}>
              <span>
                <b>
                  {t.icon} {t.title}
                </b>
                <br />
                <span className="muted" lang="hu">
                  {t.titleHu}
                </span>
              </span>
              <span className="muted">{s ? `${s.seen} / ${s.total}` : "…"}</span>
            </div>
            <div className="pbar">
              <i style={{ width: `${s && s.total ? (s.seen / s.total) * 100 : 0}%` }} />
            </div>
            <p className="muted" style={{ fontSize: 14, margin: "8px 0 0" }}>
              {t.items.filter((x) => x.level === 1).length} слів · {t.items.filter((x) => x.level === 2).length} фраз · {t.dialogues.length} діалогів · {t.texts.length} текстів
              {s && s.checks > 0 && ` · ⚠ ${s.checks} перевірити`}
            </p>
          </Link>
        );
      })}
      <p className="muted" style={{ fontSize: 14 }}>
        ⚠ — термін, у якому автор не впевнений: варто перевірити з носієм чи в музеї, перш ніж покладатися на нього. Контент тем лежить у файлах <code>content/personal/</code> і легко редагується.
      </p>
      <Link href="/" className="btn ghost" style={{ marginTop: 8 }}>
        На головну
      </Link>
    </>
  );
}
