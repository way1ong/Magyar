"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { packs } from "@/lib/content";
import { dueCount } from "@/lib/scheduler";
import { seedCards } from "@/lib/seed";
import { maybeAutoBackup } from "@/lib/backup";
import { AUDIO_ENABLED } from "@/lib/config";
import { streak, todayCount } from "@/lib/stats";
import { bossResults, unlockedCount } from "@/lib/progress";
import { db } from "@/lib/db";

export default function Home() {
  // Seed cards for every item of every open pack on first launch (idempotent).
  useEffect(() => {
    seedCards();
    maybeAutoBackup();
  }, []);

  const stats = useLiveQuery(async () => {
    const [rec, rcl, har, bld, dic, s, t, learned, total, boss] = await Promise.all([
      dueCount("recognize"),
      dueCount("recall"),
      dueCount("harmony"),
      dueCount("builder"),
      dueCount("dictation"),
      streak(),
      todayCount(),
      db.cards.where("state").notEqual(0).count(),
      db.cards.count(),
      bossResults(),
    ]);
    const open = await unlockedCount(boss);
    return { cards: rec + rcl, harmony: har, builder: bld, dictation: dic, streak: s, today: t, learned, total, boss, open };
  });

  const gate = stats ? packs[stats.open - 1] : undefined;
  const gatePassed = gate ? stats?.boss.get(gate.id)?.passed : false;

  return (
    <>
      <h1 className="title">Сьогодні</h1>

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
      {AUDIO_ENABLED && (
        <Link href="/dictation" className="btn" style={{ marginBottom: 10 }}>
          ✍️ Диктант <span className="badge">{stats?.dictation ?? "…"}</span>
        </Link>
      )}

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Пакети</h2>
      <div className="card" style={{ padding: "4px 18px" }}>
        {packs.map((p, n) => {
          const res = stats?.boss.get(p.id);
          const open = stats ? n < stats.open : n === 0;
          const icon = res?.passed ? "🏆" : open ? "📖" : "🔒";
          return (
            <div className="stat" key={p.id} style={{ opacity: open ? 1 : 0.55 }}>
              <span>
                {icon} <b>{p.id}</b> — {p.title}
              </span>
              <span className="muted" style={{ whiteSpace: "nowrap", marginLeft: 8 }}>
                {res?.passed ? `${Math.round(res.best * 100)}%` : open ? "" : "закрито"}
              </span>
            </div>
          );
        })}
      </div>
      {gate && (
        <Link href="/boss" className="btn" style={{ marginTop: 10 }}>
          👑 {gatePassed ? `Бос ${gate.id} — пройдено, повторити` : `Бос пакета ${gate.id}`}
        </Link>
      )}
      <p className="muted" style={{ fontSize: 14, marginTop: 10 }}>
        Пройди боса (≥ 80% без підказок), щоб відкрити наступний пакет.
      </p>
    </>
  );
}
