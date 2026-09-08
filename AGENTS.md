# AGENTS.md — Ainn_site (Стальком Продукт)

Инструкции для AI-агентов.

## Что это

Корпоративный сайт «Стальком Продукт» с inline-редактором контента в админке.

## Стек

React 19, Three.js, Vite, GSAP, Lenis. Node server.

## Запуск и сервисы

* `ainn-site.service` — порт 4175, `ADMIN_SAVE_ENABLED=true`
* `ainn-tunnel.service` — Cloudflare HTTPS туннель (URL меняется при рестарте, смотри `journalctl --user -u ainn-tunnel`)
* Админка: `/admin`; учётные данные `ADMIN_USER`/`ADMIN_PASSWORD` хранятся только в защищённом `~/.config/ainn-site.env` (не в Git).
* Ветка: `feat/admin-inline-editor`

## Инварианты

1. Правки контента через inline-editor сохраняются в файлы — не ломай `ADMIN_SAVE_ENABLED` механизм.
2. Three.js сцены: следить за производительностью (VPS 2 vCPU).
3. Локальный preview: systemd user units, не docker. Продакшен `remont360.kz`: PS.kz shared, PHP API + статическая сборка, FTPS; см. `docs/PHP-HOSTING.md`.
4. В режиме «Текст» ЛЮБОЙ текст на сайте (включая цены тарифов «Стоимость уточняется», списки, шаги) обязан редактироваться инлайново кликом прямо на странице (contenteditable).
5. PHP сборка: `npm run build && node scripts/build-php.mjs`; тесты: `python3 scripts/test-php.py`. Файлы `_private` и uploads на хостинге сохранять между релизами; секреты не коммитить.
