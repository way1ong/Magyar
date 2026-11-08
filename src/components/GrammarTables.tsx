"use client";
import { patternById, stemByHu } from "@/lib/content";
import { apply } from "@/lib/harmony";
import type { Item } from "@/lib/types";

/**
 * Reference tables for the guide: the alphabet with pronunciation hints and
 * the grammar tables a learner keeps coming back to (case suffixes on three
 * model nouns, possessives, pronouns in every case, ez/az, numerals, question
 * words, postpositions, comparison, time expressions). Noun forms are computed
 * with the same apply() the exercises use, so they can never disagree.
 */

/** Letter, pronunciation hint (Ukrainian), example word with translation. */
const ALPHABET: [string, string, string][] = [
  ["a", "між «а» та «о», коротке, з округленими губами", "alma — яблуко"],
  ["á", "довге чисте «а»", "ház — будинок"],
  ["b", "б", "bor — вино"],
  ["c", "ц", "cukor — цукор"],
  ["cs", "ч", "csak — лише"],
  ["d", "д", "dél — південь"],
  ["dz", "дз", "edz — тренує"],
  ["dzs", "дж", "dzsem — джем"],
  ["e", "«е», відкрите, як в «це»", "egy — один"],
  ["é", "довге закрите «е», ближче до «еі»", "ép — цілий"],
  ["f", "ф", "fa — дерево"],
  ["g", "ґ (завжди дзвінке)", "gáz — газ"],
  ["gy", "дь (мʼяке «д», одним звуком)", "gyerek — дитина"],
  ["h", "г (видихове, як укр. «г»)", "ház — будинок"],
  ["i", "і коротке", "itt — тут"],
  ["í", "і довге", "íz — смак"],
  ["j", "й", "jó — добрий"],
  ["k", "к", "kéz — рука"],
  ["l", "л (ближче до мʼякого)", "ló — кінь"],
  ["ly", "й (те саме, що j)", "lyuk — дірка"],
  ["m", "м", "ma — сьогодні"],
  ["n", "н", "nap — день, сонце"],
  ["ny", "нь", "nyár — літо"],
  ["o", "о коротке", "orr — ніс"],
  ["ó", "о довге", "óra — година"],
  ["ö", "«е» з округленими губами, коротке (нім. ö)", "öt — пʼять"],
  ["ő", "те саме, довге", "nő — жінка"],
  ["p", "п", "piac — ринок"],
  ["r", "р (розкотисте)", "rend — порядок"],
  ["s", "ш", "sör — пиво"],
  ["sz", "с", "szép — гарний"],
  ["t", "т", "tél — зима"],
  ["ty", "ть (мʼяке «т», одним звуком)", "tyúk — курка"],
  ["u", "у коротке", "utca — вулиця"],
  ["ú", "у довге", "út — дорога"],
  ["ü", "«і» з округленими губами, коротке (нім. ü)", "ül — сидить"],
  ["ű", "те саме, довге", "tű — голка"],
  ["v", "в", "víz — вода"],
  ["z", "з", "zene — музика"],
  ["zs", "ж", "zseb — кишеня"],
];
const FOREIGN_LETTERS = "q, w, x, y трапляються лише в іншомовних словах і прізвищах (Wi-Fi, taxi, Nagy — тут y лише робить g мʼяким: gy). Подвоєння диграфа пишеться скорочено: sz+sz → ssz (busszal), ny+ny → nny (könnyű), gy+gy → ggy (meggy).";

/** Three model nouns, one per harmony class. */
const MODEL_NOUNS = ["ház", "kert", "sofőr"];
const noun = (hu: string): Item => stemByHu(hu) ?? { id: `guide-${hu}`, type: "word", hu, ua: "", pos: "noun", harmony: "back" };
const form = (n: Item, patternId: string) => {
  const p = patternById(patternId);
  return p ? apply(n.hu, p, n.harmony ?? "back", n.forms) : "";
};

