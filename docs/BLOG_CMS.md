# Blog CMS

## Как устроено
- Статьи лежат в `content/blog/*.md`.
- Картинки для статей и shared links лежат в `assets/blog` или в корне сайта, если это общий файл вроде `/sharedlink.jpg`.
- Онлайн-редактор: Pages CMS, конфигурация в `.pages.yml`.
- Публикация: `npm run build` собирает статический сайт в `_site`.
- GitHub Pages публикует `_site` через workflow `.github/workflows/pages.yml`.

## Главные файлы
- `.pages.yml` - схема админки Pages CMS.
- `scripts/build-blog.mjs` - генератор блога и валидация frontmatter.
- `content/blog/2026-06-01-blog-start.md` - пример статьи.
- `admin/index.html` - входная страница для онлайн-админки.
- `docs/PROJECT_STATE.md` - быстрый контекст проекта и следующие шаги.
- `skills/agents.md` - единственный агентский регламент проекта.

## Поля статьи
- `title` - заголовок страницы и shared link.
- `slug` - URL вида `/blog/<slug>/`, только латиница, цифры и дефисы.
- `date` - дата публикации.
- `published` - если `false`, статья не попадает в сборку.
- `description` - SEO и shared-link описание.
- `sharedImage` - абсолютный путь к картинке, например `/assets/blog/post-cover.jpg`.
- `sharedImageAlt` - alt-текст картинки.
- `tags` - список тегов.
- `body` - Markdown/Rich text тело статьи.

## Локальная проверка
```powershell
npm install
npm run build
npm run dev
```

После запуска `npm run dev` открыть:
- `http://localhost:4173/`
- `http://localhost:4173/blog/`
- `http://localhost:4173/blog/zachem-biznesu-sistemnyy-sayt/`
- `http://localhost:4173/admin/`

## Как добавить статью через Pages CMS
1. Открыть `https://app.pagescms.org/`.
2. Войти через GitHub.
3. Выбрать репозиторий `Nefedorb/evgenbond-site`.
4. Открыть коллекцию `Блог`.
5. Создать статью, заполнить обязательные поля и загрузить shared-link картинку.
6. Сохранение в CMS создаёт commit в GitHub; после этого GitHub Actions пересобирает сайт.

## Ограничения v1
- Нет runtime backend и базы данных.
- UI-фреймворки не используются.
- `_site`, `node_modules`, `.vscode/sftp.json`, CSV, backup HTML и локальные артефакты не коммитятся.
- Статья без `title`, `slug`, `date`, `description` или существующего `sharedImage` не должна молча попасть в публикацию.
