import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "_site");
const BLOG_DIR = path.join(ROOT, "content", "blog");
const SITE_URL = (process.env.SITE_URL || "https://evgenbond.ru").replace(/\/$/, "");
const SITE_TITLE = "Создание сайтов и цифровые услуги для малого и среднего бизнеса";
const SITE_DESCRIPTION = "Практика, заметки и разборы о сайтах, маркетинге, контенте и цифровых системах для бизнеса.";

marked.use({
  gfm: true,
  breaks: false
});

const BLOG_EXTRA_CSS = `
        .blog-panel {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border-bottom: var(--border);
        }
        .blog-panel-left {
            padding: 6vw 4vw;
            background: var(--black);
            color: var(--white);
            border-right: var(--border);
        }
        .blog-panel-left h2,
        .blog-panel-left p { color: var(--white); }
        .blog-panel-right {
            padding: 6vw 4vw;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 32px;
            background: var(--white);
        }
        .blog-panel-right p { max-width: 60ch; }
        .blog-shell { border-bottom: var(--border); }
        .blog-hero {
            padding: 6vw 4vw;
            border-bottom: var(--border);
            background: var(--white);
        }
        .blog-hero p {
            max-width: 72ch;
            margin-top: 24px;
            color: var(--black);
        }
        .blog-toolbar {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            margin-top: 32px;
        }
        .blog-list {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            border-bottom: var(--border);
        }
        .blog-card {
            display: grid;
            grid-template-rows: auto 1fr;
            min-height: 100%;
            color: var(--black);
            text-decoration: none;
            border-right: var(--border);
            border-bottom: var(--border);
            background: var(--white);
            transition: var(--transition-fast);
        }
        .blog-card:nth-child(even) { border-right: none; }
        .blog-card:hover {
            background: var(--black);
            color: var(--white);
        }
        .blog-card:hover p,
        .blog-card:hover .mono-text { color: var(--gray-light); }
        .blog-card-media {
            aspect-ratio: 16 / 9;
            border-bottom: var(--border);
            overflow: hidden;
            background: var(--bg-color);
        }
        .blog-card-media img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .blog-card-body { padding: 32px 3vw; }
        .blog-card h2 {
            font-size: clamp(1.8rem, 3vw, 3.2rem);
            margin: 14px 0;
        }
        .article-shell {
            padding: 0;
            border-bottom: var(--border);
            background: var(--white);
        }
        .article-hero {
            padding: 6vw 4vw;
            border-bottom: var(--border);
        }
        .article-hero p {
            max-width: 72ch;
            margin-top: 24px;
            color: var(--black);
        }
        .article-cover {
            width: 100%;
            aspect-ratio: 1200 / 630;
            border-bottom: var(--border);
            overflow: hidden;
            background: var(--bg-color);
        }
        .article-cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .article-content {
            max-width: 900px;
            padding: 5vw 4vw 7vw;
        }
        .article-content h2,
        .article-content h3 {
            margin: 1.6em 0 0.5em;
            letter-spacing: 0;
        }
        .article-content h2 { font-size: clamp(2rem, 4vw, 3.4rem); }
        .article-content h3 { font-size: clamp(1.4rem, 2.4vw, 2rem); }
        .article-content p,
        .article-content li {
            font-size: 1.18rem;
            line-height: 1.65;
            color: var(--gray-dark);
        }
        .article-content p + p { margin-top: 1em; }
        .article-content ul,
        .article-content ol {
            margin: 1.2em 0 1.2em 1.2em;
        }
        .article-content a {
            color: var(--brand-red);
            text-decoration-thickness: 2px;
        }
        .article-content img {
            width: 100%;
            height: auto;
            border: var(--border);
            margin: 2em 0;
        }
        .empty-blog {
            padding: 6vw 4vw;
            border-bottom: var(--border);
        }
        @media (max-width: 1024px) {
            .blog-panel { grid-template-columns: 1fr; }
            .blog-panel-left { border-right: none; border-bottom: var(--border); }
            .blog-list { grid-template-columns: 1fr; }
            .blog-card { border-right: none; }
        }
        @media (max-width: 768px) {
            .blog-toolbar .btn-strict { width: 100%; }
            .article-content { padding: 40px 24px 56px; }
        }
`;

const ALLOWED_TAGS = sanitizeHtml.defaults.allowedTags.concat([
  "img",
  "h1",
  "h2",
  "h3",
  "figure",
  "figcaption"
]);