/** Case suffixes shown on the model nouns, in textbook order. */
const CASES: [string, string][] = [
  ["suf-accusative", "кого? що?"],
  ["suf-plural", "множина"],
  ["suf-inessive", "у чомусь (де?)"],
  ["suf-illative", "у щось (куди?)"],
  ["suf-elative", "із чогось (звідки?)"],
  ["suf-superessive", "на чомусь (де?)"],
  ["suf-sublative", "на щось (куди?)"],
  ["suf-delative", "з поверхні; про"],
  ["suf-adessive", "у когось, біля (де?)"],
  ["suf-allative", "до когось (куди?)"],
  ["suf-ablative", "від когось (звідки?)"],
  ["suf-dative", "кому? чому?"],
  ["suf-instrumental", "чим? з ким?"],
  ["suf-causal", "за чимось, заради"],
  ["suf-terminative", "аж до"],
  ["suf-essive-formal", "як хто, у ролі"],
];

/** Possessive endings: singular possessor rows are computed, the rest spelled out. */
const POSSESSIVE: [string, string, string[]][] = [
  ["мій (-m)", "suf-poss1", []],
  ["твій (-d)", "suf-poss2", []],
  ["його, її (-a/-e, -ja/-je)", "suf-poss3", []],
  ["наш (-unk/-ünk)", "", ["házunk", "kertünk", "sofőrünk"]],
  ["ваш (-tok/-tek/-tök)", "", ["házatok", "kertetek", "sofőrötök"]],
  ["їхній (-uk/-ük, -juk/-jük)", "", ["házuk", "kertjük", "sofőrjük"]],
  ["мої (-im, -aim/-eim, -jaim/-jeim)", "", ["házaim", "kertjeim", "sofőrjeim"]],
  ["твої (-id, -aid/-eid)", "", ["házaid", "kertjeid", "sofőrjeid"]],
  ["його, її … (-i, -ai/-ei)", "", ["házai", "kertjei", "sofőrjei"]],
  ["наші (-ink, -aink/-eink)", "", ["házaink", "kertjeink", "sofőrjeink"]],
  ["ваші (-itok/-itek, -aitok/-eitek)", "", ["házaitok", "kertjeitek", "sofőrjeitek"]],
  ["їхні (-ik, -aik/-eik)", "", ["házaik", "kertjeik", "sofőrjeik"]],
];
const POSS_NOTE = "Присвійне закінчення стоїть перед відмінковим: házamban (у моєму домі), kertjében (у його саду), sofőrünkkel (з нашим водієм). Власник у давальному або без суфікса: a szomszéd háza / a szomszédnak a háza (будинок сусіда). «У мене є» = nekem van + присвійна форма: Nekem van autóm.";

const PERSONS = ["én", "te", "ő", "mi", "ti", "ők"];
/** Personal pronouns in the cases: suffixes become stems with possessive endings. */
const PRONOUNS: [string, string, string[]][] = [
  ["хто", "називний", ["én", "te", "ő", "mi", "ti", "ők"]],
  ["кого (-t)", "знахідний", ["engem", "téged", "őt", "minket", "titeket", "őket"]],
  ["кому (-nak)", "давальний", ["nekem", "neked", "neki", "nekünk", "nektek", "nekik"]],
  ["з ким (-val)", "", ["velem", "veled", "vele", "velünk", "veletek", "velük"]],
  ["у кого (-nál)", "", ["nálam", "nálad", "nála", "nálunk", "nálatok", "náluk"]],
  ["до кого (-hoz)", "", ["hozzám", "hozzád", "hozzá", "hozzánk", "hozzátok", "hozzájuk"]],
  ["від кого (-tól)", "", ["tőlem", "tőled", "tőle", "tőlünk", "tőletek", "tőlük"]],
  ["про кого (-ról)", "", ["rólam", "rólad", "róla", "rólunk", "rólatok", "róluk"]],
  ["на кого (-ra)", "", ["rám", "rád", "rá", "ránk", "rátok", "rájuk"]],
  ["у кому (-ban)", "", ["bennem", "benned", "benne", "bennünk", "bennetek", "bennük"]],
  ["у кого всередину (-ba)", "", ["belém", "beléd", "belé", "belénk", "belétek", "beléjük"]],
  ["з кого (-ból)", "", ["belőlem", "belőled", "belőle", "belőlünk", "belőletek", "belőlük"]],
  ["на кому (-on)", "", ["rajtam", "rajtad", "rajta", "rajtunk", "rajtatok", "rajtuk"]],
  ["заради кого (-ért)", "", ["értem", "érted", "érte", "értünk", "értetek", "értük"]],
  ["чий (присвійний займенник)", "", ["enyém", "tiéd", "övé", "miénk", "tiétek", "övék"]],
];
const PRONOUN_NOTE = "Ввічливі Ön / Önök (Ви) відмінюються як іменники: Önt, Önnek, Önnel, Önnél, Öntől, Önről, Önnek van…; дієслово при них у 3-й особі: Ön hol lakik? Займенники-підмети зазвичай опускають — особу видно із закінчення дієслова.";

