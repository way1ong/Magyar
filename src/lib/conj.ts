import { endsWithVowel, finalConsonant, infinitiveStem } from "./harmony";
import type { Harmony, Item, VerbConj } from "./types";

/**
 * Verb conjugation: present and past, indefinite (alanyi) and definite
 * (tárgyas) — the forms a B1 learner must produce. Everything derives from
 * the dictionary infinitive plus a few per-verb flags in `item.conj`:
 *  - `ik`: -ik verb (lakik: 1sg lakom, 3sg lakik);
 *  - `tr`: transitive → has definite forms (látom, látod, látja…);
 *  - `stem` / `vstem` / `pastStem`: present stem when it isn't the infinitive
 *    minus -ni (alszik), the stem before vowel-initial endings for fleeting
 *    vowels (érez → érz-ek), the past stem (alud-tam);
 *  - `past`: the past-tense group when the rule below guesses wrong;
 *  - `link: false`: no linking vowels although the stem ends in two consonants (áll: állsz, állnak);
 *  - `forms`: full-form overrides by slot key.
 * Nine irregular verbs (menni, jönni, enni, inni, venni, vinni, tenni, hinni,
 * lenni) are spelled out below and apply to their prefixed compounds too
 * (átmenni, bevenni). The future is fog + infinitive, with a separable prefix
 * moved in front (el fogok menni); lenni has its own (leszek). The potential
 * (-hat/-het: parkolhat, mehet, ehet) is a derived stem conjugated like any
 * present-tense verb. The imperative (felszólító mód) is the j-stem — -j
 * assimilated to a final sibilant or t (olvass, nézz, fizess, taníts,
 * válassz) — plus its own endings; the definite 2sg is the short form
 * (nézd, mondd, add); a separable prefix follows the verb (menj el, nézd meg).
 * `conj.imp` overrides the j-stem (lát → láss) or, as `false`, removes the
 * mood (tetszik). The conditional (feltételes mód) is stem + -n- + its
 * endings (várnék, várnál, várna; várnám), with the same linking vowel as
 * -asz/-anak (mondanék, tanítanék); the past conditional is past + volna.
 * `npm run content:conj` prints every verb's paradigm.
 */
export type Tense = "pres" | "past" | "fut" | "pot" | "imp" | "cond";
export const TENSES: Tense[] = ["pres", "past", "fut", "pot", "imp", "cond"];
export type Person = "1sg" | "2sg" | "3sg" | "1pl" | "2pl" | "3pl";
export const PERSONS: Person[] = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];
export const PRONOUN: Record<Person, string> = { "1sg": "én", "2sg": "te", "3sg": "ő", "1pl": "mi", "2pl": "ti", "3pl": "ők" };
export const PRONOUN_UA: Record<Person, string> = { "1sg": "я", "2sg": "ти", "3sg": "він / вона", "1pl": "ми", "2pl": "ви", "3pl": "вони" };
export const TENSE_UA: Record<Tense, string> = { pres: "теперішній", past: "минулий", fut: "майбутній", pot: "можливість -hat/-het", imp: "наказовий", cond: "умовний" };
/** Label with the right noun: "теперішній час", but "наказовий спосіб". */
/**
 * Ukrainian reading of "person + tense" for the task line: the potential
 * becomes "я можу (мені можна)", the imperative "хай він …", the conditional
 * "я б …" — the learner sees what the form means, not a grammar label.
 */
const POT_UA: Record<Person, string> = { "1sg": "я можу (мені можна)", "2sg": "ти можеш (тобі можна)", "3sg": "він / вона може (можна)", "1pl": "ми можемо (нам можна)", "2pl": "ви можете (вам можна)", "3pl": "вони можуть (їм можна)" };
const IMP_UA: Record<Person, string> = { "1sg": "хай я … (наказ собі)", "2sg": "ти — наказ", "3sg": "хай він / вона …", "1pl": "ми — давайте …", "2pl": "ви — наказ", "3pl": "хай вони …" };
const COND_UA: Record<Person, string> = { "1sg": "я б …", "2sg": "ти б …", "3sg": "він / вона б …", "1pl": "ми б …", "2pl": "ви б …", "3pl": "вони б …" };
export const personTenseUa = (person: Person, t: Tense) =>
  t === "pot" ? POT_UA[person] : t === "imp" ? IMP_UA[person] : t === "cond" ? COND_UA[person] : `${PRONOUN_UA[person]}, ${tenseLabel(t)}`;

