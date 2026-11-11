import { db, exportProgress } from "./db";

/**
 * Progress backups. Two ways out of the phone:
 *  - the laptop that serves the app (POST /api/backup → backups/ there);
 *    tried automatically from Home when there are new reviews;
 *  - the share sheet (Web Share API) to put the JSON into Drive/Telegram/…
 * The single-file preview build and the static GitHub Pages build have no
 * server: the laptop path is off there (NO_LAPTOP).
 */
export const IS_PREVIEW = process.env.NEXT_PUBLIC_MAGYAR_PREVIEW === "1";
export const IS_STATIC = process.env.NEXT_PUBLIC_MAGYAR_STATIC === "1";
export const NO_LAPTOP = IS_PREVIEW || IS_STATIC;

export interface BackupState {
  /** Epoch ms of the last successful laptop backup. */
  ts: number;
  name: string;
  /** db.reviews.count() at that time — new reviews since then mean a backup is due. */
  reviews: number;
}

const META_KEY = "lastBackup";
/** When the person last exported or shared the progress file (any build). */
export const EXPORT_KEY = "lastExport";
export const markExported = () => db.meta.put({ k: EXPORT_KEY, v: Date.now() });
export const lastExport = async () => ((await db.meta.get(EXPORT_KEY))?.v as number | undefined) ?? 0;
const AUTO_EVERY_MS = 6 * 60 * 60 * 1000;

export const lastBackup = async () => (await db.meta.get(META_KEY))?.v as BackupState | undefined;

/** POST the full export to the laptop. Throws with a readable message on failure. */
export async function backupToLaptop(): Promise<BackupState> {
  if (NO_LAPTOP) throw new Error("У цій збірці нема ноутбука-сервера.");
  const data = await exportProgress();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let res: Response;
  try {
    res = await fetch("/api/backup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
      signal: ctrl.signal,
    });
  } catch {
    throw new Error("Ноутбук недоступний (не та Wi-Fi або сервер не запущено).");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Сервер відповів ${res.status}.`);
  const { name } = (await res.json()) as { name: string };
  const state: BackupState = { ts: Date.now(), name, reviews: data.reviews.length };
  await db.meta.put({ k: META_KEY, v: state });
  return state;
}

/** Silent backup when there are new reviews and the last one is old enough. */
export async function maybeAutoBackup(): Promise<void> {
  if (NO_LAPTOP) return;
  const last = await lastBackup();
  const reviews = await db.reviews.count();
  if (reviews === 0) return;
  if (last && last.reviews === reviews) return;
  if (last && Date.now() - last.ts < AUTO_EVERY_MS) return;
  try {
    await backupToLaptop();
  } catch {
    // Laptop not reachable now — Settings shows how old the last backup is.
  }
}

/** Hand the export to the share sheet; false when the browser can't share files. */
export async function shareProgress(): Promise<boolean> {
  const data = await exportProgress();
  const file = new File([JSON.stringify(data)], `magyar-progress-${new Date().toISOString().slice(0, 10)}.json`, {
    type: "application/json",
  });
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title: "Magyar — прогрес" });
    await markExported();
  } catch {
    // The person closed the sheet.
  }
  return true;
}
