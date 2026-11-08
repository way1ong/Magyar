"use client";
import { conjugate, PERSONS, PRONOUN, type Tense } from "@/lib/conj";
import { stemByHu } from "@/lib/content";
import type { Item } from "@/lib/types";

/**
 * Conjugation reference tables for the guide, computed from lib/conj.ts so
 * they can never disagree with the exercises: the endings, model verbs for
 * every stem type, and the irregular verbs.
 */

const ENDINGS = [
  ["én", "-ok / -ek / -ök · -ik: -om / -em / -öm", "-om / -em / -öm", "-tam / -tem", "-tam / -tem"],
  ["te", "-sz · після s, sz, z: -ol / -el / -öl · після двох приголосних та -ít: -asz / -esz", "-od / -ed / -öd", "-tál / -tél", "-tad / -ted"],
  ["ő", "— · -ik: -ik", "-ja / -i", "-t · або -ott / -ett / -ött", "-ta / -te"],
  ["mi", "-unk / -ünk", "-juk / -jük", "-tunk / -tünk", "-tuk / -tük"],
  ["ti", "-tok / -tek / -tök", "-játok / -itek", "-tatok / -tetek", "-tátok / -tétek"],
  ["ők", "-nak / -nek · після двох приголосних та -ít: -anak / -enek", "-ják / -ik", "-tak / -tek", "-ták / -ték"],
];
const POTENTIAL = "Можливість -hat/-het («може, можна»): до основи додається -hat (задні) / -het (передні), далі звичайні закінчення теперішнього часу: parkolhatok, parkolhatsz, parkolhat; означена: megnézhetem, megnézheted. Неправильні: ehet, ihat, vehet, vihet, tehet, hihet, mehet, jöhet, lehet, alhat. Minden lehet. Itt parkolhatok?";
const FUTURE = "Майбутній: fog + інфінітив — fogok, fogsz, fog, fogunk, fogtok, fognak (означена: fogom, fogod, fogja, fogjuk, fogjátok, fogják) + dolgozni; відокремлюваний префікс іде наперед: el fogok menni, meg fogom nézni. lenni: leszek, leszel, lesz, leszünk, lesztek, lesznek.";

const MODELS: [string, string][] = [
  ["látni", "звичайна основа"],
  ["kérni", "передня основа"],
  ["ülni", "передня огублена"],
  ["olvasni", "s / sz / z: -ol, olvassa"],
  ["mondani", "дві приголосні"],
  ["tanítani", "-ít: голосна скрізь у минулому"],
  ["fizetni", "коротка голосна + t"],
  ["lakni", "-ik дієслово"],
  ["érezni", "випадна голосна: érz-ek"],
];

const IRREGULAR_HU: [string, string][] = [
  ["lenni", "бути"], ["menni", "іти, їхати"], ["jönni", "приходити"], ["enni", "їсти"], ["inni", "пити"],
  ["venni", "купувати; брати"], ["vinni", "нести, везти"], ["tenni", "класти; робити"], ["hinni", "вірити"],
];

function verb(hu: string, ua = ""): Item {
  return stemByHu(hu) ?? { id: `guide-${hu}`, type: "word", hu, ua, pos: "verb", harmony: "front" };
}

function Paradigm({ item, note }: { item: Item; note?: string }) {
  const cols: [Tense, boolean, string][] = [["pres", false, "теперішній"], ["pres", true, "теп. означена"], ["past", false, "минулий"], ["past", true, "мин. означена"], ["fut", false, "майбутній"], ["pot", false, "може (-hat/-het)"]];
  const has = cols.filter(([t, d]) => conjugate(item, { tense: t, def: d, person: "1sg" }));
  return (
    <div className="guide-table-wrap">
      <table className="guide-table">
        <thead>
          <tr>
            <th lang="hu">{item.hu}{note ? ` — ${note}` : item.ua ? ` — ${item.ua}` : ""}</th>
            {has.map(([t, d, label]) => <th key={`${t}${d}`}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {PERSONS.map((p) => (
            <tr key={p}>
              <td>{PRONOUN[p]}</td>
              {has.map(([t, d]) => <td key={`${t}${d}`} lang="hu">{conjugate(item, { tense: t, def: d, person: p })}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Plain text of everything the tables show — for the guide's search box. */
export function conjGuideText(): string {
  const items = [...MODELS.map(([hu]) => verb(hu)), ...IRREGULAR_HU.map(([hu, ua]) => verb(hu, ua))];
  const forms = items.flatMap((it) => ["pres", "past", "fut", "pot"].flatMap((t) => [false, true].flatMap((d) => PERSONS.map((p) => conjugate(it, { tense: t as Tense, def: d, person: p })))));
  return [...ENDINGS.flat(), FUTURE, POTENTIAL, ...MODELS.flat(), ...IRREGULAR_HU.flat(), ...forms].join(" ");
}

export function ConjTables() {
  return (
    <>
      <h3 className="guide-h3">Закінчення</h3>
      <div className="guide-table-wrap">
        <table className="guide-table">
          <thead>
            <tr><th>особа</th><th>теперішній, неозначена</th><th>теперішній, означена</th><th>минулий, неозначена</th><th>минулий, означена</th></tr>
          </thead>
          <tbody>
            {ENDINGS.map((r) => (
              <tr key={r[0]}>{r.map((c, i) => <td key={i} lang={i ? "hu" : undefined} style={i === 1 ? { whiteSpace: "normal", minWidth: 220 } : undefined}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 15 }}>{FUTURE}</p>
      <p style={{ fontSize: 15 }}>{POTENTIAL}</p>
      <h3 className="guide-h3">Зразки за типом основи</h3>
      {MODELS.map(([hu, note]) => <Paradigm key={hu} item={verb(hu)} note={note} />)}
      <h3 className="guide-h3">Неправильні дієслова</h3>
      {IRREGULAR_HU.map(([hu, ua]) => <Paradigm key={hu} item={verb(hu, ua)} />)}
    </>
  );
}
