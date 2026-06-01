# Blog CMS

## Как устроено
- Статьи лежат в `content/blog/*.md`.
- Картинки для статей и shared link загружаются в `assets/blog`.
- Онлайн-редактор: Pages CMS, конфигурация в `.pages.yml`.
- Публикация: `npm run build` создаёт статический сайт в `_site`.

## Поля статьи
- `title` — заголовок страницы и shared link.
- `slug` — URL вида `/blog/<slug>/`, только латиница, цифры и дефисы.
- `date` — дата публикации.
- `published` — если `false`, статья не попадает в сборку.
- `description` — SEO и shared-link описание.
- `sharedImage` — абсолютный путь к картинке, например `/assets/blog/post-cover.jpg`.
- `sharedImageAlt` — alt-текст картинки.
- `tags` — список тегов.
- `body` — Markdown/Rich text тело статьи.

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

## Ограничения
- В v1 нет runtime backend и базы данных.
- Pages CMS пишет изменения в GitHub-репозиторий.
- `_site`, `node_modules`, `.vscode/sftp.json`, CSV и backup HTML не коммитятся.
