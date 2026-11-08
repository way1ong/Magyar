"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, exportProgress, importProgress } from "@/lib/db";
import { backupToLaptop, IS_STATIC, NO_LAPTOP, lastBackup, shareProgress } from "@/lib/backup";
import { allItems, allPatterns } from "@/lib/content";
import { getTypingMode, setTypingMode, TYPING_LABELS, type TypingMode } from "@/lib/settings";

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [confirming, setConfirming] = useState(false);
  // The single-file preview (Claude artifact) can't download files.
  const isPreview = process.env.NEXT_PUBLIC_MAGYAR_PREVIEW === "1";
  const counts = useLiveQuery(async () => ({
    cards: await db.cards.count(),
    reviews: await db.reviews.count(),
    backup: await lastBackup(),
  }));
  const typing = useLiveQuery(getTypingMode);
  const [busy, setBusy] = useState(false);
  // The last crash caught by app/error.tsx, so it can be reported after the fact.
  const [lastError, setLastError] = useState("");
  useEffect(() => {
    try {
      setLastError(localStorage.getItem("magyar:lastError") ?? "");
    } catch {
      // Storage unavailable — nothing to show.
    }
  }, []);
  const clearError = () => {
    try {
      localStorage.removeItem("magyar:lastError");
    } catch {
      // ignore
    }
    setLastError("");
  };

  const doLaptop = async () => {
    setBusy(true);
    try {
      const b = await backupToLaptop();
      setMsg(`Збережено на ноутбуці: ${b.name}`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doShare = async () => {
    if (!(await shareProgress())) {
      setMsg("Цей браузер не вміє ділитися файлами — скористайся експортом нижче.");
    }
  };

  const doExport = async () => {
    const data = await exportProgress();
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `magyar-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (data?.version !== 1) throw new Error("Невідомий формат");
      await importProgress(data);
      setMsg(`Імпортовано: ${data.cards.length} карток, ${data.reviews.length} повторень.`);
    } catch (e) {
      setMsg(`Помилка: ${(e as Error).message}`);
    }
  };

  // Two-step confirmation in the page itself (confirm() is blocked in some webviews).
  const reset = async () => {
    await db.delete();
    location.reload();
  };

  return (
    <>
      <h1 className="title">Ще</h1>

      <Link href="/guide" className="btn" style={{ marginBottom: 14 }}>
        📖 Довідка: терміни й особливості угорської
      </Link>

      <div className="card">
        <div className="stat"><span>Слів і фраз у контенті</span><b>{allItems.length}</b></div>
        <div className="stat"><span>Суфіксальних патернів</span><b>{allPatterns.length}</b></div>
        <div className="stat"><span>Карток у базі</span><b>{counts?.cards ?? "…"}</b></div>
        <div className="stat"><span>Повторень у журналі</span><b>{counts?.reviews ?? "…"}</b></div>
      </div>

      <h2 style={{ fontSize: 18 }}>Гармонія і Дієвідміна: набір тексту</h2>
      <p className="muted">
        Замість кнопок із варіантами — набрати все слово. Довгі голосні перевіряються окремо (á/a — «майже»).
      </p>
      <div className="seg" role="radiogroup" aria-label="Коли набирати текст">
        {(["auto", "always", "never"] as TypingMode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={typing === m}
            className={`btn${typing === m ? " on" : ""}`}
            onClick={() => setTypingMode(m)}
          >
            {TYPING_LABELS[m]}
          </button>
        ))}
      </div>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Резервна копія</h2>
      <p className="muted">
        Прогрес живе лише на цьому телефоні.{" "}
        {IS_STATIC
          ? "Застосунок встановлено з GitHub Pages, тож бекапу на ноутбук тут нема — раз на тиждень натискай «Поділитися» й клади файл у Drive чи месенджер."
          : "Копія на ноутбук робиться сама, коли є нові повторення і ноутбук у тій самій Wi-Fi; «Поділитися» кладе файл у Drive чи месенджер."}
      </p>
      {!NO_LAPTOP && <p className="muted" style={{ fontSize: 14 }}>
        Останній бекап на ноутбук:{" "}
        {counts?.backup
          ? `${new Date(counts.backup.ts).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" })} (${counts.backup.name})`
          : "ще не було"}
        {counts?.backup && counts.reviews > counts.backup.reviews && ` — відтоді ${counts.reviews - counts.backup.reviews} нових повторень`}
      </p>}
      {!NO_LAPTOP && (
        <button className="btn primary" onClick={doLaptop} disabled={busy} style={{ marginBottom: 10 }}>
          💻 {busy ? "Зберігаю…" : "Бекап на ноутбук"}
        </button>
      )}
      <button className="btn" onClick={doShare} style={{ marginBottom: 10 }}>📤 Поділитися файлом прогресу</button>
      <button className="btn" onClick={doExport} style={{ marginBottom: 10 }}>⬇️ Експорт прогресу (JSON)</button>
      {isPreview && (
        <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
          У тестовій збірці файл не завантажиться і бекапу на ноутбук нема — перевіряй у застосунку на телефоні.
        </p>
      )}
      <button className="btn" onClick={() => fileRef.current?.click()} style={{ marginBottom: 10 }}>⬆️ Імпорт прогресу</button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
      />
      {msg && <p>{msg}</p>}

      <h2 style={{ fontSize: 18, marginTop: 32 }}>Небезпечна зона</h2>
      {lastError && (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ marginTop: 0 }}><b>Остання помилка</b> (зроби скриншот і надішли розробнику):</p>
          <pre className="muted" style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: "0 0 10px" }}>{lastError}</pre>
          <button className="btn ghost" onClick={clearError}>Приховати</button>
        </div>
      )}

      {confirming ? (
        <div className="card">
          <p style={{ marginTop: 0 }}>Стерти всі картки й журнал повторень на цьому пристрої? Це не можна скасувати.</p>
          <div className="row">
            <button className="btn" onClick={() => setConfirming(false)}>Ні, залишити</button>
            <button className="btn" onClick={reset} style={{ background: "var(--bad)", borderColor: "var(--bad)", color: "#fff" }}>
              Так, стерти
            </button>
          </div>
        </div>
      ) : (
        <button className="btn ghost" onClick={() => setConfirming(true)} style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>
          Стерти прогрес
        </button>
      )}
    </>
  );
}
