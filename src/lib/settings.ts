import { db, type CardRow } from "./db";

/**
 * User settings live in the `meta` table under `setting:<name>` so they
 * travel with backups. Only one so far.
 */

/** Harmony: when to ask for a typed answer instead of the suffix buttons. */
export type TypingMode = "auto" | "always" | "never";
const TYPING_KEY = "setting:typing";

export const TYPING_LABELS: Record<TypingMode, string> = {
  auto: "авто — для карток, які вже добре знаю",
  always: "завжди",
  never: "ніколи — лише кнопки",
};

export async function getTypingMode(): Promise<TypingMode> {
  const v = (await db.meta.get(TYPING_KEY))?.v;
  return v === "always" || v === "never" ? v : "auto";
}

export const setTypingMode = (mode: TypingMode) => db.meta.put({ k: TYPING_KEY, v: mode });

/** In "auto", a card types once it is in review with an interval of a week or more. */
export const KNOWN_DAYS = 7;
export const shouldType = (mode: TypingMode, row: CardRow) =>
  mode === "always" || (mode === "auto" && row.state === 2 && row.scheduled_days >= KNOWN_DAYS);