export const tenseLabel = (t: Tense) => (t === "pot" ? TENSE_UA[t] : t === "imp" || t === "cond" ? `${TENSE_UA[t]} спосіб` : `${TENSE_UA[t]} час`);

export interface Slot {
  tense: Tense;
  def: boolean;
  person: Person;
}
export const slotKey = (s: Slot) => `${s.tense}.${s.def ? "def" : "indef"}.${s.person}`;
export const parseSlot = (k: string): Slot => {
  const [tense, d, person] = k.split(".");
  return { tense: tense as Tense, def: d === "def", person: person as Person };
};

type PastGroup = NonNullable<VerbConj["past"]>;

/** Verbal prefixes, longest first — stripped to find the base verb. */
const PREFIXES = [
  "keresztül", "vissza", "össze", "előre", "hátra", "végig", "körül", "tovább", "hozzá", "ellen", "félre", "haza", "neki", "bele", "után",
  "tönkre", "létre", "helyre", "közbe", "újra", "abba", "felül", "karban", "egyet", "kölcsön", "jóvá", "körbe",
  "meg", "el", "ki", "be", "fel", "föl", "le", "át", "oda", "ide", "szét", "rá", "alá", "elő", "túl", "fenn", "benn", "lenn", "kinn",
].sort((a, b) => b.length - a.length);

const VOWEL = /[aáeéiíoóöőuúüű]/;

/** Split "bevenni" into ["be", "venni"]; the base must keep a vowel and end in -ni. */
export function splitPrefix(inf: string): [string, string] {
  for (const p of PREFIXES) {
    const base = inf.slice(p.length);
    if (inf.startsWith(p) && base.endsWith("ni") && base.length >= 4 && VOWEL.test(base.slice(0, -2))) return [p, base];
  }
  return ["", inf];
}

/**
 * Vowel class of a stem for the endings: the last vowel decides rounding
 * (ellenőriz → ellenőriztek, but ellenőrz-ök); i/í/é are neutral and look
 * back for a back vowel; an all-neutral stem (ír, hív, nyit) takes the
 * item's declared harmony.
 */
function harmonyOf(stem: string, fallback: Harmony): Harmony {
  const vs = [...stem.toLowerCase()].filter((c) => VOWEL.test(c));
  if (!vs.length) return fallback;
  const last = vs.at(-1)!;
  if ("aáoóuú".includes(last)) return "back";
  if ("öőüű".includes(last)) return "front_rounded";
  if (last === "e") return "front";
  return vs.some((v) => "aáoóuú".includes(v)) ? "back" : fallback === "front_rounded" ? "front" : vs.every((v) => "iíé".includes(v)) ? fallback : "front";
}

const O = (h: Harmony) => (h === "back" ? "o" : h === "front" ? "e" : "ö");
const A = (h: Harmony) => (h === "back" ? "a" : "e");
const Á = (h: Harmony) => (h === "back" ? "á" : "é");
const U = (h: Harmony) => (h === "back" ? "u" : "ü");
const SIBILANT = new Set(["s", "sz", "z", "dz", "zs"]);
const SONORANT = new Set(["l", "r", "n", "ny", "j", "ly"]);
const LONG = "áéíóőúű";

const endsInCluster = (stem: string) => {
  const c = finalConsonant(stem);
  if (!c) return false;
  return finalConsonant(stem.slice(0, -c.length)) !== null;
};
const syllables = (s: string) => [...s].filter((c) => VOWEL.test(c)).length;

/** Join a j-initial ending to a sibilant stem: olvas+ja → olvassa, főz+jük → főzzük. */
function joinJ(stem: string, ending: string): string {
  const c = finalConsonant(stem);
  return c && SIBILANT.has(c) && ending.startsWith("j") ? stem + c + ending.slice(1) : stem + ending;
}

/** The doubled spelling of a consonant: s → ss, sz → ssz, z → zz, dz → ddz. */
const doubled = (c: string) => (c.length === 2 ? c[0] + c : c + c);

