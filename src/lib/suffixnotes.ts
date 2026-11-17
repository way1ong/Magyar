import data from "@content/suffix-notes.json";

/**
 * «Детальніше» for a suffix (content/suffix-notes.json): a few lines on how
 * it is used and why its meanings belong together (-ról/-ről: from a surface
 * → "about"), with examples. The nine place suffixes also form a 3×3 family
 * — inside / surface / near × where / where to / where from — shown as a
 * table with the current suffix highlighted, so the three "звідки?" suffixes
 * (-ból, -ról, -tól) are seen side by side.
 */
export interface SuffixNote {
  text: string[];
  examples: { hu: string; ua: string }[];
}
export interface SuffixFamily {
  id: string;
  title: string;
  cols: string[];
  /** Each cell: [pattern id, label shown in the table]. */
  rows: { label: string; cells: string[][] }[];
  intro: string[];
}

const notes = data.notes as Record<string, SuffixNote>;
const families = data.families as SuffixFamily[];

export const suffixNote = (patternId: string): SuffixNote | undefined => notes[patternId];
export const suffixFamily = (patternId: string): SuffixFamily | undefined =>
  families.find((f) => f.rows.some((r) => r.cells.some(([id]) => id === patternId)));
