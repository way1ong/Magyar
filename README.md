# Magyar

Особистий PWA-тренажер угорської: картки за FSRS + гра «Гармонія голосних» + «Конструктор» слів + «Диктант». Офлайн, без акаунтів.

## Запуск
```bash
npm install
npm run dev -- -H 0.0.0.0   # відкрити з телефону: http://<IP ноутбука>:3000
```
Продакшн (потрібно для service worker і «Додати на головний екран»):
```bash
npm run build && npm start
```

## Структура
```
content/            контент-пакети (JSON) — слова, фрази, суфікси
src/lib/types.ts    модель контенту
src/lib/content.ts  реєстр пакетів (додати імпорт нового JSON тут)
src/lib/db.ts       Dexie: cards, reviews, meta; експорт/імпорт
src/lib/scheduler.ts FSRS: черга, відповідь, превʼю інтервалів
src/lib/harmony.ts  правила гармонії голосних і застосування суфіксів
src/lib/builder.ts  завдання й блоки для «Конструктора»
src/lib/dictation.ts порівняння відповідей для «Диктанту»
src/lib/boss.ts     питання «Боса»; src/lib/progress.ts — відкриття пакетів
src/app/            екрани: / (сьогодні), /review, /harmony, /builder, /dictation, /boss, /settings
public/sw.js        офлайн-кеш
scripts/check-content.mjs  валідація контенту
preview/            тестова збірка одним HTML-файлом (`npm run preview:build`)
```

Деталі — `SPEC.md`; правила для Claude Code — `CLAUDE.md`.
