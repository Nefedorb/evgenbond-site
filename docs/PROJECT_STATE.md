# Project State

Дата снимка: 2026-06-01.

## Где мы
- Проект: статический персональный сайт `D:\code\333`.
- GitHub repo: `https://github.com/Nefedorb/evgenbond-site`.
- Прод-контур: GitHub Pages через workflow `.github/workflows/pages.yml`.
- Домен в GitHub Pages: `evgenbond.ru`.
- Локальная точка входа: `index.html`.
- Блог: Markdown в `content/blog`, сборка в `_site/blog`.
- CMS: Pages CMS через `.pages.yml`.
- Единственный агентский регламент: `skills/agents.md`.
- Корневой `AGENTS.md` удалён намеренно. Если он открыт во вкладке VS Code, закрыть без сохранения.

## Что сделано
- Поднят локальный git и создан public repo `Nefedorb/evgenbond-site`.
- Добавлены `.gitignore` и `.gitattributes`.
- Добавлены Node.js-скрипты сборки: `npm run build`, `npm run dev`.
- Добавлен генератор блога `scripts/build-blog.mjs`.
- Добавлена валидация frontmatter статьи.
- Добавлена конфигурация Pages CMS `.pages.yml`.
- Добавлены `admin/index.html`, `docs/BLOG_CMS.md`, пример статьи и папка `assets/blog`.
- На главную добавлен блок со ссылкой на `/blog/`.
- Добавлен GitHub Pages workflow.
- GitHub Pages включён, custom domain выставлен как `evgenbond.ru`.
- Корневой `AGENTS.md` удалён, правило проекта перенесено в `skills/agents.md`.

## Базовые коммиты до этого снимка
- `018fd23 Keep single agents guide`
- `8cc6d79 Update Pages workflow actions`
- `90fdd50 Initial static site and blog CMS scaffold`

Актуальный список после новых правок:
```powershell
git log --oneline --decorate -5
```

## Проверено
- `npm install` - успешно.
- `npm run build` - успешно, собирает 1 опубликованную статью.
- `npm audit --audit-level=moderate` - 0 vulnerabilities.
- Локальные URL отдавали 200:
  - `http://localhost:4173/`
  - `http://localhost:4173/blog/`
  - `http://localhost:4173/blog/zachem-biznesu-sistemnyy-sayt/`
  - `http://localhost:4173/admin/`
- Playwright-снимки desktop/mobile визуально проверены.
- GitHub Actions успешен на последнем deploy после удаления дубля agents:
  - `https://github.com/Nefedorb/evgenbond-site/actions/runs/26767954774`

## Что нужно дальше
1. Дождаться DNS или поправить записи у DNS-провайдера.
   - Для `evgenbond.ru` нужны A-записи GitHub Pages:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - Последняя проверка всё ещё показывала старый IP `87.236.16.15`.
2. Для `www.evgenbond.ru` CNAME нужен только если нужен `www`.
   - Старую A-запись для `www` нужно удалить.
   - Затем добавить CNAME `www -> nefedorb.github.io`.
   - Если DNS-панель не даёт CNAME, можно временно жить без `www`.
3. После DNS propagation включить HTTPS:
   ```powershell
   gh api --method PUT repos/Nefedorb/evgenbond-site/pages -F https_enforced=true
   ```
4. Проверить публичные URL:
   - `https://evgenbond.ru/`
   - `https://evgenbond.ru/blog/`
   - `https://evgenbond.ru/blog/zachem-biznesu-sistemnyy-sayt/`
   - `https://evgenbond.ru/admin/`
5. Проверить Pages CMS на реальном сценарии:
   - войти на `https://app.pagescms.org/`;
   - выбрать `Nefedorb/evgenbond-site`;
   - создать тестовую draft-статью;
   - убедиться, что commit запускает GitHub Actions.
6. Заменить пример статьи на реальную или оставить как черновик.

## Быстрый старт после перезапуска VS Code
```powershell
cd D:\code\333
git status --short --ignored
npm run build
npm run dev
```

Открыть `http://localhost:4173/`.

Если VS Code после перезапуска показывает вкладку `AGENTS.md`, её не сохранять. На диске этот файл удалён по решению проекта.
