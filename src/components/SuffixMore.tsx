"use client";
import { useState } from "react";
import type { Pattern } from "@/lib/types";
import { suffixFamily, suffixNote } from "@/lib/suffixnotes";

/** The detailed explanation of a suffix: its family table (place suffixes), notes and examples. */
export function SuffixNoteBody({ pattern }: { pattern: Pattern }) {
  const note = suffixNote(pattern.id);
  const fam = suffixFamily(pattern.id);
  return (
    <>
      {fam && (
        <>
          <table className="family-table" lang="hu">
            <caption lang="uk">{fam.title}</caption>
            <thead>
              <tr>
                <th />
                {fam.cols.map((c) => (
                  <th key={c} lang="uk">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fam.rows.map((r) => (
                <tr key={r.label}>
                  <th lang="uk">{r.label}</th>
                  {r.cells.map(([id, label]) => (
                    <td key={id} className={id === pattern.id ? "hit" : undefined}>
                      {label}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {fam.intro.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </>
      )}
      {note && (
        <>
          {fam && (
            <p className="why-h">
              <span lang="hu">{pattern.name}</span>
            </p>
          )}
          {note.text.map((t) => (
            <p key={t}>{t}</p>
          ))}
          {note.examples.length > 0 && (
            <ul>
              {note.examples.map((e) => (
                <li key={e.hu}>
                  <b lang="hu">{e.hu}</b> — {e.ua}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

/**
 * «Детальніше про …» after an answer in the Builder and Harmony: hidden until
 * asked for, so it does not slow the drill down. Remount it per card (key) to
 * close it for the next one.
 */
export function SuffixMore({ pattern }: { pattern: Pattern }) {
  const [open, setOpen] = useState(false);
  if (!suffixNote(pattern.id) && !suffixFamily(pattern.id)) return null;
  return (
    <>
      <button type="button" className="btn ghost" onClick={() => setOpen((v) => !v)} style={{ marginTop: 10, minHeight: 0, padding: "6px 12px", fontSize: 14 }}>
        {open ? "Сховати пояснення" : `Детальніше про ${pattern.name}`}
      </button>
      {open && (
        <div className="why">
          <SuffixNoteBody pattern={pattern} />
        </div>
      )}
    </>
  );
}