const ALLOWED_ATTRIBUTES = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: ["href", "name", "target", "rel", "title"],
  img: ["src", "alt", "title", "loading", "width", "height"]
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toAbsoluteUrl(value) {
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

function normalizeDate(value, sourceFile) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${sourceFile}: некорректная дата публикации`);
  }
  return date;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function validateImage(imagePath, sourceFile) {
  if (typeof imagePath !== "string" || imagePath.trim() === "") {
    throw new Error(`${sourceFile}: sharedImage обязателен`);
  }

  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  if (!imagePath.startsWith("/") || imagePath.includes("..")) {
    throw new Error(`${sourceFile}: sharedImage должен быть абсолютным публичным путём, например /assets/blog/cover.jpg`);
  }

  const localPath = path.join(ROOT, imagePath.replace(/^\/+/, ""));
  const relative = path.relative(ROOT, localPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${sourceFile}: sharedImage выходит за пределы проекта`);
  }

  if (!existsSync(localPath)) {
    throw new Error(`${sourceFile}: файл sharedImage не найден: ${imagePath}`);
  }

  return imagePath;
}

function validatePost(frontmatter, sourceFile) {
  const requiredStringFields = ["title", "slug", "description", "sharedImageAlt"];

  for (const field of requiredStringFields) {
    if (typeof frontmatter[field] !== "string" || frontmatter[field].trim() === "") {
      throw new Error(`${sourceFile}: поле ${field} обязательно`);
    }
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(frontmatter.slug)) {
    throw new Error(`${sourceFile}: slug должен содержать только латиницу, цифры и дефисы`);
  }

  if (!frontmatter.date) {
    throw new Error(`${sourceFile}: поле date обязательно`);
  }

  const date = normalizeDate(frontmatter.date, sourceFile);
  const sharedImage = validateImage(frontmatter.sharedImage, sourceFile);
  const tags = Array.isArray(frontmatter.tags)
    ? frontmatter.tags.filter(Boolean).map(String)
    : [];

  return {
    title: frontmatter.title.trim(),
    slug: frontmatter.slug.trim(),
    date,
    dateIso: date.toISOString(),
    published: frontmatter.published !== false,
    description: frontmatter.description.trim(),
    sharedImage,
    sharedImageAlt: frontmatter.sharedImageAlt.trim(),
    tags
  };
}

async function ensureCleanDist() {
  if (path.basename(DIST) !== "_site") {
    throw new Error(`Refusing to remove unexpected dist path: ${DIST}`);
  }

  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });
}

