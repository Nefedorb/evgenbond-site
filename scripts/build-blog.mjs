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
        .blog-shell {
            border-bottom: var(--border);
            max-width: 1260px;
        }
        .blog-page-header {
            display: grid;
            grid-template-columns: 92px minmax(0, 1fr) 180px;
            gap: 28px;
            align-items: start;
            padding: 22px 32px;
            background: var(--white);
            border-bottom: var(--border);
        }
        .blog-page-label {
            min-height: 44px;
            padding-top: 6px;
            border-right: var(--border);
            font-weight: 700;
        }
        .blog-page-summary {
            max-width: 640px;
            font-size: 0.98rem;
            line-height: 1.35;
            color: var(--black);
        }
        .blog-nav-link {
            display: inline-flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            width: 100%;
            min-height: 44px;
            padding: 0 16px;
            border: var(--border);
            color: var(--black);
            text-decoration: none;
            text-transform: uppercase;
            font-weight: 700;
            font-size: 0.92rem;
            line-height: 1;
            transition: var(--transition-fast);
        }
        .blog-nav-link:hover {
            background: var(--bg-color);
        }
        .blog-list {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
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
        .blog-card:nth-child(3n) { border-right: none; }
        .blog-card:hover {
            background: #FAFAFA;
            color: var(--black);
        }
        .blog-card-media {
            aspect-ratio: 16 / 6.2;
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
        .blog-card-body {
            display: flex;
            flex-direction: column;
            gap: 9px;
            min-height: 176px;
            padding: 14px;
        }
        .blog-card-title {
            font-size: 1.08rem;
            line-height: 1.08;
            letter-spacing: 0;
            text-transform: none;
        }
        .blog-card-body p {
            font-size: 0.9rem;
            line-height: 1.25;
        }
        .blog-card-read {
            margin-top: auto;
            padding-top: 8px;
            font-weight: 700;
            font-size: 0.88rem;
            text-transform: uppercase;
        }
        .blog-card:hover .blog-card-read {
            text-decoration: underline;
            text-underline-offset: 4px;
        }
        .blog-shell .footer-cta {
            padding: 40px 32px;
        }
        .blog-shell .footer-cta h2 {
            max-width: 760px;
            margin: 0 auto 28px;
            font-size: 2.4rem;
            line-height: 0.95;
        }
        .blog-shell .footer-cta .btn-giant {
            max-width: 520px;
            margin: 0 auto;
            padding: 26px 28px;
            font-size: 1.25rem;
        }
        .article-shell {
            padding: 0;
            border-bottom: var(--border);
            background: var(--white);
        }
        .article-hero {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 180px;
            gap: 28px;
            padding: 36px 32px;
            border-bottom: var(--border);
        }
        .article-hero-main { max-width: 900px; }
        .article-hero h1 {
            margin-top: 16px;
            font-size: 2.8rem;
            line-height: 0.95;
            letter-spacing: -0.02em;
        }
        .article-hero p {
            max-width: 760px;
            margin-top: 18px;
            color: var(--black);
        }
        .article-cover {
            padding: 32px 40px;
            border-bottom: var(--border);
            background: var(--bg-color);
        }
        .article-cover img {
            width: 100%;
            max-width: 1120px;
            aspect-ratio: 16 / 9;
            object-fit: cover;
            border: var(--border);
            display: block;
            margin: 0 auto;
        }
        .article-content {
            padding: 48px 32px 72px;
        }
        .article-block {
            max-width: 780px;
            margin-left: auto;
            margin-right: auto;
        }
        .article-block + .article-block { margin-top: 34px; }
        .article-content h2,
        .article-content h3 {
            margin: 1.6em 0 0.5em;
            letter-spacing: 0;
        }
        .article-content h2 { font-size: 2rem; line-height: 1; }
        .article-content h3 { font-size: 1.35rem; line-height: 1.1; }
        .article-content p,
        .article-content li {
            font-size: 1.08rem;
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
        .article-image-block {
            max-width: 880px;
        }
        .article-image-block.is-full {
            max-width: 1120px;
        }
        .article-image-block img {
            width: 100%;
            height: auto;
            border: var(--border);
            display: block;
        }
        .article-image-caption,
        .article-code-caption {
            margin-top: 10px;
            color: var(--gray-dark);
            font-size: 0.9rem;
        }
        .article-code-block {
            border: var(--border);
            background: var(--black);
            color: var(--white);
        }
        .article-code-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            padding: 12px 14px;
            border-bottom: 1px solid var(--gray-dark);
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.78rem;
            text-transform: uppercase;
        }
        .copy-code-button {
            border: 1px solid var(--white);
            background: transparent;
            color: var(--white);
            padding: 8px 10px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.72rem;
            text-transform: uppercase;
            cursor: pointer;
            transition: var(--transition-fast);
        }
        .copy-code-button:hover {
            background: var(--brand-red);
            border-color: var(--brand-red);
        }
        .article-code-block pre {
            margin: 0;
            padding: 18px;
            overflow-x: auto;
        }
        .article-code-block code {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.92rem;
            line-height: 1.55;
            color: var(--white);
        }
        .article-quote-block {
            padding: 28px 0 28px 28px;
            border-left: var(--border-thick);
        }
        .article-quote-block blockquote {
            font-size: 1.35rem;
            line-height: 1.35;
            font-weight: 700;
        }
        .article-quote-author {
            margin-top: 12px;
        }
        .article-divider {
            display: flex;
            align-items: center;
            gap: 14px;
            color: var(--gray-dark);
        }
        .article-divider::before,
        .article-divider::after {
            content: "";
            height: 1px;
            flex: 1;
            background: var(--black);
        }
        .article-divider span {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.78rem;
            text-transform: uppercase;
        }
        .empty-blog {
            grid-column: 1 / -1;
            padding: 48px 40px;
            border-bottom: var(--border);
        }
        @media (max-width: 1024px) {
            .blog-page-header,
            .article-hero {
                grid-template-columns: 1fr;
                gap: 16px;
            }
            .blog-page-label {
                min-height: auto;
                border-right: none;
            }
            .blog-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .blog-card:nth-child(3n) { border-right: var(--border); }
            .blog-card:nth-child(even) { border-right: none; }
        }
        @media (max-width: 768px) {
            .blog-page-header,
            .article-hero,
            .article-cover {
                padding: 22px;
            }
            .blog-nav-link { max-width: 100%; }
            .blog-list { grid-template-columns: 1fr; }
            .blog-card,
            .blog-card:nth-child(3n),
            .blog-card:nth-child(even) { border-right: none; }
            .blog-card-body { min-height: 0; }
            .article-hero h1 { font-size: 2.25rem; }
            .article-content { padding: 36px 22px 56px; }
            .blog-shell .footer-cta {
                padding: 36px 22px;
            }
            .blog-shell .footer-cta h2 {
                font-size: 2rem;
            }
            .blog-shell .footer-cta .btn-giant {
                padding: 22px 18px;
                font-size: 1.05rem;
            }
            .article-code-toolbar {
                align-items: flex-start;
                flex-direction: column;
            }
        }
`;

const ALLOWED_TAGS = sanitizeHtml.defaults.allowedTags.concat([
  "img",
  "h1",
  "h2",
  "h3",
  "pre",
  "code",
  "blockquote",
  "figure",
  "figcaption"
]);

const ALLOWED_ATTRIBUTES = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: ["href", "name", "target", "rel", "title"],
  img: ["src", "alt", "title", "loading", "width", "height"],
  code: ["class"]
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

function validateImage(imagePath, sourceFile, fieldName = "image") {
  if (typeof imagePath !== "string" || imagePath.trim() === "") {
    throw new Error(`${sourceFile}: ${fieldName} обязателен`);
  }

  const normalizedImagePath = imagePath.trim();

  if (/^https?:\/\//i.test(normalizedImagePath)) {
    return normalizedImagePath;
  }

  if (!normalizedImagePath.startsWith("/") || normalizedImagePath.includes("..")) {
    throw new Error(`${sourceFile}: ${fieldName} должен быть абсолютным публичным путём, например /assets/blog/cover.jpg`);
  }

  const localPath = path.join(ROOT, normalizedImagePath.replace(/^\/+/, ""));
  const relative = path.relative(ROOT, localPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${sourceFile}: ${fieldName} выходит за пределы проекта`);
  }

  if (!existsSync(localPath)) {
    throw new Error(`${sourceFile}: файл ${fieldName} не найден: ${normalizedImagePath}`);
  }

  return normalizedImagePath;
}

