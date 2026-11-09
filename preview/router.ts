import { useSyncExternalStore } from "react";

/**
 * Hash routing for the single-file preview build (Claude artifact).
 * The artifact viewer only passes a plain `#name` through, so every app
 * path maps to one. "settings" is reserved by claude.ai, hence "more".
 */
const ROUTES: Record<string, string> = {
  "/": "",
  "/review": "review",
  "/harmony": "harmony",
  "/builder": "builder",
  "/conj": "conj",
  "/sentences": "sentences",
  "/dictation": "dictation",
  "/boss": "boss",
  "/guide": "guide",
  "/settings": "more",
};

export const hrefFor = (path: string) => "#" + (ROUTES[path] ?? "");

export function currentPath(): string {
  const hash = typeof location === "undefined" ? "" : location.hash.slice(1);
  return Object.entries(ROUTES).find(([, h]) => h === hash)?.[0] ?? "/";
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export const usePath = () => useSyncExternalStore(subscribe, currentPath, () => "/");
