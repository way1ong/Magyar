"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { allItems, harmonyStems, packs } from "@/lib/content";
import { builderTasks } from "@/lib/builder";
import { ensureCards, dueCount } from "@/lib/scheduler";
import { streak, todayCount } from "@/lib/stats";
import { db } from "@/lib/db";

export default function Home() {
  // Seed cards for every item on first launch (idempotent).
  useEffect(() => {
    const ids = allItems.map((i) => i.id);
    ensureCards("recognize", ids);
    ensureCards("recall", ids);
    ensureCards("harmony", harmonyStems.map((i) => i.id));
    ensureCards("builder", builderTasks.map((t) => t.id));
  }, []);

  const stats = useLiveQuery(async () => {
    const [rec, rcl, har, bld, s, t, total] = await Promise.all([
      dueCount("recognize"),
      dueCount("recall"),
      dueCount("harmony"),
      dueCount("builder"),
      streak(),
      todayCount(),
      db.cards.where("state").notEqual(0).count(),
    ]);
    return { cards: rec + rcl, harmony: har, builder: bld, streak: s, today: t, learned: total };
  });

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
            {stats?.learned ?? "…"} / {allItems.length * 2 + harmonyStems.length + builderTasks.length}
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

      <p className="muted" style={{ marginTop: 24 }}>
        Пакети: {packs.map((p) => `${p.id} — ${p.title}`).join("; ")}
      </p>
    </>
  );
}