/** ez / az in the cases. */
const DEMONSTRATIVES: [string, string, string][] = [
  ["цей / той", "ez", "az"],
  ["ці / ті", "ezek", "azok"],
  ["цього / того (-t)", "ezt", "azt"],
  ["цих / тих (-t)", "ezeket", "azokat"],
  ["у цьому (-ban)", "ebben", "abban"],
  ["у це (-ba)", "ebbe", "abba"],
  ["з цього (-ból)", "ebből", "abból"],
  ["на цьому (-on)", "ezen", "azon"],
  ["на це (-ra)", "erre", "arra"],
  ["з цього, про це (-ról)", "erről", "arról"],
  ["біля цього (-nál)", "ennél", "annál"],
  ["до цього (-hoz)", "ehhez", "ahhoz"],
  ["від цього (-tól)", "ettől", "attól"],
  ["цьому (-nak)", "ennek", "annak"],
  ["з цим (-val)", "ezzel", "azzal"],
  ["заради цього (-ért)", "ezért", "azért"],
  ["до цих пір (-ig)", "eddig", "addig"],
  ["тоді (-kor)", "ekkor", "akkor"],
];
const DEMONSTRATIVE_NOTE = "Перед іменником вказівний займенник бере той самий суфікс і артикль: ebben a házban (у цьому будинку), azt a könyvet (ту книжку), ezekkel az emberekkel (з цими людьми).";

const NUMBERS: [string, string][] = [
  ["0", "nulla"], ["1", "egy"], ["2", "kettő (перед іменником: két)"], ["3", "három"], ["4", "négy"], ["5", "öt"],
  ["6", "hat"], ["7", "hét"], ["8", "nyolc"], ["9", "kilenc"], ["10", "tíz"], ["11", "tizenegy"], ["12", "tizenkettő"],
  ["13…19", "tizenhárom … tizenkilenc"], ["20", "húsz"], ["21", "huszonegy"], ["22…29", "huszonkettő … huszonkilenc"],
  ["30", "harminc"], ["40", "negyven"], ["50", "ötven"], ["60", "hatvan"], ["70", "hetven"], ["80", "nyolcvan"], ["90", "kilencven"],
  ["100", "száz"], ["200", "kétszáz"], ["1000", "ezer"], ["2000", "kétezer"], ["1 000 000", "egymillió"],
  ["1-й", "első"], ["2-й", "második"], ["3-й", "harmadik"], ["4-й", "negyedik"], ["5-й", "ötödik"], ["6-й", "hatodik"],
  ["7-й", "hetedik"], ["8-й", "nyolcadik"], ["9-й", "kilencedik"], ["10-й", "tizedik"], ["20-й", "huszadik"], ["100-й", "századik"],
];
const NUMBER_NOTE = "Після числівника іменник в однині: három ház, öt ember. Скільки разів: egyszer, kétszer, háromszor. Дробові: fél (половина), negyed (чверть); 1,5 = másfél. Роки читають як число: 2026 = kétezer-huszonhat. Hányadika van? Ma május elseje / harmadika (сьогодні 1 / 3 травня).";

