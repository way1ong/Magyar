"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { packs } from "@/lib/content";
import { dueCount } from "@/lib/scheduler";
import { seedCards } from "@/lib/seed";
import { maybeAutoBackup } from "@/lib/backup";
import { AUDIO_ENABLED } from "@/lib/config";
import { streak, todayCount } from "@/lib/stats";
import { BOSS_PASS, bossResults, packProgress, unlockedCount } from "@/lib/progress";
import { PackList } from "@/components/PackList";
import { db, withRetry } from "@/lib/db";

type Stats = Awaited<ReturnType<typeof loadStats>>;

async function loadStats() {
  // One query at a time, retried if the browser aborts a transaction: on a
  // phone a dozen parallel reads right after the app resumed were aborted.
  return withRetry(async () => {
    const rec = await dueCount("recognize");
    const rcl = await dueCount("recall");
    const har = await dueCount("harmony");
    const bld = await dueCount("builder");
    const dic = await dueCount("dictation");
    const cnj = await dueCount("conj");
    const sen = await dueCount("sentence");
    const s = await streak();
    const t = await todayCount();
    const learned = await db.cards.where("state").notEqual(0).count();
    const total = await db.cards.count();
    const boss = await bossResults();
    const progress = await packProgress();
    const open = await unlockedCount(boss);
    return { cards: rec + rcl, harmony: har, builder: bld, dictation: dic, conj: cnj, sentence: sen, streak: s, today: t, learned, total, boss, open, progress };
  });
}

export default function Home() {
  // Seed cards for every item of every open pack on first launch (idempotent).
  useEffect(() => {
    seedCards();
    maybeAutoBackup();
  }, []);

  // If the counts never arrive (IndexedDB blocked, a bug), say so instead of
  // leaving "…" everywhere: the error text and a reload button after a pause.
  const [err, setErr] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

  const live = useLiveQuery(async () => {
    try {
      return await loadStats();
    } catch (e) {
      const inner = (e as { inner?: { name?: string; message?: string } }).inner;
      setErr(e instanceof Error ? `${e.name}: ${e.message}${inner ? ` ← ${inner.name}: ${inner.message}` : ""}` : String(e));
      return null;
    }
  });
  // A plain read on mount and whenever the app comes back to the foreground:
  // on some phones the live query did not deliver after navigating back home.
  const [once, setOnce] = useState<Stats | null>(null);
  useEffect(() => {
    let alive = true;
    const run = () => loadStats().then((s) => alive && setOnce(s)).catch(() => {});
    run();
    const onShow = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pageshow", run);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pageshow", run);
    };
  }, []);
  const stats = live ?? once;

  useEffect(() => {
    if (stats) return;
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, [stats]);

  const gate = stats ? packs[stats.open - 1] : undefined;
  const gateRes = gate ? stats?.boss.get(gate.id) : undefined;
  const gatePassed = gateRes?.passed ?? false;

  const problem =
    err || (slow && !stats) ? (
      <div className="card" style={{ borderColor: "var(--bad)" }}>
        <p style={{ marginTop: 0 }}>{err ? `Не вдалось прочитати прогрес: ${err}` : "Прогрес рахується надто довго."}</p>
        <button className="btn" onClick={() => window.location.reload()}>
          Перезавантажити
        </button>
      </div>
    ) : null;

  return (
    <>
      <h1 className="title">Сьогодні</h1>
      {problem}

      <div className="card">
        <div className="stat">
          <span>🔥 Стрік</span>
          <b>{stats?.streak ?? "…"} дн.</b>
        </div>
        <div className="stat">
          <span>Повторень сьогодні</span>
          <b>{stats?.today ?? "…"}</b>
        </div>
        <div className="stat">
          <span>Карток у роботі</span>
          <b>
            {stats?.learned ?? "…"} / {stats?.total ?? "…"}
          </b>
        </div>
      </div>

      <Link href="/review" className="btn primary" style={{ marginBottom: 10 }}>
        🃏 Картки <span className="badge">{stats?.cards ?? "…"}</span>
      </Link>
      <Link href="/harmony" className="btn" style={{ marginBottom: 10 }}>
        🎵 Гармонія голосних <span className="badge">{stats?.harmony ?? "…"}</span>
      </Link>
      <Link href="/builder" className="btn" style={{ marginBottom: 10 }}>
        🧩 Конструктор <span className="badge">{stats?.builder ?? "…"}</span>
      </Link>
      <Link href="/conj" className="btn" style={{ marginBottom: 10 }}>
        🔤 Дієвідміна <span className="badge">{stats?.conj ?? "…"}</span>
      </Link>
      <Link href="/sentences" className="btn" style={{ marginBottom: 10 }}>
        📝 Речення <span className="badge">{stats?.sentence ?? "…"}</span>
      </Link>
      {AUDIO_ENABLED && (
        <Link href="/dictation" className="btn" style={{ marginBottom: 10 }}>
          ✍️ Диктант <span className="badge">{stats?.dictation ?? "…"}</span>
        </Link>
      )}

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Пакети</h2>
      {stats ? (
        <PackList open={stats.open} boss={stats.boss} progress={stats.progress} />
      ) : (
        <p className="muted">Рахую прогрес…</p>
      )}
      {gate && (
        <Link href="/boss" className="btn" style={{ marginTop: 10 }}>
          👑 {gatePassed
            ? `Бос ${gate.id} — пройдено, повторити`
            : gateRes
              ? `Бос ${gate.id} — найкращий ${Math.round(gateRes.best * 100)}%, треба ${Math.round(BOSS_PASS * 100)}%`
              : `Бос пакета ${gate.id}`}
        </Link>
      )}
      <p className="muted" style={{ fontSize: 14, marginTop: 10 }}>
        Пакети відкриваються по черзі: бос поточного пакета (20 питань без підказок, ≥ 80%) відкриває наступний.
      </p>
    </>
  );
}
