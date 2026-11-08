"use client";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, exportProgress, importProgress } from "@/lib/db";
import { allItems, allPatterns } from "@/lib/content";

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [confirming, setConfirming] = useState(false);
  // The single-file preview (Claude artifact) can't download files.
  const isPreview = process.env.NEXT_PUBLIC_MAGYAR_PREVIEW === "1";
  const counts = useLiveQuery(async () => ({
    cards: await db.cards.count(),
    reviews: await db.reviews.count(),
  }));

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

      <div className="card">
        <div className="stat"><span>Слів і фраз у контенті</span><b>{allItems.length}</b></div>
        <div className="stat"><span>Суфіксальних патернів</span><b>{allPatterns.length}</b></div>
        <div className="stat"><span>Карток у базі</span><b>{counts?.cards ?? "…"}</b></div>
        <div className="stat"><span>Повторень у журналі</span><b>{counts?.reviews ?? "…"}</b></div>
      </div>

      <h2 style={{ fontSize: 18 }}>Резервна копія</h2>
      <p className="muted">Прогрес живе лише на цьому телефоні. Раз на тиждень — експорт у файл.</p>
      <button className="btn" onClick={doExport} style={{ marginBottom: 10 }}>⬇️ Експорт прогресу (JSON)</button>
      {isPreview && (
        <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
          У тестовій збірці файл не завантажиться — експорт перевіряй у застосунку на телефоні.
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
