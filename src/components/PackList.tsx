"use client";
import { packs } from "@/lib/content";
import { BOSS_PASS, type BossResult, type PackProgress } from "@/lib/progress";
import type { ContentPack } from "@/lib/types";

/**
 * Pack list on the home screen, grouped by level into collapsible sections.
 * The level that holds the current gate pack (the last open one) starts
 * expanded; finished and locked levels start folded. Each open pack shows
 * how many of its cards are in work / known, so the learner can see how
 * ready they are for the Boss; the gate pack also shows the Boss standing.
 */
interface Props {
  /** How many packs are open: 1..packs.length. */
  open: number;
  boss: Map<string, BossResult>;
  progress: PackProgress[];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function PackRow({ pack, n, open, boss, prog }: { pack: ContentPack; n: number; open: number; boss?: BossResult; prog: PackProgress }) {
  const isOpen = n < open;
  const isGate = n === open - 1;
  const icon = boss?.passed ? "🏆" : isOpen ? "📖" : "🔒";
  const done = prog.total ? prog.started / prog.total : 0;
  const known = prog.total ? prog.known / prog.total : 0;

  let note: string;
  if (boss?.passed) note = `бос ${pct(boss.best)}`;
  else if (!isOpen) note = `відкриє бос ${packs[n - 1].id}`;
  else if (isGate && boss) note = `бос: найкращий ${pct(boss.best)} зі спроб ${boss.attempts}, треба ${pct(BOSS_PASS)}`;
  else if (isGate) note = `бос ще не пройдений, треба ${pct(BOSS_PASS)}`;
  else note = "";

  return (
    <div className="pack-row" style={{ opacity: isOpen ? 1 : 0.55 }} data-pack={pack.id}>
      <div className="stat" style={{ padding: "12px 0 6px", borderBottom: 0 }}>
        <span>
          {icon} <b>{pack.id}</b> — {pack.title}
        </span>
        {isOpen && (
          <span className="muted" style={{ whiteSpace: "nowrap", marginLeft: 8 }}>
            {prog.started}/{prog.total}
          </span>
        )}
      </div>
      {isOpen && (
        <div className="pbar" title={`У роботі ${prog.started}, знаю ${prog.known} з ${prog.total}`}>
          <i style={{ width: `${done * 100}%` }} />
          <i className="known" style={{ width: `${known * 100}%` }} />
        </div>
      )}
      {note && (
        <p className="muted pack-note">{note}</p>
      )}
    </div>
  );
}

export function PackList({ open, boss, progress }: Props) {
  const levels = [...new Set(packs.map((p) => p.level))];
  const gateLevel = packs[open - 1].level;
  return (
    <>
      {levels.map((lvl) => {
        const idx = packs.map((p, n) => [p, n] as const).filter(([p]) => p.level === lvl);
        const passed = idx.filter(([p]) => boss.get(p.id)?.passed).length;
        const opened = idx.filter(([, n]) => n < open).length;
        const summary = opened === 0 ? "закрито" : `${passed} 🏆 з ${idx.length}`;
        return (
          <details className="pack-level" key={lvl} open={lvl === gateLevel}>
            <summary>
              <span>
                <b>{lvl}</b> <span className="muted">· {idx.length} пак.</span>
              </span>
              <span className="muted">{summary}</span>
            </summary>
            <div className="card" style={{ padding: "4px 18px 8px" }}>
              {idx.map(([p, n]) => (
                <PackRow key={p.id} pack={p} n={n} open={open} boss={boss.get(p.id)} prog={progress[n]} />
              ))}
            </div>
          </details>
        );
      })}
    </>
  );
}