const QUESTIONS: [string, string, string][] = [
  ["ki? kik?", "хто?", "Ki ez? — Хто це?"],
  ["kit?", "кого?", "Kit keresel? — Кого ти шукаєш?"],
  ["kinek?", "кому? чий?", "Kinek adod? — Кому даєш?"],
  ["kivel?", "з ким?", "Kivel beszélsz? — З ким говориш?"],
  ["mi? mik?", "що?", "Mi ez? — Що це?"],
  ["mit?", "що? (обʼєкт)", "Mit kérsz? — Що хочеш?"],
  ["hol?", "де?", "Hol laksz? — Де живеш?"],
  ["hova? / hová?", "куди?", "Hova mész? — Куди йдеш?"],
  ["honnan?", "звідки?", "Honnan jössz? — Звідки ти?"],
  ["mikor?", "коли?", "Mikor indul? — Коли вирушає?"],
  ["mióta? meddig?", "відколи? доки?", "Mióta tanulsz? — Відколи вчишся?"],
  ["hogy? hogyan?", "як?", "Hogy vagy? — Як справи?"],
  ["miért?", "чому?", "Miért nem? — Чому ні?"],
  ["mennyi?", "скільки? (незлічуване, ціна)", "Mennyibe kerül? — Скільки коштує?"],
  ["hány?", "скільки? (штук)", "Hány óra van? — Котра година?"],
  ["hányadik?", "котрий за ліком?", "Hányadik emelet? — Котрий поверх?"],
  ["melyik?", "який із? котрий?", "Melyik busz? — Який автобус?"],
  ["milyen?", "який? (властивість)", "Milyen az idő? — Яка погода?"],
  ["kié?", "чий?", "Kié ez a táska? — Чия це сумка?"],
];

/** Postpositions: where / where to / where from, then the rest. */
const POSTPOSITIONS: [string, string, string, string][] = [
  ["під", "alatt", "alá", "alól"],
  ["над", "felett / fölött", "fölé", "fölül"],
  ["перед", "előtt", "elé", "elől"],
  ["за (позаду)", "mögött", "mögé", "mögül"],
  ["поруч", "mellett", "mellé", "mellől"],
  ["між", "között", "közé", "közül"],
  ["навколо", "körül", "köré", "—"],
  ["навпроти", "szemben (-val)", "—", "—"],
];
const POSTPOSITIONS_OTHER: [string, string][] = [
  ["után", "після (az ebéd után — після обіду)"],
  ["előtt", "до, перед (тим часом: hat előtt — до шостої)"],
  ["óta", "з (якогось часу): tavaly óta — з минулого року"],
  ["múlva", "через (час): két óra múlva — через дві години"],
  ["alatt", "за, протягом: egy hét alatt — за тиждень"],
  ["közben", "під час: evés közben — під час їжі"],
  ["nélkül", "без: cukor nélkül — без цукру"],
  ["miatt", "через (причина): az eső miatt — через дощ"],
  ["helyett", "замість"],
  ["szerint", "за, згідно з: szerintem — на мою думку"],
  ["ellen", "проти"],
  ["át / keresztül (-n)", "через: a parkon át — через парк"],
  ["felé", "у напрямку: a város felé — до міста"],
  ["számára / részére", "для (когось)"],
];
const POSTPOSITION_NOTE = "Післяйменник стоїть після іменника без суфікса: az asztal alatt (під столом). З займенниками він бере присвійні закінчення: alattam, alattad, alatta…; mellettem, utánad, nélküle, miattunk, szerintetek, helyettük.";

const COMPARISON: [string, string, string, string][] = [
  ["nagy", "nagyobb", "legnagyobb", "великий"],
  ["kicsi / kis", "kisebb", "legkisebb", "малий"],
  ["jó", "jobb", "legjobb", "добрий"],
  ["rossz", "rosszabb", "legrosszabb", "поганий"],
  ["szép", "szebb", "legszebb", "гарний"],
  ["sok", "több", "legtöbb", "багато"],
  ["kevés", "kevesebb", "legkevesebb", "мало"],
  ["hosszú", "hosszabb", "leghosszabb", "довгий"],
  ["könnyű", "könnyebb", "legkönnyebb", "легкий"],
  ["nehéz", "nehezebb", "legnehezebb", "важкий"],
  ["drága", "drágább", "legdrágább", "дорогий"],
  ["olcsó", "olcsóbb", "legolcsóbb", "дешевий"],
  ["gyors", "gyorsabb", "leggyorsabb", "швидкий"],
  ["lassú", "lassabb", "leglassabb", "повільний"],
  ["bátor", "bátrabb", "legbátrabb", "сміливий"],
  ["fiatal", "fiatalabb", "legfiatalabb", "молодий"],
  ["öreg", "öregebb", "legöregebb", "старий (про людей)"],
];
const COMPARISON_NOTE = "Порівняння: «ніж» — mint або -nál/-nél: Péter magasabb, mint Anna = Péter magasabb Annánál. «Найбільш» — leg- + -bb: a legnagyobb. «Такий самий, як» — olyan …, mint; «на … більший» — két évvel idősebb (на два роки старший). Прислівник від ступеня: gyorsabban, jobban, többet.";

