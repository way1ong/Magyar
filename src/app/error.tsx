"use client";
import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary for every page: instead of Next's bare "Application error"
 * the person sees what broke (name, message, first stack lines) and can
 * send it along, plus a way back. The last error is kept in localStorage
 * so Settings can show it later.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stack = (error.stack ?? "").split("\n").slice(1, 4).join("\n");
  useEffect(() => {
    try {
      localStorage.setItem("magyar:lastError", `${new Date().toISOString()} ${error.name}: ${error.message}\n${stack}`);
    } catch {
      // Storage may be unavailable; the screen still shows the error.
    }
  }, [error, stack]);
  return (
    <>
      <h1 className="title">Щось зламалось</h1>
      <div className="card">
        <p style={{ marginTop: 0 }}>Сталася помилка. Зроби скриншот цього екрана — так її буде легко виправити.</p>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: 0 }} className="muted">
          {error.name}: {error.message}
          {error.digest ? `\n[${error.digest}]` : ""}
          {stack ? `\n${stack}` : ""}
        </pre>
      </div>
      <button className="btn primary" onClick={reset}>
        Спробувати ще раз
      </button>
      <Link href="/" className="btn ghost" style={{ marginTop: 8 }}>
        На головну
      </Link>
    </>
  );
}
