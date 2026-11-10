import { createRoot } from "react-dom/client";
import type { ComponentType } from "react";
import "@/app/globals.css";
import "./preview.css";
import { Tabs } from "@/components/Tabs";
import { WriteStatus } from "@/components/WriteStatus";
import Home from "@/app/page";
import ReviewPage from "@/app/review/page";
import HarmonyPage from "@/app/harmony/page";
import BuilderPage from "@/app/builder/page";
import ConjPage from "@/app/conj/page";
import SentencesPage from "@/app/sentences/page";
import DialoguesPage from "@/app/dialogues/page";
import DictionaryPage from "@/app/dictionary/page";
import MistakesPage from "@/app/mistakes/page";
import StatsPage from "@/app/stats/page";
import DictationPage from "@/app/dictation/page";
import BossPage from "@/app/boss/page";
import GuidePage from "@/app/guide/page";
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
  "/conj": ConjPage,
  "/sentences": SentencesPage,
  "/dialogues": DialoguesPage,
  "/dictionary": DictionaryPage,
  "/mistakes": MistakesPage,
  "/stats": StatsPage,
  "/dictation": DictationPage,
  "/boss": BossPage,
  "/guide": GuidePage,
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
      <WriteStatus />
      <Tabs />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
