import { createRoot } from "react-dom/client";
import type { ComponentType } from "react";
import "@/app/globals.css";
import "./preview.css";
import { Tabs } from "@/components/Tabs";
import Home from "@/app/page";
import ReviewPage from "@/app/review/page";
import HarmonyPage from "@/app/harmony/page";
import BuilderPage from "@/app/builder/page";
import DictationPage from "@/app/dictation/page";
import SettingsPage from "@/app/settings/page";
import { usePath } from "./router";

/**
 * Single-file preview of the app for a Claude artifact: the same pages and
 * lib code as the Next.js app, with hash routing instead of the App Router
 * and no service worker. Progress lives in this browser's IndexedDB only.
 */
const PAGES: Record<string, ComponentType> = {
  "/": Home,
  "/review": ReviewPage,
  "/harmony": HarmonyPage,
  "/builder": BuilderPage,
  "/dictation": DictationPage,
  "/settings": SettingsPage,
};

function App() {
  const path = usePath();
  const Page = PAGES[path] ?? Home;
  return (
    <>
      <main className="wrap">
        {path === "/" && (
          <p className="preview-banner">
            Тестова збірка. Прогрес зберігається лише в цьому браузері й не повʼязаний із телефоном.
          </p>
        )}
        <Page key={path} />
      </main>
      <Tabs />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