/**
 * Imperative stem (the j-stem): -j assimilates to a final sibilant (olvas →
 * olvass, néz → nézz, játsz → játssz) and to t — after a short vowel t+j → ss
 * (fizet → fizess, nyit → nyiss), after a long vowel or a consonant → ts
 * (tanít → taníts, ért → érts), after a sibilant the t drops (fest → fess,
 * választ → válassz). Otherwise -j is kept (vár → várj, mond → mondj, lő → lőj).
 */
export function impStem(stem: string): string {
  if (endsWithVowel(stem)) return stem + "j";
  const c = finalConsonant(stem)!;
  if (SIBILANT.has(c)) return stem.slice(0, -c.length) + doubled(c);
  if (c === "t") {
    const pre = stem.slice(0, -1);
    const pc = finalConsonant(pre);
    if (pc && SIBILANT.has(pc)) return pre.slice(0, -pc.length) + doubled(pc);
    const v = pre.at(-1) ?? "";
    if (VOWEL.test(v) && !LONG.includes(v)) return pre + "ss";
    return stem + "s";
  }
  return stem + "j";
}

/** Short definite 2sg: the j-stem without its -j / doubling, plus -d: várd, mondd, olvasd, nézd, fizesd, tanítsd, lődd. */
function impShort(stem: string, j: string): string {
  if (endsWithVowel(stem)) return stem + "dd";
  if (j.endsWith("j")) return j.slice(0, -1) + "d";
  const c = finalConsonant(j)!;
  const d = doubled(c);
  if (j.endsWith(d)) return j.slice(0, -d.length) + c + "d";
  return j + "d";
}

/** Irregular paradigms by base infinitive (prefixes are re-attached). */
const IRREGULAR: Record<string, Record<string, string>> = {
  menni: { ...p("megyek mész megy megyünk mentek mennek", null, "mentem mentél ment mentünk mentetek mentek", null), ...imp("menjek menj menjen menjünk menjetek menjenek", null), ...cond("mennék mennél menne mennénk mennétek mennének", null) },
  jönni: { ...p("jövök jössz jön jövünk jöttök jönnek", null, "jöttem jöttél jött jöttünk jöttetek jöttek", null), ...imp("jöjjek gyere jöjjön jöjjünk gyertek jöjjenek", null), ...cond("jönnék jönnél jönne jönnénk jönnétek jönnének", null) },
  enni: { ...p("eszem eszel eszik eszünk esztek esznek", "eszem eszed eszi esszük eszitek eszik", "ettem ettél evett ettünk ettetek ettek", "ettem etted ette ettük ettétek ették"), ...imp("egyek egyél egyen együnk egyetek egyenek", "egyem edd egye együk egyétek egyék"), ...cond("ennék ennél enne ennénk ennétek ennének", "enném ennéd enné ennénk ennétek ennék") },
  inni: { ...p("iszom iszol iszik iszunk isztok isznak", "iszom iszod issza isszuk isszátok isszák", "ittam ittál ivott ittunk ittatok ittak", "ittam ittad itta ittuk ittátok itták"), ...imp("igyak igyál igyon igyunk igyatok igyanak", "igyam idd igya igyuk igyátok igyák"), ...cond("innék innál inna innánk innátok innának", "innám innád inná innánk innátok innák") },
  venni: { ...p("veszek veszel vesz veszünk vesztek vesznek", "veszem veszed veszi vesszük veszitek veszik", "vettem vettél vett vettünk vettetek vettek", "vettem vetted vette vettük vettétek vették"), ...imp("vegyek vegyél vegyen vegyünk vegyetek vegyenek", "vegyem vedd vegye vegyük vegyétek vegyék"), ...cond("vennék vennél venne vennénk vennétek vennének", "venném vennéd venné vennénk vennétek vennék") },
  vinni: { ...p("viszek viszel visz viszünk visztek visznek", "viszem viszed viszi visszük viszitek viszik", "vittem vittél vitt vittünk vittetek vittek", "vittem vitted vitte vittük vittétek vitték"), ...imp("vigyek vigyél vigyen vigyünk vigyetek vigyenek", "vigyem vidd vigye vigyük vigyétek vigyék"), ...cond("vinnék vinnél vinne vinnénk vinnétek vinnének", "vinném vinnéd vinné vinnénk vinnétek vinnék") },
  tenni: { ...p("teszek teszel tesz teszünk tesztek tesznek", "teszem teszed teszi tesszük teszitek teszik", "tettem tettél tett tettünk tettetek tettek", "tettem tetted tette tettük tettétek tették"), ...imp("tegyek tegyél tegyen tegyünk tegyetek tegyenek", "tegyem tedd tegye tegyük tegyétek tegyék"), ...cond("tennék tennél tenne tennénk tennétek tennének", "tenném tennéd tenné tennénk tennétek tennék") },
  hinni: { ...p("hiszek hiszel hisz hiszünk hisztek hisznek", "hiszem hiszed hiszi hisszük hiszitek hiszik", "hittem hittél hitt hittünk hittetek hittek", "hittem hitted hitte hittük hittétek hitték"), ...imp("higgyek higgyél higgyen higgyünk higgyetek higgyenek", "higgyem hidd higgye higgyük higgyétek higgyék"), ...cond("hinnék hinnél hinne hinnénk hinnétek hinnének", "hinném hinnéd hinné hinnénk hinnétek hinnék") },
  lenni: { ...p("vagyok vagy van vagyunk vagytok vannak", null, "voltam voltál volt voltunk voltatok voltak", null), ...fut("leszek leszel lesz leszünk lesztek lesznek"), ...imp("legyek légy legyen legyünk legyetek legyenek", null), ...cond("lennék lennél lenne lennénk lennétek lennének", null) },
};
function imp(indef: string, def: string | null): Record<string, string> {
  return mood("imp", indef, def);
}
function cond(indef: string, def: string | null): Record<string, string> {
  return mood("cond", indef, def);
}
function mood(tense: Tense, indef: string, def: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  indef.split(" ").forEach((f, i) => (out[slotKey({ tense, def: false, person: PERSONS[i] })] = f));
  def?.split(" ").forEach((f, i) => (out[slotKey({ tense, def: true, person: PERSONS[i] })] = f));
  return out;
}
function fut(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  s.split(" ").forEach((f, i) => (out[slotKey({ tense: "fut", def: false, person: PERSONS[i] })] = f));
  return out;
}
/** Potential stems of the irregular verbs (regular ones add -hat/-het to the stem). */
const POT_STEM: Record<string, string> = { enni: "ehet", inni: "ihat", venni: "vehet", vinni: "vihet", tenni: "tehet", hinni: "hihet", menni: "mehet", jönni: "jöhet", lenni: "lehet", aludni: "alhat", feküdni: "fekhet" };