function requireString(value, sourceFile, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${sourceFile}: поле ${fieldName} обязательно`);
  }

  return value.trim();
}

function normalizeBlockType(block) {
  return String(block?.type || block?._block || "").trim();
}

function normalizeBlocks(blocks, rawBody, sourceFile) {
  if (Array.isArray(blocks) && blocks.length > 0) {
    return blocks.map((block, index) => validateBlock(block, sourceFile, index));
  }

  const fallbackBody = String(rawBody || "").trim();

  if (fallbackBody) {
    return [{ type: "text", body: fallbackBody }];
  }

  throw new Error(`${sourceFile}: добавьте blocks или тело статьи`);
}

function validateBlock(block, sourceFile, index) {
  if (!block || typeof block !== "object") {
    throw new Error(`${sourceFile}: blocks[${index}] должен быть объектом`);
  }

  const type = normalizeBlockType(block);
  const blockPrefix = `blocks[${index}]`;

  if (type === "text") {
    return {
      type,
      body: requireString(block.body, sourceFile, `${blockPrefix}.body`)
    };
  }

  if (type === "image") {
    const size = block.size === "full" ? "full" : "normal";

    return {
      type,
      image: validateImage(block.image, sourceFile, `${blockPrefix}.image`),
      alt: requireString(block.alt, sourceFile, `${blockPrefix}.alt`),
      caption: typeof block.caption === "string" ? block.caption.trim() : "",
      size
    };
  }

  if (type === "code") {
    return {
      type,
      language: typeof block.language === "string" ? block.language.trim() : "",
      caption: typeof block.caption === "string" ? block.caption.trim() : "",
      code: requireString(block.code, sourceFile, `${blockPrefix}.code`)
    };
  }

  if (type === "quote") {
    return {
      type,
      text: requireString(block.text, sourceFile, `${blockPrefix}.text`),
      author: typeof block.author === "string" ? block.author.trim() : ""
    };
  }

  if (type === "divider") {
    return {
      type,
      label: typeof block.label === "string" ? block.label.trim() : ""
    };
  }

  throw new Error(`${sourceFile}: неизвестный тип блока ${type || "(пусто)"}`);
}

function validatePost(frontmatter, rawBody, sourceFile) {
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
  const sharedImage = validateImage(frontmatter.sharedImage, sourceFile, "sharedImage");
  const coverImage = validateImage(frontmatter.coverImage || frontmatter.sharedImage, sourceFile, "coverImage");
  const coverImageAlt = typeof frontmatter.coverImageAlt === "string" && frontmatter.coverImageAlt.trim()
    ? frontmatter.coverImageAlt.trim()
    : frontmatter.sharedImageAlt.trim();
  const blocks = normalizeBlocks(frontmatter.blocks, rawBody, sourceFile);
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
    coverImage,
    coverImageAlt,
    showCoverInArticle: frontmatter.showCoverInArticle !== false,
    sharedImage,
    sharedImageAlt: frontmatter.sharedImageAlt.trim(),
    tags,
    blocks
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

function sanitizeArticleHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
      img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }, true)
    }
  });
}

function renderCodeBlock(code, language = "", caption = "", isEscaped = false) {
  const labelParts = [language, caption].filter(Boolean);
  const label = labelParts.length ? labelParts.join(" // ") : "Код";
  const safeCode = isEscaped ? code : escapeHtml(code);

  return `
                <div class="article-block article-code-block">
                    <div class="article-code-toolbar">
                        <span>${escapeHtml(label)}</span>
                        <button class="copy-code-button" type="button">Копировать</button>
                    </div>
                    <pre><code>${safeCode}</code></pre>
                </div>`;
}

function enhanceCodeBlocks(html) {
  return html.replace(/<pre><code(?: class="language-([^"]+)")?>([\s\S]*?)<\/code><\/pre>/g, (_match, language, code) =>
    renderCodeBlock(code, language || "", "", true).trim()
  );
}

function renderMarkdownBlock(markdown) {
  const renderedMarkdown = marked.parse(markdown);
  return enhanceCodeBlocks(sanitizeArticleHtml(renderedMarkdown));
}

function renderImageBlock(block) {
  const caption = block.caption
    ? `<figcaption class="article-image-caption mono-text">${escapeHtml(block.caption)}</figcaption>`
    : "";

  return `
                <figure class="article-block article-image-block${block.size === "full" ? " is-full" : ""}">
                    <img src="${escapeHtml(block.image)}" alt="${escapeHtml(block.alt)}" loading="lazy">
                    ${caption}
                </figure>`;
}

function renderQuoteBlock(block) {
  const author = block.author
    ? `<div class="article-quote-author mono-text">${escapeHtml(block.author)}</div>`
    : "";

  return `
                <div class="article-block article-quote-block">
                    <blockquote>${escapeHtml(block.text)}</blockquote>
                    ${author}
                </div>`;
}

function renderDividerBlock(block) {
  return `
                <div class="article-block article-divider">
                    <span>${escapeHtml(block.label || "Раздел")}</span>
                </div>`;
}

function renderArticleBlocks(blocks) {
  return blocks.map((block) => {
    if (block.type === "text") {
      return `
                <div class="article-block article-text-block">
${renderMarkdownBlock(block.body)}
                </div>`;
    }

    if (block.type === "image") return renderImageBlock(block);
    if (block.type === "code") return renderCodeBlock(block.code, block.language, block.caption);
    if (block.type === "quote") return renderQuoteBlock(block);
    if (block.type === "divider") return renderDividerBlock(block);

    return "";
  }).join("");
}

function renderCopyCodeScript() {
  return `
    <script>
      document.addEventListener("click", async (event) => {
        const button = event.target.closest(".copy-code-button");
        if (!button) return;

        const code = button.closest(".article-code-block")?.querySelector("code")?.textContent || "";
        const originalText = button.textContent;

        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(code);
          } else {
            const textarea = document.createElement("textarea");
            textarea.value = code;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            textarea.remove();
          }

          button.textContent = "Скопировано";
        } catch {
          button.textContent = "Не скопировано";
        }

        window.setTimeout(() => {
          button.textContent = originalText;
        }, 1600);
      });
    </script>`;
}

function renderBlogIndex(posts, style) {
  const cards = posts.length
    ? posts.map((post) => `
                <a class="blog-card" href="/blog/${escapeHtml(post.slug)}/">
                    <div class="blog-card-media">
                        <img src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.coverImageAlt)}" loading="lazy">
                    </div>
                    <div class="blog-card-body">
                        <div class="mono-text">${post.tags.length ? `${escapeHtml(post.tags[0])} · ` : ""}${escapeHtml(formatDate(post.date))}</div>
                        <h2 class="blog-card-title">${escapeHtml(post.title)}</h2>
                        <p>${escapeHtml(post.description)}</p>
                        <div class="blog-card-read">Читать →</div>
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
        <section class="blog-page-header">
            <div class="mono-text blog-page-label">Блог</div>
            <p class="blog-page-summary">${escapeHtml(SITE_DESCRIPTION)}</p>
            <a href="/" class="blog-nav-link">
                <span>На главную</span>
                <span>←</span>
            </a>
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
  const content = renderArticleBlocks(post.blocks);
  const cover = post.showCoverInArticle
    ? `
            <div class="article-cover">
                <img src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.coverImageAlt)}">
            </div>`
    : "";

  const body = `
    <div class="master-grid blog-shell">
        <article class="article-shell">
            <header class="article-hero">
                <div class="article-hero-main">
                    <div class="mono-text">${escapeHtml(formatDate(post.date))}${post.tags.length ? ` · ${escapeHtml(post.tags.join(" / "))}` : ""}</div>
                    <h1>${escapeHtml(post.title)}</h1>
                    <p>${escapeHtml(post.description)}</p>
                </div>
                <a href="/blog/" class="blog-nav-link">
                    <span>Все статьи</span>
                    <span>←</span>
                </a>
            </header>
            ${cover}
            <div class="article-content">
${content}
            </div>
        </article>
        <section class="footer-cta">
            <div class="mono-text" style="color: var(--gray-light); margin-bottom: 20px;">[ ТЕРМИНАЛ СВЯЗИ ]</div>
            <h2>НУЖЕН САЙТ С ТАКОЙ ЖЕ СИСТЕМОЙ?</h2>
            <a href="https://t.me/nefedor" class="btn-giant" target="_blank" rel="noopener noreferrer">НАПИСАТЬ В&nbsp;TELEGRAM</a>
        </section>
    </div>
${renderCopyCodeScript()}`;

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
    const rawBody = parsed.content.trim();
    const post = validatePost(parsed.data, rawBody, file);

    if (slugs.has(post.slug)) {
      throw new Error(`${file}: slug не уникален: ${post.slug}`);
    }

    slugs.add(post.slug);

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
