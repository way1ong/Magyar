# Magyar — особистий тренажер угорської (PWA)

Проєкт для одного користувача. Без акаунтів, без бекенду, без монетизації.
Мова інтерфейсу й коментарів для користувача — українська; код і коментарі в коді — англійською.

## Стек
- Next.js 15 (App Router), TypeScript, React 19. Без Tailwind — `src/app/globals.css` з CSS-змінними, light/dark.
- Dexie (IndexedDB) — прогрес. `ts-fsrs` — розклад повторень. Web Speech API — вимова.
- PWA: `public/manifest.json` + ручний `public/sw.js` (реєструється лише в production).

## Дві бази — не плутати
- **Контент** (`content/*.json`) — слова, фрази, суфіксальні патерни. Read-only на телефоні, редагується в репо, бандлиться в застосунок (`src/lib/content.ts`). Перевірка: `npm run content:check`.
- **Прогрес** (IndexedDB `magyar`, `src/lib/db.ts`) — таблиці `cards` (стан FSRS), `reviews` (повний журнал — ніколи не видаляти, по ньому перенавчаються параметри FSRS), `meta`.

## Ключові правила
- `id` елемента контенту стабільний і ніколи не перевикористовується — на нього посилаються картки прогресу.
- Ключ картки: `${exercise}:${itemId}`. Вправи: `recognize` (HU→UA), `recall` (UA→HU), `harmony` (стем → вибір варіанта суфікса), `dictation` (TTS → ввід; `src/lib/dictation.ts`, слова з «/» чи «...» пропускаються), `builder` (UA → зібрати слово з блоків; `itemId` = `<id стема>+<id патерна>`, завдання беруться з `examples` патернів і з `examples` пакета (`{ pattern, stem, result, ua }` — приклади до суфіксів з інших пакетів) — `src/lib/builder.ts`).
- `Pattern.attachesTo` — до яких частин мови чіпляється суфікс (за замовчуванням noun, adj); `attachesTag` — лише до слів з таким тегом (-ul/-ül → `language`). Приклади патернів мають точно дорівнювати `apply()` — інакше `content:check` падає.
- Гармонія голосних: клас стема (`back | front | front_rounded`) задається в контенті явно; `guessHarmony()` — лише fallback. Змішані слова (kávé → back) — винятки, тому тег обовʼязковий.
- `apply()` в `harmony.ts` подовжує кінцеві a/e (alma→almában; крім `noLengthen`: órakor), дає `-n` після голосної для `linking`-суфіксів (autón) і асимілює v для `assimilates` (-val/-vel: busz→busszal, hegy→heggyel). Зміни приголосного стема (ház→házat, sarok→sarkon) НЕ моделюються — не додавати знахідний відмінок у гру без окремої моделі і не ставити слова з випадною голосною (sarok, tükör) у приклади суфіксів.
- Будь-яка нова вправа = новий `Exercise` у `db.ts` + `ensureCards(...)` у `seedCards()` (`src/lib/seed.ts`; її викликають головна й кожна вправа перед завантаженням черги).

## Команди
- `npm run dev` — локально; на телефоні відкривати через IP ноутбука (`next dev -H 0.0.0.0`).
- `npm run build && npm start` — продакшн-збірка; SW працює лише тут.
- `npm run content:check` — валідація контент-пакетів.

## Журнал розробки (артефакт)
Сторінка для користувача: https://claude.ai/artifact/BHeAHiBojGbpSEZm8jwgHR — дорожня карта, зміни, контент-пакети.
Дані живуть у базі артефакту (інструмент `ArtifactData`, той самий `url`), не в HTML — сторінку не перепубліковувати заради даних.
Наприкінці кожної сесії, де щось закомічено, оновити журнал одним `batch`:
- `changes/<cNN-slug>` — новий запис: `order` (наступне число), `date` (YYYY-MM-DD), `title`, `status` (`branch` | `main`), `points[]` (українською, що змінилось для користувача), `commits[]` (`{ sha, msg }`). Коли гілку злито в `main` — оновити `status` у відповідних записах.
- `roadmap/<rNN-slug>` — `order`, `version`, `title`, `detail`, `status` (`done` | `next` | `todo`); тримати в синхроні з розділом «Що далі» нижче.
- `packs/<packId>` — `order`, `id`, `title`, `items`, `byKind` (за `pos`; фрази як `phrase`), `harmony` (`back`/`front`/`front_rounded`), `patterns[]`, `builderTasks` (числа — з `npm run content:check`).
- `meta/summary` — `updated`, `branch`, `inMain`, `packs`, `items`, `cards` (сума по вправах), `exercises[]` (`{ key, name, cards }`).
Перед записом у наявний документ прочитати його й передати `if_version`.

## Тестова збірка (артефакт)
https://claude.ai/artifact/N4susdjABP9cPjeMj1uDDq — увесь застосунок одним HTML-файлом, щоб користувач перевіряв зміни в браузері.
- `npm run preview:build` → `preview/dist/magyar-preview.html` (esbuild; шими `next/link` і `next/navigation` у `preview/shims`, навігація через `#`; `#settings` зарезервований claude.ai, тому «Ще» = `#more`).
- Після кожної зміни застосунку чи контенту: перезібрати й перепублікувати цей файл у той самий `url` (інструмент `Artifact`, `url` вище).
- Сторінки й `src/lib` мають працювати в обох збірках: без `next/*`, окрім `next/link` і `next/navigation`; без `confirm()`/`alert()` (в артефакті не працюють). Прогрес у превʼю — IndexedDB браузера, експорт файлу там не працює.

## Що далі (пріоритет)
1. Piper-аудіо замість системного TTS (диктант ✓ готовий на системному TTS); промова (SpeechRecognition hu-HU).
2. «Бос» наприкінці пакета — змішаний тест без підказок, відкриває наступний пакет.
3. Експорт прогресу на свій сервер (простий POST JSON) — лише як бекап.