/** fog in the present: the auxiliary of the future. */
const FOG = { indef: "fogok fogsz fog fogunk fogtok fognak".split(" "), def: "fogom fogod fogja fogjuk fogjátok fogják".split(" ") };
/** Verbs whose first syllables merely look like a prefix (be-szél, fel-el, lé-legez): never split for the future. */
const NOT_SEPARABLE = new Set(["beszélni", "beszélgetni", "felelni", "lélegezni", "ellenőrizni", "kiabálni", "elemezni", "lelkesedni", "kelni", "menni", "túlórázni", "előzni", "betegeskedni", "becsülni", "fellebbezni", "kölcsönözni", "ellenezni", "kicsinyíteni", "befolyásolni", "lektorálni"]);

function p(pi: string, pd: string | null, qi: string, qd: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (tense: Tense, def: boolean, s: string | null) => {
    if (!s) return;
    s.split(" ").forEach((f, i) => (out[slotKey({ tense, def, person: PERSONS[i] })] = f));
  };
  put("pres", false, pi);
  put("pres", true, pd);
  put("past", false, qi);
  put("past", true, qd);
  return out;
}
export const IRREGULAR_BASES = Object.keys(IRREGULAR);

/** Can this item be conjugated (a one-word verb with a harmony class)? */
export const isConjugable = (i: Item) => i.type === "word" && i.pos === "verb" && !!i.harmony && !i.hu.includes(" ") && i.hu.endsWith("ni");
/** Transitive verbs also have the definite conjugation. */
export const isTransitive = (i: Item) => !!(i.conj?.tr || IRREGULAR[splitPrefix(i.hu)[1]]?.["pres.def.1sg"]);

export interface Paradigm {
  prefix: string;
  base: string;
  stem: string;
  vstem: string;
  pastStem: string;
  group: PastGroup;
  harmony: Harmony;
  irregular: boolean;
}

