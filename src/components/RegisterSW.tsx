"use client";
import { useEffect } from "react";

/**
 * Registers the offline service worker in production only. The worker lives
 * next to the app (/sw.js, or /Magyar/sw.js on GitHub Pages), so its scope
 * is the app itself.
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});
  }, []);
  return null;
}
