# Стальком Продукт — сайт

Сайт компании «Стальком Продукт» (дизайн и ремонт квартир в Алматы).

Репозиторий: https://github.com/Codekeeper45/ainn_site.git

## Ветки

В репозитории находятся следующие ветки:

| Ветка | Назначение |
| --- | --- |
| `main` | Основная утверждённая одностраничная версия сайта. Это ветка по умолчанию на GitHub. |
| `fix/logo-background` | Исправление фона логотипа в навигации и нижней части сайта. |
| `feat/admin-inline-editor` | Текущая ветка разработки: авторизация и inline-редактор текста и изображений прямо на сайте. |

Основная работа с текущей версией ведётся в `feat/admin-inline-editor`. Ветка `main` сохраняет базовую одностраничную версию без последующих функций редактора.

## Локальный путь

```text
/var/home/emir/Projects/Aini_site
```

## Запуск

```bash
cd /var/home/emir/Projects/Aini_site
npm install
npm run build
ADMIN_ENABLED=true ADMIN_SAVE_ENABLED=false node server.mjs
```

Сайт откроется на `http://127.0.0.1:4175`.

Чтобы включить сохранение изменений из админ-панели:

```bash
ADMIN_ENABLED=true ADMIN_SAVE_ENABLED=true node server.mjs
```

## Структура проекта

- `src/App.jsx` — основная страница сайта.
- `src/styles.css` — стили и адаптивная верстка.
- `src/admin/` — авторизация, inline-редактор и runtime-контент.
- `server.mjs` — локальный HTTP-сервер, API и сессии админ-панели.
- `public/assets/` — изображения, логотипы и шрифты.
- `dist/` — собранный frontend; генерируется командой `npm run build` и не хранится в Git.
- `.site-data/` — runtime-содержимое и загруженные изображения; намеренно исключено из Git.

## Полезные команды Git

```bash
git status
git branch -vv
git log --oneline --decorate -10
git pull --ff-only origin feat/admin-inline-editor
git push origin feat/admin-inline-editor
```