export function analyse(item: Item): Paradigm {
  const c = item.conj ?? {};
  const [pre, base] = splitPrefix(item.hu);
  const irregular = !!IRREGULAR[base];
  // Explicit stems in the content are whole words (prefix included): then nothing is re-attached.
  const explicit = !!(c.stem || c.vstem || c.pastStem);
  const prefix = explicit ? "" : pre;
  const stem = c.stem ?? infinitiveStem(explicit ? item.hu : base);
  const vstem = c.vstem ?? stem;
  const pastStem = c.pastStem ?? stem;
  const h = harmonyOf(stem, item.harmony ?? "back");
  return { prefix, base, stem, vstem, pastStem, group: c.past ?? pastGroup(pastStem, h), harmony: h, irregular };
}

/**
 * Past-tense group from the stem:
 *  - vowel-final: -tt in every person (lő → lőtt, lőttem);
 *  - t-final after a consonant or long vowel, or a one-syllable stem in a
 *    short vowel + t: linking vowel in every person (ért → értett, értettem;
 *    tanít → tanított; üt → ütött, ütöttem);
 *  - single l/r/n/ny/j/ly: plain -t (vár → várt, vártam);
 *  - everything else (two consonants, stops, sibilants, a longer stem in short
 *    vowel + t): the vowel only in 3sg indefinite (mond → mondott, mondtam; olvas → olvasott; fizet → fizetett, fizettem).
 * -ll after a short vowel takes the vowel everywhere (hall → hallottam, illik →
 * illett), after a long one not (áll → állt). Exceptions go in `conj.past`
 * (lát → látott/láttam, marad → maradt).
 */
function pastGroup(stem: string, _h: Harmony): PastGroup {
  if (endsWithVowel(stem)) return "tt";
  const c = finalConsonant(stem)!;
  if (c === "t") {
    const before = stem.slice(0, -1).at(-1) ?? "";
    if (!VOWEL.test(before) || LONG.includes(before)) return "full";
    return syllables(stem) === 1 ? "full" : "ott";
  }
  if (SONORANT.has(c) && !endsInCluster(stem)) return "t";
  if (stem.endsWith("ll")) return LONG.includes(stem.slice(0, -2).at(-1) ?? "") ? "t" : "full";
  // A cluster ending in a sibilant or in l/r keeps the vowel everywhere: tetszettem, játszottam, romlottam, ugrottam.
  if ((SIBILANT.has(c) || c === "l" || c === "r") && endsInCluster(stem)) return "full";
  return "ott";
}

