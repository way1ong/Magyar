import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

/**
 * Progress backup endpoint — the laptop that serves the app keeps copies.
 * POST: body = exportProgress() JSON → backups/magyar-<timestamp>.json.
 * GET: the newest backups. No auth: the app is served on the home LAN
 * only, for one person; keep it that way (don't expose this port).
 */
export const runtime = "nodejs";

const DIR = path.join(process.cwd(), "backups");
const KEEP = 60;
const MAX_BYTES = 20 * 1024 * 1024;

async function list() {
  await mkdir(DIR, { recursive: true });
  const names = (await readdir(DIR)).filter((n) => /^magyar-.*\.json$/.test(n)).sort().reverse();
  return Promise.all(
    names.map(async (name) => ({ name, bytes: (await stat(path.join(DIR, name))).size }))
  );
}

export async function GET() {
  const files = await list();
  return NextResponse.json({ dir: DIR, files: files.slice(0, 10), count: files.length });
}

export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });
  let data: { version?: number; cards?: unknown; reviews?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "not JSON" }, { status: 400 });
  }
  if (data?.version !== 1 || !Array.isArray(data.cards) || !Array.isArray(data.reviews)) {
    return NextResponse.json({ error: "not a Magyar progress export" }, { status: 400 });
  }
  await mkdir(DIR, { recursive: true });
  const name = `magyar-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
  await writeFile(path.join(DIR, name), text, "utf8");
  // Keep the newest KEEP files.
  const files = await list();
  await Promise.all(files.slice(KEEP).map((f) => unlink(path.join(DIR, f.name))));
  return NextResponse.json({ ok: true, name, bytes: text.length, cards: data.cards.length, reviews: data.reviews.length });
}
