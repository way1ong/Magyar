"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { computeStats, setWeeklyGoal, type Bucket, type Stats } from "@/lib/statistics";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
/** Heat colour: green when accurate, red when not; grey without data. */
const heat = (b: Bucket) => {
  if (b.accuracy === null) return "var(--line)";
  const a = b.accuracy;
  return a >= 0.9 ? "var(--ok)" : a >= 0.75 ? "#8fae3a" : a >= 0.6 ? "var(--warn)" : "var(--bad)";
};

function Bars({ rows, showKnown }: { rows: Bucket[]; showKnown?: boolean }) {
  return (
    <div className="card" style={{ padding: "6px 16px" }}>
      {rows.map((b) => (
        <div key={b.id} className="stat" style={{ padding: "10px 0", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: heat(b), marginRight: 8, verticalAlign: "middle" }} />
            <span lang="hu">{b.label}</span>
            {showKnown && (
              <span className="muted" style={{ fontSize: 13 }}>
                {" "}· {b.started} у роботі · {b.known} міцно
              </span>
            )}
          </span>
          <b style={{ whiteSpace: "nowrap" }}>
            {pct(b.accuracy)}
            {b.reviews ? <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}> · {b.reviews}</span> : null}
          </b>
        </div>
      ))}
    </div>
  );
}

/** Activity calendar, knowledge by pack / suffix / exercise, weekly goal and the hardest cards. */
export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => computeStats().then(setStats).catch((e) => setErr(String(e))), []);
  useEffect(() => {
    load();
  }, [load]);
  const goal = async (delta: number) => {
    if (!stats) return;
    const n = Math.max(25, stats.weeklyGoal + delta);
    await setWeeklyGoal(n);
    setStats({ ...stats, weeklyGoal: n });
  };

  if (err) return <p className="muted">Не вдалось порахувати: {err}</p>;
  if (!stats) return <p className="muted">Рахую…</p>;
  const max = Math.max(1, ...stats.calendar.map((d) => d.count));
  const weekPct = Math.min(100, Math.round((stats.weekReviews / stats.weeklyGoal) * 100));
  const weak = [...stats.byPattern, ...stats.byPack].filter((b) => b.accuracy !== null && b.reviews >= 5 && b.accuracy < 0.75).sort((a, b) => a.accuracy! - b.accuracy!).slice(0, 5);

  return (
    <>
      <h1 className="title">Статистика</h1>

      <div className="card">
        <div className="stat" style={{ padding: "4px 0 8px", borderBottom: 0 }}>
          <span><b>Цього тижня</b></span>
          <span>
            <b>{stats.weekReviews}</b> <span className="muted">/ {stats.weeklyGoal} повторень</span>
          </span>
        </div>
        <div className="pbar">
          <i className="known" style={{ width: `${weekPct}%` }} />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="muted" style={{ fontSize: 14 }}>Тижнева мета</span>
          <span className="grow" />
          <button className="btn ghost" onClick={() => goal(-25)} style={{ padding: "4px 12px", minHeight: 0 }}>−25</button>
          <button className="btn ghost" onClick={() => goal(25)} style={{ padding: "4px 12px", minHeight: 0 }}>+25</button>
        </div>
      </div>

      <h2 style={{ fontSize: 18, marginTop: 20 }}>Активність, 12 тижнів</h2>
      <div className="card">
        <div className="heatmap">
          {stats.calendar.map((d) => (
            <span key={d.date} title={`${d.date}: ${d.count}`} className="cell" style={{ opacity: d.count ? 0.3 + 0.7 * (d.count / max) : 1, background: d.count ? "var(--ok)" : "var(--line)" }} />
          ))}
        </div>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 14 }}>Усього повторень: {stats.totalReviews}. Колонка — тиждень, рядок — день (пн … нд).</p>
      </div>

      {weak.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, marginTop: 20 }}>Де найбільше помилок</h2>
          <Bars rows={weak} />
        </>
      )}

      <h2 style={{ fontSize: 18, marginTop: 20 }}>За вправами</h2>
      <Bars rows={stats.byExercise} showKnown />

      <h2 style={{ fontSize: 18, marginTop: 20 }}>За темами</h2>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>Точність за 30 днів і кількість повторень. «У роботі» — картки, які ти вже бачив; «міцно» — ті, що повернуться не раніше ніж за три тижні (так FSRS позначає вивчене; на перших тижнях тут буде 0).</p>
      <Bars rows={stats.byPack} showKnown />

      <h2 style={{ fontSize: 18, marginTop: 20 }}>За суфіксами</h2>
      <div className="card">
        <div className="suffix-grid">
          {stats.byPattern.map((b) => (
            <span key={b.id} className="chip" style={{ borderColor: heat(b) }} lang="hu" title={`${b.label}: ${pct(b.accuracy)} (${b.reviews})`}>
              <i style={{ background: heat(b) }} />
              {b.label} <span className="muted">{pct(b.accuracy)}</span>
            </span>
          ))}
        </div>
      </div>

      {stats.hardest.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, marginTop: 20 }}>Найважчі картки</h2>
          <div className="card" style={{ padding: "6px 16px" }}>
            {stats.hardest.map((h) => (
              <div key={h.key} className="stat" style={{ padding: "10px 0" }}>
                <span lang="hu">{h.label}</span>
                <span className="muted" style={{ whiteSpace: "nowrap", marginLeft: 8 }}>забував {h.lapses}×</span>
              </div>
            ))}
          </div>
        </>
      )}

      <Link href="/" className="btn ghost" style={{ marginTop: 20 }}>← На головну</Link>
    </>
  );
}
