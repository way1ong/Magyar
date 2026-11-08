"use client";
import { useState } from "react";
import Link from "next/link";
import guide from "@content/guide.json";
import { allPatterns, patternShort } from "@/lib/content";

interface Example {
  hu: string;
  ua: string;
}

function Examples({ items }: { items: Example[] }) {
  return (
    <ul className="guide-ex">
      {items.map((e) => (
        <li key={e.hu}>
          <b lang="hu">{e.hu}</b> — {e.ua}
        </li>
      ))}
    </ul>
  );
}

/**
 * Reference: how Hungarian differs from Ukrainian, and the grammar terms the
 * exercises use. Content lives in content/guide.json. The three sections are
 * collapsible (closed by default, forced open while searching); the browser
 * keeps a <details> toggle, so nothing is stored.
 */
export default function GuidePage() {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const hit = (...texts: string[]) => !needle || texts.some((t) => t.toLowerCase().includes(needle));

  const specifics = guide.specifics.filter((s) =>
    hit(s.title, s.text, ...s.examples.flatMap((e) => [e.hu, e.ua]))
  );
  const terms = guide.terms.filter((t) =>
    hit(t.term, t.def, t.diff ?? "", ...t.examples.flatMap((e) => [e.hu, e.ua]))
  );
  const suffixes = allPatterns.filter((p) =>
    hit(p.name, patternShort(p), p.meaning, ...p.examples.flatMap((e) => [e.result, e.ua]))
  );

  return (
    <>
      <h1 className="title">Довідка</h1>
      <input
        id="guide-search"
        className="dictation-input"
        style={{ fontSize: 17, marginBottom: 14 }}
        placeholder="Пошук: суфікс, артикль, gy…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
        aria-label="Пошук у довідці"
      />

      <details className="guide-section" open={!!needle || undefined}>
      <summary><h2 className="guide-h2">Чим угорська не схожа на українську <span className="muted">({specifics.length})</span></h2></summary>
      {specifics.length === 0 && <p className="muted">Нічого не знайдено.</p>}
      {specifics.map((s) => (
        <details key={s.id} className="guide-item" open={!!needle}>
          <summary>{s.title}</summary>
          <p>{s.text}</p>
          <Examples items={s.examples} />
        </details>
      ))}

      </details>

      <details className="guide-section" open={!!needle || undefined}>
      <summary><h2 className="guide-h2">Словник термінів <span className="muted">({terms.length})</span></h2></summary>
      {terms.length === 0 && <p className="muted">Нічого не знайдено.</p>}
      {terms.map((t) => (
        <details key={t.term} className="guide-item" open={!!needle}>
          <summary>{t.term}</summary>
          <p>{t.def}</p>
          <Examples items={t.examples} />
          {t.diff && (
            <p className="guide-diff">
              <span className="muted">Відмінність від української: </span>
              {t.diff}
            </p>
          )}
        </details>
      ))}

      </details>

      <details className="guide-section" open={!!needle || undefined}>
      <summary><h2 className="guide-h2">Суфікси в застосунку <span className="muted">({suffixes.length})</span></h2></summary>
      {suffixes.length === 0 && <p className="muted">Нічого не знайдено.</p>}
      {suffixes.map((p) => (
        <details key={p.id} className="guide-item" open={!!needle}>
          <summary>
            <span>
              <b lang="hu">{p.name}</b> — {patternShort(p)}
            </span>
          </summary>
          <p>{p.meaning}</p>
          <Examples items={p.examples.slice(0, 5).map((e) => ({ hu: e.result, ua: e.ua }))} />
        </details>
      ))}
      </details>

      <Link href="/settings" className="btn ghost" style={{ marginTop: 20 }}>← Назад до «Ще»</Link>
    </>
  );
}
