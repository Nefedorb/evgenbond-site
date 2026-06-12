# Project State

Дата снимка: 2026-06-12.

## Где мы
- Проект: статический персональный сайт `D:\code\333`.
- GitHub repo: `https://github.com/Nefedorb/evgenbond-site`.
- Прод: GitHub Pages, custom domain `evgenbond.ru`, HTTPS включён.
- Деплой: push в `main` запускает workflow `.github/workflows/pages.yml`.
- Локальная точка входа: `index.html`.
- Блог: Markdown-файлы в `content/blog`, сборка через модули `scripts/blog/` в `_site/blog`.
- CMS: Pages CMS через `.pages.yml`, публичная точка входа `/admin/`.
- Шрифты `Inter Tight` и `JetBrains Mono` хранятся локально в WOFF2.
- Единственный агентский регламент: `skills/agents.md`.

## Что сделано
- Главная страница и блог опубликованы на `https://evgenbond.ru/`.
- Блог переведён в компактный журнальный layout без большого hero.
- Добавлен блочный конструктор статей в Pages CMS: `text`, `image`, `video`, `code`, `quote`, `divider`.
- Разведены изображения:
  - `coverImage` - видимая обложка карточки и опциональная обложка в статье;
  - `sharedImage` - только OG/Twitter/snippet, в статье не выводится.
- Обложки карточек адаптированы под формат `1200x630` без кропа.
- Картинки внутри статьи сохраняют исходные пропорции.
- У каждого `image`-блока есть свитчер `showBorder` / `Показывать рамку`.
- У обложки статьи есть отдельный свитчер `showCoverBorder` / `Показывать рамку у обложки`.
- Обложка и изображения внутри статьи открываются в полноэкранном просмотре по клику.
- Добавлены кликабельные теги и статические страницы тегов вида `/blog/tag/<slug>/`.
- Добавлена статическая пагинация блога по 6 статей на страницу.
- Добавлены видео-блоки для YouTube, Kinescope и безопасного custom HTTPS embed URL.
- Видео-блоки оформлены светлой рамкой со скруглением без чёрных углов контейнера.
- Главная использует адаптивные WebP-изображения; hover-портрет не загружается на touch-устройствах.
- Kinescope на главной загружается только после клика по локальному превью.
- Стили разделены на `base.css`, `home.css`, `blog.css`, `policy.css` и `cookie-consent.css`.
- На главной, блоге и статьях добавлены JSON-LD и семантический `<main>`.
- Добавлены проверки `node:test`, команды `npm test` и `npm run check`.
- В code-блоках есть кнопка копирования.
- В blog-навигации используются SVG-иконки `/arrow.svg`.
- Футер блога: оставлен label `[ ТЕРМИНАЛ СВЯЗИ ]`, большой CTA-заголовок убран.

## Актуальные файлы
- `.pages.yml` - схема Pages CMS.
- `scripts/build-blog.mjs` - короткая точка запуска сборки.
- `scripts/blog/content.mjs` - чтение и валидация контента.
- `scripts/blog/render.mjs` - HTML-рендеринг.
- `scripts/blog/seo.mjs` - sitemap, robots и SEO.
- `scripts/blog/build-site.mjs` - сборка `_site`.
- `assets/site/*.css` - общие и страничные стили.
- `docs/BLOG_CMS.md` - инструкция по CMS и структуре статей.
- `content/blog/*.md` - статьи.
- `assets/blog/*` - загруженные через Pages CMS изображения.
- `admin/index.html` - страница входа в админку.
- `skills/agents.md` - локальный агентский регламент проекта.

## Проверено
- `npm run check` успешно собирает `_site` и запускает тесты.
- Последний деплой GitHub Pages после CMS-правок и обновлений генератора успешен.
- Публичные URL работают:
  - `https://evgenbond.ru/`
  - `https://evgenbond.ru/blog/`
  - `https://evgenbond.ru/blog/tipograf-dlya-teksta/`
  - `https://evgenbond.ru/admin/`
- `.pages.yml` содержит актуальные поля CMS, включая `showBorder` и `showCoverBorder`.

## Важные правила работы
- Не коммитить `_site`: GitHub Actions сам собирает и публикует сайт.
- Не добавлять новые npm-зависимости без явной причины.
- Не трогать и не коммитить `skills/agents.md` в задачах блога/CMS, если пользователь явно не попросил.
- Если Pages CMS сделал коммит параллельно локальной работе, перед push делать `pull --rebase`, сохранив локальные незакоммиченные правки.

## Быстрый старт
```powershell
cd D:\code\333
git status --short
npm run build
npm test
npm run check
npm run dev
```

Открыть локально:
- `http://localhost:4173/`
- `http://localhost:4173/blog/`
- `http://localhost:4173/blog/tipograf-dlya-teksta/`
- `http://localhost:4173/admin/`

## Что можно делать дальше
- Проверить новый свитчер `Показывать рамку` прямо в Pages CMS.
- Дополнять реальные статьи и при необходимости снять демо-контент с публикации через `published: false`.
- При росте блога проверить пагинацию и страницы тегов на реальном наборе материалов.
