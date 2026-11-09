"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DAY_PLAN } from "@/lib/day";
import { MISTAKE_DAYS, mistakeCounts, requestMistakeMode } from "@/lib/mistakes";

/** Recent mistakes per exercise, with a button that opens the exercise on just those cards. */
export default function MistakesPage() {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    mistakeCounts().then(setCounts).catch(() => setCounts({}));
  }, []);
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const go = (page: string, href: string) => {
    requestMistakeMode(page);
    router.push(href);
  };
  return (
    <>
      <h1 className="title">Помилки</h1>
      <p className="muted">Картки, на які за останні {MISTAKE_DAYS} днів ти відповів «Ні» (і ще не виправив). Кожна кнопка відкриває вправу лише з цими картками.</p>
      {counts === null && <p className="muted">Рахую…</p>}
      {counts && total === 0 && (
        <div className="card">
          <p style={{ margin: 0 }}>Помилок за тиждень нема — або все виправлено. 👍</p>
        </div>
      )}
      {counts &&
        DAY_PLAN.map((s) =>
          counts[s.step] ? (
            <button key={s.step} className="btn" style={{ marginBottom: 10 }} onClick={() => go(s.step, s.href)}>
              {s.icon} {s.label} <span className="badge">{counts[s.step]}</span>
            </button>
          ) : null,
        )}
      <Link href="/" className="btn ghost" style={{ marginTop: 10 }}>← На головну</Link>
    </>
  );
}