/** One form. */
export function conjugate(item: Item, slot: Slot): string {
  const key = slotKey(slot);
  const c = item.conj ?? {};
  if (c.forms?.[key]) return c.forms[key];
  const P = analyse(item);
  const irr = IRREGULAR[P.base];
  if (slot.tense === "imp") return imperative(item, P, slot);
  if (irr?.[key]) return P.prefix + irr[key];
  if (slot.tense === "cond" && !irr) return conditional(item, P, slot);
  if (slot.tense === "pot") {
    // -hat/-het on the full stem (parkolhat, érezhet, mozoghat), then present endings.
    const stem = POT_STEM[P.base] ?? P.stem + (harmonyOf(P.stem, item.harmony ?? "back") === "back" ? "hat" : "het");
    const derived: Item = { ...item, hu: P.prefix + stem + "ni", conj: { tr: c.tr, ik: false } };
    return conjugate(derived, { ...slot, tense: "pres" });
  }
  if (slot.tense === "fut") {
    // fog + infinitive; a separable prefix comes first: el fogok menni, meg fogom nézni.
    const [pre, base] = NOT_SEPARABLE.has(item.hu) ? ["", item.hu] : splitPrefix(item.hu);
    const aux = FOG[slot.def ? "def" : "indef"][PERSONS.indexOf(slot.person)];
    return `${pre ? pre + " " : ""}${aux} ${base}`;
  }
  if (irr) return "";
  const { stem, vstem, harmony: h, group } = P;
  // Endings on the fleeting-vowel stem follow ITS last vowel: ellenőriz-tek but ellenőrz-ök.
  const hv = vstem === stem ? h : harmonyOf(vstem, item.harmony ?? "back");
  const link = c.link !== false;
  const fc = finalConsonant(stem);
  const sib = !!fc && SIBILANT.has(fc);
  const tFinal = fc === "t";
  const before = tFinal ? (stem.slice(0, -1).at(-1) ?? "") : "";
  const tLink = tFinal && (!VOWEL.test(before) || LONG.includes(before));
  const cluster = link && endsInCluster(stem);
  const presLink = link && (cluster || tLink);
  const pl2Link = link && (tLink || (cluster && (sib || fc === "l")));
  const o = O(h), a = A(h), u = U(h);
  const ov = O(hv), av = A(hv), uv = U(hv);
  const ik = !!c.ik;
  let form: string;
  if (slot.tense === "pres") {
    if (!slot.def) {
      switch (slot.person) {
        case "1sg": form = vstem + ov + (ik ? "m" : "k"); break;
        case "2sg": form = sib ? vstem + ov + "l" : presLink ? stem + a + "sz" : stem + "sz"; break;
        case "3sg": form = ik ? vstem + "ik" : stem; break;
        case "1pl": form = vstem + uv + "nk"; break;
        case "2pl": form = pl2Link ? stem + o + "t" + o + "k" : stem + (endsWithVowel(stem) ? "tt" : "t") + o + "k"; break;
        case "3pl": form = presLink ? vstem + av + "n" + av + "k" : stem + "n" + a + "k"; break;
      }
    } else {
      const back = h === "back";
      switch (slot.person) {
        case "1sg": form = vstem + ov + "m"; break;
        case "2sg": form = vstem + ov + "d"; break;
        case "3sg": form = back ? joinJ(stem, "ja") : vstem + "i"; break;
        case "1pl": form = joinJ(stem, "j" + u + "k"); break;
        case "2pl": form = back ? joinJ(stem, "játok") : vstem + "itek"; break;
        case "3pl": form = back ? joinJ(stem, "ják") : vstem + "ik"; break;
      }
    }
  } else {
    const ps = c.pastStem ?? stem;
    const pv = c.pastStem ?? vstem;
    const third = slot.person === "3sg" && !slot.def;
    let marker: string;
    let s: string;
    if (group === "tt") { marker = "tt"; s = ps; }
    else if (group === "full") { marker = ov + "tt"; s = pv; }
    else if (group === "ott" && third) { marker = ov + "tt"; s = pv; }
    else { marker = "t"; s = ps; }
    const á = Á(h);
    const e = h === "back" ? "o" : "e"; // -atok/-etek, -átok/-étek: no ö here
    const end = !slot.def
      ? { "1sg": a + "m", "2sg": á + "l", "3sg": "", "1pl": u + "nk", "2pl": a + "t" + e + "k", "3pl": a + "k" }[slot.person]
      : { "1sg": a + "m", "2sg": a + "d", "3sg": a, "1pl": u + "k", "2pl": á + "t" + e + "k", "3pl": á + "k" }[slot.person];
    form = s + marker + end;
  }
  return P.prefix + form;
}

/** Does the verb take the imperative? (`conj.imp: false` removes it: tetszik.) */
export const hasImperative = (item: Item) => item.conj?.imp !== false;

/**
 * Imperative. The j-stem comes from the present stem — or from the past stem
 * of the sz/d verbs (alszik → aludj, haragszik → haragudj) — and takes:
 *   indefinite  -jak/-jek, -j, -jon/-jen/-jön, -junk/-jünk, -jatok/-jetek, -janak/-jenek
 *   definite    -jam/-jem, (short) -d, -ja/-je, -juk/-jük, -játok/-jétek, -ják/-jék
 * A separable prefix goes after the verb in a command: menj el, nézd meg,
 * vedd be (but beszélj, felelj: not prefixes).
 */
