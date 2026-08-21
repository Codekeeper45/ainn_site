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
3. Деплой через systemd user units, не через docker.
