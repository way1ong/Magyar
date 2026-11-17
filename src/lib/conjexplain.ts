import { analyse, conjugate, isTransitive, PRONOUN, PRONOUN_UA, slotsFor, tenseLabel, type Person, type Slot, type Tense } from "./conj";
import type { Item } from "./types";

/**
 * "Чому так?" in the conjugation drill: a short explanation generated from
 * the same model that builds the forms, so it always matches the answer.
 *  - why: how this tense or mood is built, with this verb's own forms, and
 *    why this conjugation — the object is definite, indefinite or absent, or
 *    the form is the same in both;
 *  - whyNot: for a wrong answer that is another form of the same verb, whose
 *    form it is and what differs (person, conjugation, tense).
 */
export interface ConjExplanation {
  why: string[];
  whyNot: string[];
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function tenseRule(item: Item, tense: Tense, def: boolean): string | string[] {
  const f = (person: Person) => conjugate(item, { tense, def, person });
  const ex = tense === "imp" ? `${f("2sg")}, ${f("3sg")}` : `${f("1sg")}, ${f("3sg")}`;
  // The nine irregular verbs (enni, menni…) do not follow the rule except in the future and with -hat/-het.
  if (analyse(item).irregular && tense !== "fut" && tense !== "pot") return `${cap(tenseLabel(tense))}: ${item.hu} — неправильне дієслово, його форми треба запамʼятати (${ex}).`;
  switch (tense) {
    case "pres":
      return `Теперішній час: основа + особове закінчення за гармонією голосних (${ex}).${item.conj?.ik ? " Це -ik дієслово: у «ő» закінчення -ik, у «én» часто -m." : ""}`;
    case "past":
      return `Минулий час: основа + -t або -tt + особове закінчення (${ex}).`;
    case "fut":
      return `Майбутній час: змінюється лише fog, а дієслово лишається в інфінітиві (${ex}).`;
    case "pot":
      // Ukrainian «можу» covers permission, possibility and ability; -hat/-het is only the first two.
      return [
        `-hat/-het: основа + -hat/-het + закінчення теперішнього часу (${ex}).`,
        "Українське «можу» має три значення, а -hat/-het передає два з них: дозвіл, «можна» (Kérhetek egy kávét? — Можна мені каву?), і можливість, «може статися» (Késhet a busz. — Автобус може запізнитися).",
        "Третє значення, вміння («я вмію, я в змозі»), передає не -hat/-het, а tudni + інфінітив: Tudok úszni. — Я вмію плавати. Порівняй: Úszhatok? — Можна мені поплавати?",
      ];
    case "imp":
      return `Наказовий спосіб: основа + -j- + закінчення (${ex}). Після s, sz, z, t приголосний зливається з -j- (olvass, nézz, fizess), а відокремлюваний префікс стає після дієслова (nézd meg).`;
    case "cond":
      return `Умовний спосіб: основа + -n- + закінчення (${ex}).`;
  }
}

function defReason(item: Item, def: boolean, shared: boolean, synthetic: boolean, correct: string): string {
  if (!isTransitive(item)) return "Це дієслово не має прямого обʼєкта, тож у нього лише неозначена відміна.";
  if (shared) return `Тут означена й неозначена форми однакові: ${correct}.`;
  if (def)
    return synthetic
      ? "Обʼєкт azt («те, це») конкретний, тому означена відміна."
      : "Означена відміна: обʼєкт конкретний — з артиклем a/az, вказівний (azt, ezt), власна назва чи «мій, твій…» (a könyvemet).";
  return synthetic
    ? "Обʼєкт valamit («щось») невизначений, тому неозначена відміна."
    : "Неозначена відміна: обʼєкт невизначений (egy könyvet, valamit, слово без артикля) або його немає.";
}

/** The slot of the verb that a wrong answer stands for: the one closest to the asked slot. */
export function slotOfForm(item: Item, form: string, asked: Slot): Slot | undefined {
  const diff = (s: Slot) => Number(s.tense !== asked.tense) + Number(s.def !== asked.def) + Number(s.person !== asked.person);
  return slotsFor(item)
    .filter((s) => {
      const f = conjugate(item, s);
      return !!f && same(f, form);
    })
    .sort((a, b) => diff(a) - diff(b) || Number(b.tense === asked.tense) - Number(a.tense === asked.tense))[0];
}

export function explainConj(item: Item, asked: Slot, opts: { correct: string; wrong?: string | null; synthetic: boolean }): ConjExplanation {
  const { correct, wrong, synthetic } = opts;
  const tr = isTransitive(item);
  const shared = tr && conjugate(item, { ...asked, def: !asked.def }) === correct;
  const why = [tenseRule(item, asked.tense, asked.def), defReason(item, asked.def, shared, synthetic, correct)].flat();
  const whyNot: string[] = [];
  if (wrong && !same(wrong, correct)) {
    const ws = slotOfForm(item, wrong, asked);
    if (!ws) whyNot.push(`${wrong} — це не форма дієслова ${item.hu}.`);
    else {
      if (ws.tense !== asked.tense) whyNot.push(`${wrong} — ${tenseLabel(ws.tense)}, а тут — ${tenseLabel(asked.tense)}.`);
      // When the asked form is the same in both conjugations, the conjugation is not what went wrong.
      if (ws.def !== asked.def && !shared)
        whyNot.push(
          ws.def
            ? `${wrong} — означена відміна. Її беруть із конкретним обʼєктом: ${wrong} azt.`
            : `${wrong} — неозначена відміна. Вона для невизначеного обʼєкта (${wrong} valamit) або коли обʼєкта немає.`,
        );
      if (ws.person !== asked.person)
        whyNot.push(`${wrong} — форма для «${PRONOUN[ws.person]}» (${PRONOUN_UA[ws.person]}), а тут «${PRONOUN[asked.person]}» (${PRONOUN_UA[asked.person]}).`);
    }
  }
  return { why, whyNot };
}