function imperative(item: Item, P: Paradigm, slot: Slot): string {
  if (!hasImperative(item)) return "";
  const c = item.conj ?? {};
  const key = slotKey(slot);
  const separable = !NOT_SEPARABLE.has(item.hu);
  const irr = IRREGULAR[P.base];
  if (irr) {
    const f = irr[key];
    if (!f) return "";
    return separable && P.prefix ? `${f} ${P.prefix}` : P.prefix + f;
  }
  // The sz/d verbs build the imperative on the d-stem: alsz / alud → aludj.
  let stem = P.stem.endsWith("sz") && c.pastStem && c.pastStem !== P.stem ? c.pastStem : P.stem;
  // `conj.imp` is a whole word like the other explicit stems: drop a re-attached prefix from it.
  let j = c.imp ? (P.prefix && c.imp.startsWith(P.prefix) ? c.imp.slice(P.prefix.length) : c.imp) : impStem(stem);
  let prefix = P.prefix;
  // Explicit stems are whole words (elromol): peel the prefix off so it can follow the verb.
  if (!prefix && separable) {
    const [pre] = splitPrefix(item.hu);
    if (pre && stem.startsWith(pre) && j.startsWith(pre)) {
      stem = stem.slice(pre.length);
      j = j.slice(pre.length);
      prefix = pre;
    }
  }
  const h = harmonyOf(j, item.harmony ?? "back");
  const o = O(h), a = A(h), u = U(h), á = Á(h);
  const e = h === "back" ? "o" : "e"; // -jatok/-jetek, -játok/-jétek
  let form: string;
  if (!slot.def) {
    form = { "1sg": j + a + "k", "2sg": j, "3sg": j + o + "n", "1pl": j + u + "nk", "2pl": j + a + "t" + e + "k", "3pl": j + a + "n" + a + "k" }[slot.person];
  } else {
    form = { "1sg": j + a + "m", "2sg": impShort(stem, j), "3sg": j + a, "1pl": j + u + "k", "2pl": j + á + "t" + e + "k", "3pl": j + á + "k" }[slot.person];
  }
  return separable && prefix ? `${form} ${prefix}` : prefix + form;
}

/**
 * Conditional (feltételes mód): stem + n + endings. The linking vowel is the
 * one of -asz/-anak — after two consonants and after -ít or consonant + t
 * (mondanék, értenék, tanítanék), not after a sibilant or short vowel + t
 * (olvasnék, fizetnék, szeretnék). The sz/d verbs use the d-stem (aludnék).
 *   indefinite  -nék, -nál/-nél, -na/-ne, -nánk/-nénk, -nátok/-nétek, -nának/-nének
 *   definite    -nám/-ném, -nád/-néd, -ná/-né, -nánk/-nénk, -nátok/-nétek, -nák/-nék
 * The prefix stays attached (megnézném). Past conditional = past + volna.
 */
function conditional(item: Item, P: Paradigm, slot: Slot): string {
  const c = item.conj ?? {};
  const stem = P.stem.endsWith("sz") && c.pastStem && c.pastStem !== P.stem ? c.pastStem : P.stem;
  const h = harmonyOf(stem, item.harmony ?? "back");
  const link = c.link !== false;
  const fc = finalConsonant(stem);
  const tFinal = fc === "t";
  const before = tFinal ? (stem.slice(0, -1).at(-1) ?? "") : "";
  const tLink = tFinal && (!VOWEL.test(before) || LONG.includes(before));
  const base = stem + (link && (endsInCluster(stem) || tLink) ? A(h) : "") + "n";
  const a = A(h), á = Á(h);
  const e = h === "back" ? "o" : "e"; // -nátok / -nétek
  const end = !slot.def
    ? { "1sg": "ék", "2sg": á + "l", "3sg": a, "1pl": á + "nk", "2pl": á + "t" + e + "k", "3pl": á + "n" + a + "k" }[slot.person]
    : { "1sg": á + "m", "2sg": á + "d", "3sg": á, "1pl": á + "nk", "2pl": á + "t" + e + "k", "3pl": á + "k" }[slot.person];
  return P.prefix + base + end;
}

/** Every available slot for a verb: all tenses and moods, definite only when transitive. */
export function slotsFor(item: Item): Slot[] {
  const tr = isTransitive(item);
  const out: Slot[] = [];
  const tenses: Tense[] = TENSES.filter((t) => t !== "imp" || hasImperative(item));
  for (const tense of tenses) for (const def of tr ? [false, true] : [false]) for (const person of PERSONS) out.push({ tense, def, person });
  return out;
}

/** All six forms of one tense/definiteness. */
export const paradigmOf = (item: Item, tense: Tense, def: boolean) =>
  PERSONS.map((person) => ({ person, form: conjugate(item, { tense, def, person }) }));
