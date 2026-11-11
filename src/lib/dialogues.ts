import { packIndexOf, packs } from "./content";
import type { Dialogue } from "./types";

/**
 * "Діалоги": read a short dialogue and show you understood it. A card is
 * one dialogue; each showing is either its comprehension question (Ukrainian
 * question, Ukrainian options) or a gap — one line hidden, the right one to
 * be picked among lines of other dialogues of the same pack.
 * Card key: `dialogue:<id>`.
 */
export interface DialogueTask {
  id: string;
  dialogue: Dialogue;
  packIndex: number;
}

const tasks = new Map<string, DialogueTask>();
for (const p of packs) for (const d of p.dialogues ?? []) tasks.set(d.id, { id: d.id, dialogue: d, packIndex: packIndexOf(d.id) });

export const dialogueTasks: DialogueTask[] = [...tasks.values()];
export const dialogueTaskById = (id: string) => tasks.get(id);

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type Deal =
  | { kind: "question"; prompt: string; options: string[]; answer: string }
  | { kind: "gap"; line: number; prompt: string; options: string[]; answer: string };

/**
 * A showing of the dialogue: its question, or a gap with distractors from
 * nearby dialogues. The first time a card is shown it is always the question
 * — reading first, reproducing lines later.
 */
export function dealFor(task: DialogueTask, first = false): Deal {
  const d = task.dialogue;
  const q = d.question;
  const useGap = !first && Math.random() < 0.5;
  if (!useGap) return { kind: "question", prompt: q.q, options: shuffle(q.options), answer: q.options[q.answer] };
  // Gap: hide a line after the first; distractors are lines by the same speaker position from other dialogues, nearest packs first.
  const line = 1 + Math.floor(Math.random() * (d.lines.length - 1));
  const answer = d.lines[line].hu;
  const pool = dialogueTasks
    .filter((t) => t.id !== task.id)
    .sort((a, b) => Math.abs(a.packIndex - task.packIndex) - Math.abs(b.packIndex - task.packIndex) || Math.random() - 0.5)
    .flatMap((t) => t.dialogue.lines.map((l) => l.hu))
    .filter((hu) => hu !== answer && !d.lines.some((l) => l.hu === hu));
  const sameEnd = pool.filter((hu) => hu.endsWith("?") === answer.endsWith("?"));
  const distractors = [...new Set(shuffle(sameEnd.slice(0, 12)))].slice(0, 3);
  while (distractors.length < 3 && pool.length) {
    const next = pool.find((hu) => !distractors.includes(hu));
    if (!next) break;
    distractors.push(next);
  }
  return { kind: "gap", line, prompt: "Яка репліка пропущена?", options: shuffle([answer, ...distractors]), answer };
}
