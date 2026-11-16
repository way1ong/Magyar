"use client";
import Link from "next/link";
import type { SavedSeries } from "@/lib/resume";

/** "Continue or start over" screen for an unfinished series (lib/resume.ts). */
export function ResumeOffer({ title, saved, onContinue, onRestart, back }: { title: string; saved: SavedSeries; onContinue: () => void; onRestart: () => void; back?: { href: string; label: string } }) {
  const total = saved.keys.length;
  return (
    <>
      <h1 className="title">{title}</h1>
      <div className="card big">
        <p className="hu">
          {saved.index} / {total}
        </p>
        <p className="muted">Попередню серію не завершено. Відповіді з неї вже збережено в прогресі.</p>
      </div>
      <button className="btn primary" onClick={onContinue} style={{ marginBottom: 8 }}>
        Продовжити з {saved.index + 1}-ї картки
      </button>
      <button className="btn" onClick={onRestart}>
        Почати нову серію
      </button>
      {back && (
        <Link href={back.href} className="btn ghost" style={{ marginTop: 8 }}>
          {back.label}
        </Link>
      )}
    </>
  );
}
