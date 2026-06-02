# Project State

Дата снимка: 2026-06-02.

## Где мы
- Проект: статический персональный сайт `D:\code\333`.
- GitHub repo: `https://github.com/Nefedorb/evgenbond-site`.
- Прод: GitHub Pages, custom domain `evgenbond.ru`, HTTPS включён.
- Деплой: push в `main` запускает workflow `.github/workflows/pages.yml`.
- Локальная точка входа: `index.html`.
- Блог: Markdown-файлы в `content/blog`, сборка через `scripts/build-blog.mjs` в `_site/blog`.
- CMS: Pages CMS через `.pages.yml`, публичная точка входа `/admin/`.
- Шрифт сайта и блога: Google Font `Inter Tight`; mono-элементы на `JetBrains Mono`.
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
- Добавлены кликабельные теги и статические страницы тегов вида `/blog/tag/<slug>/`.
- Добавлена статическая пагинация блога по 6 статей на страницу.
- Добавлены видео-блоки для YouTube, Kinescope и безопасного custom HTTPS embed URL.
- В code-блоках есть кнопка копирования.
- В blog-навигации используются SVG-иконки `/arrow.svg`.
- Футер блога: оставлен label `[ ТЕРМИНАЛ СВЯЗИ ]`, большой CTA-заголовок убран.

## Актуальные файлы
- `.pages.yml` - схема Pages CMS.
- `scripts/build-blog.mjs` - генератор блога, HTML/CSS блога, валидация контента.
- `docs/BLOG_CMS.md` - инструкция по CMS и структуре статей.
- `content/blog/*.md` - статьи.
- `assets/blog/*` - загруженные через Pages CMS изображения.
- `admin/index.html` - страница входа в админку.
- `skills/agents.md` - локальный агентский регламент проекта.

## Проверено
- `npm run build` успешно собирает `_site`.
- Последний деплой GitHub Pages после CMS-правок и обновлений генератора успешен.
- Публичные URL работают:
  - `https://evgenbond.ru/`
  - `https://evgenbond.ru/blog/`
  - `https://evgenbond.ru/blog/tipograf-dlya-teksta/`
  - `https://evgenbond.ru/admin/`
- Raw `.pages.yml` в GitHub содержит актуальные поля CMS, включая `showBorder`.

## Важные правила работы
- Не коммитить `_site`: GitHub Actions сам собирает и публикует сайт.
- Не добавлять новые npm-зависимости без явной причины.
- Не трогать и не коммитить `skills/agents.md` в задачах блога/CMS, если пользователь явно не попросил.
- Если Pages CMS сделал коммит параллельно локальной работе, перед push делать `pull --rebase`, сохранив локальные незакоммиченные правки.
- Текущая локальная незакоммиченная правка: `skills/agents.md`.

## Быстрый старт
```powershell
cd D:\code\333
git status --short
npm run build
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
