"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { formsFor, packOf, roleLabel, searchItems } from "@/lib/dictionary";
import { conjugate, hasImperative, isConjugable, isTransitive, PERSONS, PRONOUN, TENSES, tenseLabel } from "@/lib/conj";
import type { Item } from "@/lib/types";

const POS_UA: Record<string, string> = { noun: "іменник", verb: "дієслово", adj: "прикметник", adv: "прислівник", num: "числівник", pron: "займенник", phrase: "фраза", other: "" };

function Conjugation({ item }: { item: Item }) {
  const tr = isTransitive(item);
  const tenses = TENSES.filter((t) => t !== "imp" || hasImperative(item));
  return (
    <>
      {tenses.map((t) => (
        <div key={t} className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th>{tenseLabel(t)}</th>
                <th>неозначена</th>
                {tr && <th>означена</th>}
              </tr>
            </thead>
            <tbody>
              {PERSONS.map((p) => (
                <tr key={p}>
                  <td>{PRONOUN[p]}</td>
                  <td lang="hu">{conjugate(item, { tense: t, def: false, person: p })}</td>
                  {tr && <td lang="hu">{conjugate(item, { tense: t, def: true, person: p })}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

function Entry({ item }: { item: Item }) {
  const forms = useMemo(() => formsFor(item), [item]);
  const pack = packOf(item);
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <p className="hu" lang="hu" style={{ fontSize: 28, margin: "0 0 4px" }}>{item.hu}</p>
      <p style={{ margin: "0 0 6px", fontSize: 18 }}>{item.ua}</p>
      <p className="muted" style={{ margin: "0 0 10px", fontSize: 14 }}>
        {[POS_UA[item.pos], roleLabel(item), item.harmony === "back" ? "задня гармонія" : item.harmony === "front" ? "передня гармонія" : item.harmony === "front_rounded" ? "передня огублена" : "", `${pack.id} — ${pack.title}`].filter(Boolean).join(" · ")}
      </p>
      {item.example && (
        <p className="example" lang="hu" style={{ margin: "0 0 10px" }}>
          {item.example.hu} <span className="muted" lang="uk">— {item.example.ua}</span>
        </p>
      )}
      {forms.length > 0 && (
        <div className="guide-table-wrap">
          <table className="guide-table">
            <tbody>
              {forms.map((f) => (
                <tr key={f.pattern.id}>
                  <td style={{ whiteSpace: "normal" }}>{f.label}</td>
                  <td lang="hu"><b>{f.form}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {isConjugable(item) && <Conjugation item={item} />}
    </div>
  );
}

/**
 * Dictionary: look a word up by Hungarian (accents optional) or Ukrainian,
 * open it to see every form the app can build — cases, possessives, the
 * derivations that fit the word, the whole conjugation for a verb.
 */
export default function DictionaryPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const results = useMemo(() => searchItems(q), [q]);
  const current = results.find((r) => r.id === open) ?? (results.length === 1 ? results[0] : null);

  return (
    <>
      <h1 className="title">Словник</h1>
      <input
        id="dict-search"
        className="dictation-input"
        style={{ fontSize: 18, marginBottom: 10 }}
        placeholder="hu або українською: haz, будинок…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(null);
        }}
        autoComplete="off"
        autoCapitalize="none"
        aria-label="Пошук у словнику"
      />
      {!q.trim() && <p className="muted">Усі слова всіх пакетів. Акценти можна не ставити: «haz» знайде ház. Відкрите слово показує відмінки, присвійні, похідні форми й повну дієвідміну.</p>}
      {q.trim() && results.length === 0 && <p className="muted">Нічого не знайдено.</p>}
      {current && <Entry item={current} />}
      {results.length > 1 && (
        <div className="card" style={{ padding: "4px 16px", marginTop: 12 }}>
          {results.map((r) => (
            <button key={r.id} className="stat" onClick={() => setOpen(r.id)} style={{ width: "100%", background: "none", border: 0, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer", padding: "12px 0" }}>
              <span>
                <b lang="hu">{r.hu}</b> <span className="muted">— {r.ua}</span>
              </span>
              <span className="muted" style={{ whiteSpace: "nowrap", marginLeft: 8 }}>{POS_UA[r.pos]}</span>
            </button>
          ))}
        </div>
      )}
      <Link href="/" className="btn ghost" style={{ marginTop: 20 }}>← На головну</Link>
    </>
  );
}