const TIME: [string, string, string][] = [
  ["понеділок", "hétfő", "hétfőn"],
  ["вівторок", "kedd", "kedden"],
  ["середа", "szerda", "szerdán"],
  ["четвер", "csütörtök", "csütörtökön"],
  ["пʼятниця", "péntek", "pénteken"],
  ["субота", "szombat", "szombaton"],
  ["неділя", "vasárnap", "vasárnap (без суфікса)"],
  ["січень … грудень", "január, február, március, április, május, június, július, augusztus, szeptember, október, november, december", "januárban, februárban … decemberben"],
  ["весна", "tavasz", "tavasszal"],
  ["літо", "nyár", "nyáron"],
  ["осінь", "ősz", "ősszel"],
  ["зима", "tél", "télen"],
  ["ранок / зранку", "reggel", "reggel"],
  ["до обіду", "délelőtt", "délelőtt"],
  ["полудень / опівдні", "dél", "délben"],
  ["після обіду", "délután", "délután"],
  ["вечір / увечері", "este", "este"],
  ["ніч / уночі", "éjszaka / éjjel", "éjszaka / éjjel"],
  ["опівночі", "éjfél", "éjfélkor"],
  ["година / о …", "óra", "ötkor, fél hatkor, negyed hétkor, háromnegyed nyolckor"],
  ["тиждень / цього тижня", "hét", "ezen a héten; jövő héten; múlt héten"],
  ["рік / цього року", "év", "idén; jövőre; tavaly"],
  ["день / сьогодні", "nap", "ma; holnap; tegnap; holnapután; tegnapelőtt"],
];
const TIME_NOTE = "Fél hat = пів на шосту (5:30), negyed hét = чверть на сьому (6:15), háromnegyed nyolc = за чверть восьма (7:45). Hány órakor? — Ötkor. Mettől meddig? — Nyolctól négyig.";