async function copyFile(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function copyDirectory(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function copyPublicAssets() {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  const publicDirectories = new Set(["assets", "admin"]);

  for (const entry of entries) {
    const sourcePath = path.join(ROOT, entry.name);
    const targetPath = path.join(DIST, entry.name);

    if (entry.isDirectory() && publicDirectories.has(entry.name)) {
      await copyDirectory(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile()) continue;

    const isPublicFile =
      entry.name === "index.html" ||
      entry.name === "CNAME" ||
      /\.(jpe?g|png|webp|gif|svg|ico)$/i.test(entry.name);

    if (isPublicFile) {
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function getBaseStyle() {
  const indexHtml = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
  const match = indexHtml.match(/<style>([\s\S]*?)<\/style>/i);

  if (!match) {
    throw new Error("Не найден базовый <style> в index.html");
  }

  return `${match[1]}\n${BLOG_EXTRA_CSS}`;
}

function renderHead({ title, description, path: pagePath, image, imageAlt, type = "website" }) {
  const canonical = toAbsoluteUrl(pagePath);
  const absoluteImage = toAbsoluteUrl(image);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImageAlt = escapeHtml(imageAlt || title);

  return `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:type" content="${type}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${absoluteImage}">
    <meta property="og:image:secure_url" content="${absoluteImage}">
    <meta property="og:image:alt" content="${safeImageAlt}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDescription}">
    <meta name="twitter:image" content="${absoluteImage}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="shortcut icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@200;400;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">`;
}

function renderPage({ head, style, body }) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>${head}
    <style>${style}
    </style>
</head>
<body>
${body}
</body>
</html>
`;
}

function renderBlogIndex(posts, style) {
  const cards = posts.length
    ? posts.map((post) => `
                <a class="blog-card" href="/blog/${escapeHtml(post.slug)}/">
                    <div class="blog-card-media">
                        <img src="${escapeHtml(post.sharedImage)}" alt="${escapeHtml(post.sharedImageAlt)}" loading="lazy">
                    </div>
                    <div class="blog-card-body">
                        <div class="mono-text">${escapeHtml(formatDate(post.date))}${post.tags.length ? ` // ${escapeHtml(post.tags.join(" / "))}` : ""}</div>
                        <h2>${escapeHtml(post.title)}</h2>
                        <p>${escapeHtml(post.description)}</p>
                    </div>
                </a>`).join("")
    : `
                <div class="empty-blog">
                    <div class="mono-text" style="margin-bottom: 20px;">[ CONTENT PIPELINE // EMPTY ]</div>
                    <h2>МАТЕРИАЛЫ СКОРО ПОЯВЯТСЯ</h2>
                    <p style="margin-top: 20px;">Админка уже готова принимать статьи, картинки и SEO-описания.</p>
                </div>`;

  const body = `
    <div class="master-grid blog-shell">
        <section class="blog-hero">
            <div class="mono-text">[ ЖУРНАЛ // ПРАКТИКА ]</div>
            <h1 style="margin-top: 20px;">БЛОГ О САЙТАХ,<br>МАРКЕТИНГЕ И&nbsp;СИСТЕМАХ</h1>
            <p>${escapeHtml(SITE_DESCRIPTION)}</p>
            <div class="blog-toolbar">
                <a href="/" class="btn-strict" style="max-width: 360px;">
                    <span>На главную</span>
                    <span class="arrow-icon">[ ← ]</span>
                </a>
            </div>
        </section>
        <section class="blog-list">
${cards}
        </section>
        <section class="footer-cta">
            <div class="mono-text" style="color: var(--gray-light); margin-bottom: 20px;">[ ТЕРМИНАЛ СВЯЗИ ]</div>
            <h2>ЕСТЬ ЗАДАЧА ДЛЯ САЙТА?</h2>
            <a href="https://t.me/nefedor" class="btn-giant" target="_blank" rel="noopener noreferrer">НАПИСАТЬ В&nbsp;TELEGRAM</a>
        </section>
    </div>`;

  return renderPage({
    head: renderHead({
      title: `Блог — ${SITE_TITLE}`,
      description: SITE_DESCRIPTION,
      path: "/blog/",
      image: "/sharedlink.jpg",
      imageAlt: SITE_TITLE
    }),
    style,
    body
  });
}

function renderPost(post, style) {
  const renderedMarkdown = marked.parse(post.rawBody);
  const safeContent = sanitizeHtml(renderedMarkdown, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
      img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }, true)
    }
  });

  const body = `
    <div class="master-grid blog-shell">
        <article class="article-shell">
            <header class="article-hero">
                <div class="mono-text">${escapeHtml(formatDate(post.date))}${post.tags.length ? ` // ${escapeHtml(post.tags.join(" / "))}` : ""}</div>
                <h1 style="margin-top: 20px;">${escapeHtml(post.title)}</h1>
                <p>${escapeHtml(post.description)}</p>
                <div class="blog-toolbar">
                    <a href="/blog/" class="btn-strict" style="max-width: 360px;">
                        <span>Все статьи</span>
                        <span class="arrow-icon">[ ← ]</span>
                    </a>
                </div>
            </header>
            <div class="article-cover">
                <img src="${escapeHtml(post.sharedImage)}" alt="${escapeHtml(post.sharedImageAlt)}">
            </div>
            <div class="article-content">
${safeContent}
            </div>
        </article>
        <section class="footer-cta">
            <div class="mono-text" style="color: var(--gray-light); margin-bottom: 20px;">[ ТЕРМИНАЛ СВЯЗИ ]</div>
            <h2>НУЖЕН САЙТ С ТАКОЙ ЖЕ СИСТЕМОЙ?</h2>
            <a href="https://t.me/nefedor" class="btn-giant" target="_blank" rel="noopener noreferrer">НАПИСАТЬ В&nbsp;TELEGRAM</a>
        </section>
    </div>`;

  return renderPage({
    head: renderHead({
      title: `${post.title} — ${SITE_TITLE}`,
      description: post.description,
      path: `/blog/${post.slug}/`,
      image: post.sharedImage,
      imageAlt: post.sharedImageAlt,
      type: "article"
    }),
    style,
    body
  });
}

async function readPosts() {
  if (!existsSync(BLOG_DIR)) return [];

  const files = (await fs.readdir(BLOG_DIR))
    .filter((file) => file.endsWith(".md"))
    .sort();

  const posts = [];
  const slugs = new Set();

  for (const file of files) {
    const sourcePath = path.join(BLOG_DIR, file);
    const source = await fs.readFile(sourcePath, "utf8");
    const parsed = matter(source);
    const post = validatePost(parsed.data, file);

    if (slugs.has(post.slug)) {
      throw new Error(`${file}: slug не уникален: ${post.slug}`);
    }

    slugs.add(post.slug);
    post.rawBody = parsed.content.trim();

    if (!post.rawBody) {
      throw new Error(`${file}: тело статьи не должно быть пустым`);
    }

    if (post.published) {
      posts.push(post);
    }
  }

  return posts.sort((a, b) => b.date.getTime() - a.date.getTime());
}

async function writeBlog(posts, style) {
  await fs.mkdir(path.join(DIST, "blog"), { recursive: true });
  await fs.writeFile(path.join(DIST, "blog", "index.html"), renderBlogIndex(posts, style), "utf8");

  for (const post of posts) {
    const postDir = path.join(DIST, "blog", post.slug);
    await fs.mkdir(postDir, { recursive: true });
    await fs.writeFile(path.join(postDir, "index.html"), renderPost(post, style), "utf8");
  }
}

async function main() {
  await ensureCleanDist();
  await copyPublicAssets();

  const style = await getBaseStyle();
  const posts = await readPosts();
  await writeBlog(posts, style);

  console.log(`Built ${posts.length} published blog post(s) into ${path.relative(ROOT, DIST)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