function Table({ head, rows, hu = [] }: { head: string[]; rows: string[][]; hu?: number[] }) {
  return (
    <div className="guide-table-wrap">
      <table className="guide-table">
        <thead>
          <tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} lang={hu.includes(j) ? "hu" : undefined} style={j === 0 ? undefined : { whiteSpace: "normal" }}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const nouns = () => MODEL_NOUNS.map(noun);
const caseRows = () => CASES.map(([id, q]) => [patternById(id)?.name ?? id, q, ...nouns().map((n) => form(n, id))]);
const possRows = () => POSSESSIVE.map(([label, id, fixed]) => [label, ...(id ? nouns().map((n) => form(n, id)) : fixed)]);

export interface GrammarSection {
  key: string;
  title: string;
  body: React.ReactNode;
  /** Plain text for the guide's search box. */
  text: string;
}

export function grammarSections(): GrammarSection[] {
  const cases = caseRows();
  const poss = possRows();
  return [
    {
      key: "alphabet",
      title: "Алфавіт і вимова",
      text: [...ALPHABET.flat(), FOREIGN_LETTERS].join(" "),
      body: (
        <>
          <p style={{ fontSize: 15 }}>44 літери, з них 14 голосних: кожна коротка має довгу пару (a–á, e–é, i–í, o–ó, ö–ő, u–ú, ü–ű), і довгота змінює значення: kor — вік, kór — хвороба. Наголос завжди на першому складі.</p>
          <Table head={["літера", "як читати", "приклад"]} rows={ALPHABET} hu={[0, 2]} />
          <p style={{ fontSize: 15 }}>{FOREIGN_LETTERS}</p>
        </>
      ),
    },
    {
      key: "cases",
      title: "Відмінкові суфікси на трьох іменниках",
      text: cases.flat().join(" "),
      body: (
        <>
          <p style={{ fontSize: 15 }}>ház — задня гармонія, kert — передня, sofőr — передня огублена. Форми рахує та сама модель, що й у вправах.</p>
          <Table head={["суфікс", "значення", "ház", "kert", "sofőr"]} rows={cases} hu={[0, 2, 3, 4]} />
        </>
      ),
    },
    {
      key: "possessive",
      title: "Присвійні закінчення",
      text: [...poss.flat(), POSS_NOTE].join(" "),
      body: (
        <>
          <Table head={["чий", "ház", "kert", "sofőr"]} rows={poss} hu={[1, 2, 3]} />
          <p style={{ fontSize: 15 }}>{POSS_NOTE}</p>
        </>
      ),
    },
    {
      key: "pronouns",
      title: "Особові займенники у відмінках",
      text: [...PRONOUNS.flatMap(([a, b, f]) => [a, b, ...f]), PRONOUN_NOTE].join(" "),
      body: (
        <>
          <Table head={["", ...PERSONS]} rows={PRONOUNS.map(([label, , f]) => [label, ...f])} hu={[1, 2, 3, 4, 5, 6]} />
          <p style={{ fontSize: 15 }}>{PRONOUN_NOTE}</p>
        </>
      ),
    },
    {
      key: "demonstratives",
      title: "Вказівні ez / az у відмінках",
      text: [...DEMONSTRATIVES.flat(), DEMONSTRATIVE_NOTE].join(" "),
      body: (
        <>
          <Table head={["", "ez (цей)", "az (той)"]} rows={DEMONSTRATIVES} hu={[1, 2]} />
          <p style={{ fontSize: 15 }}>{DEMONSTRATIVE_NOTE}</p>
        </>
      ),
    },
    {
      key: "numbers",
      title: "Числівники",
      text: [...NUMBERS.flat(), NUMBER_NOTE].join(" "),
      body: (
        <>
          <Table head={["число", "угорською"]} rows={NUMBERS} hu={[1]} />
          <p style={{ fontSize: 15 }}>{NUMBER_NOTE}</p>
        </>
      ),
    },
    {
      key: "questions",
      title: "Питальні слова",
      text: QUESTIONS.flat().join(" "),
      body: <Table head={["питання", "значення", "приклад"]} rows={QUESTIONS} hu={[0, 2]} />,
    },
    {
      key: "postpositions",
      title: "Післяйменники",
      text: [...POSTPOSITIONS.flat(), ...POSTPOSITIONS_OTHER.flat(), POSTPOSITION_NOTE].join(" "),
      body: (
        <>
          <Table head={["", "де? (hol)", "куди? (hova)", "звідки? (honnan)"]} rows={POSTPOSITIONS} hu={[1, 2, 3]} />
          <Table head={["післяйменник", "значення"]} rows={POSTPOSITIONS_OTHER} hu={[0]} />
          <p style={{ fontSize: 15 }}>{POSTPOSITION_NOTE}</p>
        </>
      ),
    },
    {
      key: "comparison",
      title: "Ступені порівняння",
      text: [...COMPARISON.flat(), COMPARISON_NOTE].join(" "),
      body: (
        <>
          <Table head={["прикметник", "-bb", "leg…bb", "значення"]} rows={COMPARISON} hu={[0, 1, 2]} />
          <p style={{ fontSize: 15 }}>{COMPARISON_NOTE}</p>
        </>
      ),
    },
    {
      key: "time",
      title: "Коли? Дні, місяці, пори року, час",
      text: [...TIME.flat(), TIME_NOTE].join(" "),
      body: (
        <>
          <Table head={["", "слово", "коли?"]} rows={TIME} hu={[1, 2]} />
          <p style={{ fontSize: 15 }}>{TIME_NOTE}</p>
        </>
      ),
    },
  ];
}
