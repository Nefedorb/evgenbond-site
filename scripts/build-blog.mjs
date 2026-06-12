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
const SITE_META_SUFFIX = "evgenbond.ru";
const SITE_DESCRIPTION = "Практика, заметки и разборы о сайтах, маркетинге, контенте и цифровых системах для бизнеса.";
const POSTS_PER_PAGE = 6;

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
            height: 44px;
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
            background: var(--brand-red);
            border-color: var(--brand-red);
            color: var(--white);
        }

        .blog-nav-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 15px;
            flex: 0 0 auto;
        }

        .blog-nav-icon img {
            display: block;
            width: 100%;
            height: 100%;
            transform: scaleX(-1);
            transition: var(--transition-fast);
        }

        .blog-nav-link:hover .blog-nav-icon img {
            filter: invert(1);
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
            background: var(--white);
            transition: var(--transition-fast);
        }
        .blog-card:nth-child(3n) { border-right: none; }
        .blog-card:nth-last-child(n+4) { border-bottom: var(--border); }
        .blog-card:hover {
            background: #FAFAFA;
            color: var(--black);
        }
        .blog-card a {
            color: var(--black);
            text-decoration: none;
        }
        .blog-card-media {
            display: block;
            padding: 10px 10px 0;
            overflow: hidden;
            background: var(--white);
        }
        .blog-card-media img {
            width: 100%;
            aspect-ratio: 40 / 21;
            height: 100%;
            object-fit: contain;
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
        .blog-card-title a:hover {
            text-decoration: underline;
            text-underline-offset: 4px;
        }
        .blog-card-body p {
            font-size: 0.9rem;
            line-height: 1.25;
        }
        .blog-card-meta,
        .article-meta {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px 8px;
        }
        .blog-tags,
        .article-tags {
            display: inline-flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
        }
        .blog-tag {
            color: var(--black);
            text-decoration: none;
            text-transform: uppercase;
        }
        .blog-tag:hover {
            color: var(--brand-red);
            text-decoration: underline;
            text-underline-offset: 3px;
        }
        .blog-tag-separator {
            color: var(--gray-dark);
        }
        .blog-meta-dot {
            color: var(--gray-dark);
        }
        .blog-card-read {
            margin-top: auto;
            padding-top: 8px;
            font-weight: 700;
            font-size: 0.88rem;
            text-transform: uppercase;
        }
        .blog-card-read:hover {
            text-decoration: underline;
            text-underline-offset: 4px;
        }
        .blog-pagination {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 18px;
            padding: 18px 24px;
            border-bottom: var(--border);
            background: var(--white);
        }
        .blog-pagination a,
        .blog-pagination span {
            color: var(--black);
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.82rem;
            line-height: 1;
            text-decoration: none;
            text-transform: uppercase;
        }
        .blog-pagination a {
            padding: 7px 8px;
            transition: var(--transition-fast);
        }
        .blog-pagination a:hover {
            background: var(--bg-color);
        }
        .blog-pagination .is-current {
            padding: 7px 9px;
            background: var(--black);
            color: var(--white);
        }
        .blog-pagination-next {
            font-weight: 700;
        }
        .blog-shell .footer-cta {
            padding: 40px 32px;
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
        .article-hero .blog-nav-link {
            align-self: start;
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
            height: auto;
            border: var(--border);
            display: block;
            margin: 0 auto;
        }
        .article-cover.has-no-border img {
            border: 0;
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
        .article-image-block.has-no-border img {
            border: 0;
        }
        .article-cover img,
        .article-image-block img,
        .article-text-block img {
            cursor: zoom-in;
        }
        .article-cover img:focus-visible,
        .article-image-block img:focus-visible,
        .article-text-block img:focus-visible {
            outline: 3px solid var(--brand-red);
            outline-offset: 4px;
        }
        .image-lightbox {
            width: 100vw;
            max-width: none;
            height: 100vh;
            max-height: none;
            margin: 0;
            padding: 56px 24px 24px;
            border: 0;
            background: rgba(13, 13, 13, 0.96);
            color: var(--white);
            overflow: hidden;
        }
        .image-lightbox::backdrop {
            background: rgba(13, 13, 13, 0.96);
        }
        .image-lightbox[open] {
            display: grid;
            place-items: center;
        }
        .image-lightbox img {
            display: block;
            width: auto;
            max-width: 100%;
            height: auto;
            max-height: calc(100vh - 80px);
            object-fit: contain;
        }
        .image-lightbox-close {
            position: fixed;
            top: 16px;
            right: 16px;
            width: 40px;
            height: 40px;
            border: 1px solid var(--white);
            background: var(--black);
            color: var(--white);
            font-family: 'JetBrains Mono', monospace;
            font-size: 1.4rem;
            line-height: 1;
            cursor: pointer;
            transition: var(--transition-fast);
        }
        .image-lightbox-close:hover,
        .image-lightbox-close:focus-visible {
            border-color: var(--brand-red);
            background: var(--brand-red);
            outline: none;
        }
        .article-video-block {
            max-width: 880px;
        }
        .article-video-block.is-full {
            max-width: 1120px;
        }
        .article-video-frame {
            width: 100%;
            aspect-ratio: 16 / 9;
            border: 1px solid #D8D8D8;
            border-radius: 10px;
            background: var(--white);
            display: block;
            overflow: hidden;
        }
        .article-video-frame iframe {
            width: calc(100% + 2px);
            height: calc(100% + 2px);
            margin: -1px;
            border: 0;
            display: block;
        }
        .article-image-caption,
        .article-video-caption,
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
        .empty-blog-kicker {
            margin-bottom: 20px;
        }
        .empty-blog-copy {
            margin-top: 20px;
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
            .blog-card:nth-last-child(n+4) { border-bottom: none; }
            .blog-card:nth-last-child(n+3) { border-bottom: var(--border); }
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
            .blog-card:nth-last-child(n+3) { border-bottom: none; }
            .blog-card:nth-last-child(n+2) { border-bottom: var(--border); }
            .blog-card-body { min-height: 0; }
            .article-hero h1 { font-size: 2.25rem; }
            .article-content { padding: 36px 22px 56px; }
            .blog-shell .footer-cta {
                padding: 36px 22px;
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

function formatArticleDate(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatCardDate(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

const CYRILLIC_TO_LATIN = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya"
};

function slugifyTag(tag) {
  const transliterated = String(tag)
    .trim()
    .toLowerCase()
    .split("")
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join("");

  return transliterated
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "tag";
}

function getPreviewTags(tags) {
  const result = [];
  let characters = 0;

  for (const tag of tags) {
    const tagLength = tag.length;

    if (result.length >= 3) break;
    if (result.length > 0 && characters + tagLength > 26) break;

    result.push(tag);
    characters += tagLength;
  }

  return result;
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

function parseVideoUrl(value, sourceFile, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${sourceFile}: ${fieldName} обязателен`);
  }

  const normalizedUrl = value.trim();

  if (/[<>]/.test(normalizedUrl)) {
    throw new Error(`${sourceFile}: ${fieldName} должен быть ссылкой, а не iframe-кодом`);
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new Error(`${sourceFile}: ${fieldName} должен быть корректным URL`);
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error(`${sourceFile}: ${fieldName} должен начинаться с https://`);
  }

  return parsedUrl;
}

function normalizeYouTubeEmbedUrl(value, sourceFile, fieldName) {
  const url = parseVideoUrl(value, sourceFile, fieldName);
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  let videoId = "";

  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] || "";
  } else if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "m.youtube.com") {
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v") || "";
    } else if (pathParts[0] === "embed" || pathParts[0] === "shorts") {
      videoId = pathParts[1] || "";
    }
  }

  if (!/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) {
    throw new Error(`${sourceFile}: ${fieldName} должен быть ссылкой на YouTube video/watch/shorts/embed`);
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

function normalizeKinescopeEmbedUrl(value, sourceFile, fieldName) {
  const url = parseVideoUrl(value, sourceFile, fieldName);
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const pathParts = url.pathname.split("/").filter(Boolean);

  if (host === "player.kinescope.io") {
    return url.toString();
  }

  if (host !== "kinescope.io") {
    throw new Error(`${sourceFile}: ${fieldName} должен быть ссылкой на kinescope.io или player.kinescope.io`);
  }

  const videoId = pathParts[0] === "embed" ? pathParts[1] : pathParts[0];

  if (!videoId || !/^[a-zA-Z0-9_-]+$/.test(videoId)) {
    throw new Error(`${sourceFile}: ${fieldName} должен быть ссылкой на Kinescope video/embed`);
  }

  return `https://kinescope.io/embed/${videoId}`;
}

function normalizeCustomEmbedUrl(value, sourceFile, fieldName) {
  return parseVideoUrl(value, sourceFile, fieldName).toString();
}

function normalizeVideoEmbedUrl(provider, value, sourceFile, fieldName) {
  if (provider === "youtube") return normalizeYouTubeEmbedUrl(value, sourceFile, fieldName);
  if (provider === "kinescope") return normalizeKinescopeEmbedUrl(value, sourceFile, fieldName);
  if (provider === "custom") return normalizeCustomEmbedUrl(value, sourceFile, fieldName);

  throw new Error(`${sourceFile}: ${fieldName} использует неизвестную платформу видео ${provider}`);
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
      showBorder: block.showBorder !== false,
      size
    };
  }

  if (type === "video") {
    const provider = typeof block.provider === "string" && block.provider.trim()
      ? block.provider.trim()
      : "youtube";

    if (!["youtube", "kinescope", "custom"].includes(provider)) {
      throw new Error(`${sourceFile}: ${blockPrefix}.provider использует неизвестную платформу видео ${provider}`);
    }

    const size = block.size === "full" ? "full" : "normal";
    const url = normalizeVideoEmbedUrl(provider, block.url, sourceFile, `${blockPrefix}.url`);

    return {
      type,
      provider,
      url,
      title: requireString(block.title, sourceFile, `${blockPrefix}.title`),
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
  const tags = [];
  const tagSlugs = new Set();

  if (Array.isArray(frontmatter.tags)) {
    for (const tag of frontmatter.tags) {
      const normalizedTag = String(tag || "").trim();
      if (!normalizedTag) continue;

      const tagSlug = slugifyTag(normalizedTag);
      if (tagSlugs.has(tagSlug)) continue;

      tagSlugs.add(tagSlug);
      tags.push(normalizedTag);
    }
  }

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
    showCoverBorder: frontmatter.showCoverBorder !== false,
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
    <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@200;400;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">`;
}

function renderPage({ head, style, body }) {
  const html = `<!DOCTYPE html>
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

  return html.replace(/[ \t]+$/gm, "");
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
  const classes = [
    "article-block",
    "article-image-block",
    block.size === "full" ? "is-full" : "",
    block.showBorder === false ? "has-no-border" : ""
  ].filter(Boolean).join(" ");

  return `
                <figure class="${classes}">
                    <img src="${escapeHtml(block.image)}" alt="${escapeHtml(block.alt)}" loading="lazy">
                    ${caption}
                </figure>`;
}

function renderVideoBlock(block) {
  const caption = block.caption
    ? `<figcaption class="article-video-caption mono-text">${escapeHtml(block.caption)}</figcaption>`
    : "";

  return `
                <figure class="article-block article-video-block${block.size === "full" ? " is-full" : ""}">
                    <div class="article-video-frame">
                        <iframe src="${escapeHtml(block.url)}" title="${escapeHtml(block.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
                    </div>
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
    if (block.type === "video") return renderVideoBlock(block);
    if (block.type === "code") return renderCodeBlock(block.code, block.language, block.caption);
    if (block.type === "quote") return renderQuoteBlock(block);
    if (block.type === "divider") return renderDividerBlock(block);

    return "";
  }).join("");
}

function renderArticleInteractionScript() {
  return `
    <script>
      const zoomableImages = document.querySelectorAll(
        ".article-cover img, .article-image-block img, .article-text-block img"
      );
      const lightbox = document.createElement("dialog");
      const lightboxImage = document.createElement("img");
      const closeButton = document.createElement("button");

      lightbox.className = "image-lightbox";
      lightbox.setAttribute("aria-label", "Полноэкранный просмотр изображения");
      closeButton.className = "image-lightbox-close";
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", "Закрыть изображение");
      closeButton.textContent = "×";
      lightbox.append(lightboxImage, closeButton);
      document.body.appendChild(lightbox);

      const openLightbox = (image) => {
        lightboxImage.src = image.currentSrc || image.src;
        lightboxImage.alt = image.alt || "";
        lightbox.showModal();
      };

      zoomableImages.forEach((image) => {
        image.tabIndex = 0;
        image.setAttribute("role", "button");
        image.setAttribute("aria-label", image.alt
          ? "Открыть изображение на весь экран: " + image.alt
          : "Открыть изображение на весь экран");

        image.addEventListener("click", () => openLightbox(image));
        image.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          openLightbox(image);
        });
      });

      closeButton.addEventListener("click", () => lightbox.close());
      lightbox.addEventListener("click", (event) => {
        if (event.target === lightbox) lightbox.close();
      });
      lightbox.addEventListener("close", () => {
        lightboxImage.removeAttribute("src");
        lightboxImage.alt = "";
      });

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

function getTagPath(tagSlug, pageNumber = 1) {
  return pageNumber === 1
    ? `/blog/tag/${tagSlug}/`
    : `/blog/tag/${tagSlug}/page/${pageNumber}/`;
}

function getBlogPagePath(pageNumber) {
  return pageNumber === 1 ? "/blog/" : `/blog/page/${pageNumber}/`;
}

function renderTagLinks(tags, { preview = false } = {}) {
  const visibleTags = preview ? getPreviewTags(tags) : tags;

  if (!visibleTags.length) return "";

  return `
                            <span class="blog-tags">
${visibleTags.map((tag) => {
    const tagSlug = slugifyTag(tag);
    return `                                <a class="blog-tag" href="${escapeHtml(getTagPath(tagSlug))}">${escapeHtml(tag)}</a>`;
  }).join(`\n                                <span class="blog-tag-separator" aria-hidden="true">·</span>\n`)}
                            </span>`;
}

function renderCardMeta(post) {
  const tags = renderTagLinks(post.tags, { preview: true });
  const divider = tags ? `<span class="blog-meta-dot">·</span>` : "";

  return `
                        <div class="mono-text blog-card-meta">
${tags}
                            ${divider}
                            <time datetime="${escapeHtml(post.dateIso)}">${escapeHtml(formatCardDate(post.date))}</time>
                        </div>`;
}

function renderArticleMeta(post) {
  const tags = renderTagLinks(post.tags);
  const divider = tags ? `<span class="blog-meta-dot">·</span>` : "";

  return `
                    <div class="mono-text article-meta">
                        <time datetime="${escapeHtml(post.dateIso)}">${escapeHtml(formatArticleDate(post.date))}</time>
                        ${divider}
${tags}
                    </div>`;
}

function renderPagination(currentPage, totalPages, getPagePath = getBlogPagePath) {
  if (totalPages <= 1) return "";

  const pageLinks = Array.from({ length: totalPages }, (_value, index) => {
    const pageNumber = index + 1;

    if (pageNumber === currentPage) {
      return `<span class="is-current">${pageNumber}</span>`;
    }

    return `<a href="${escapeHtml(getPagePath(pageNumber))}">${pageNumber}</a>`;
  }).join("");

  const nextLink = currentPage < totalPages
    ? `<a class="blog-pagination-next" href="${escapeHtml(getPagePath(currentPage + 1))}">Далее →</a>`
    : `<span class="blog-pagination-next">Далее →</span>`;

  return `
        <nav class="blog-pagination" aria-label="Страницы блога">
            ${pageLinks}
            ${nextLink}
        </nav>`;
}

function renderBlogIndex(posts, style, {
  currentPage = 1,
  totalPages = 1,
  pagePath = getBlogPagePath(currentPage),
  getPagePath = getBlogPagePath,
  pageTitle = currentPage === 1 ? `Блог — ${SITE_META_SUFFIX}` : `Блог, страница ${currentPage} — ${SITE_META_SUFFIX}`,
  pageDescription = SITE_DESCRIPTION,
  headerLabel = "Блог",
  headerSummary = SITE_DESCRIPTION
} = {}) {
  const cards = posts.length
    ? posts.map((post) => `
                <article class="blog-card">
                    <a class="blog-card-media" href="/blog/${escapeHtml(post.slug)}/" aria-label="${escapeHtml(post.title)}">
                        <img src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.coverImageAlt)}" loading="lazy">
                    </a>
                    <div class="blog-card-body">
${renderCardMeta(post)}
                        <h2 class="blog-card-title"><a href="/blog/${escapeHtml(post.slug)}/">${escapeHtml(post.title)}</a></h2>
                        <p>${escapeHtml(post.description)}</p>
                        <a class="blog-card-read" href="/blog/${escapeHtml(post.slug)}/">Читать →</a>
                    </div>
                </article>`).join("")
    : `
                <div class="empty-blog">
                    <div class="mono-text empty-blog-kicker">[ CONTENT PIPELINE // EMPTY ]</div>
                    <h2>МАТЕРИАЛЫ СКОРО ПОЯВЯТСЯ</h2>
                    <p class="empty-blog-copy">Админка уже готова принимать статьи, картинки и SEO-описания.</p>
                </div>`;

  const body = `
    <div class="master-grid blog-shell">
        <section class="blog-page-header">
            <div class="mono-text blog-page-label">${escapeHtml(headerLabel)}</div>
            <p class="blog-page-summary">${escapeHtml(headerSummary)}</p>
            <a href="/" class="blog-nav-link">
                <span>На главную</span>
                <span class="blog-nav-icon" aria-hidden="true"><img src="/arrow.svg" alt=""></span>
            </a>
        </section>
        <section class="blog-list">
${cards}
        </section>
${renderPagination(currentPage, totalPages, getPagePath)}
        <section class="footer-cta">
            <div class="mono-text footer-cta-label">[ ТЕРМИНАЛ СВЯЗИ ]</div>
            <a href="https://t.me/nefedor" class="btn-giant" target="_blank" rel="noopener noreferrer">НАПИСАТЬ В&nbsp;TELEGRAM</a>
        </section>
    </div>`;

  return renderPage({
    head: renderHead({
      title: pageTitle,
      description: pageDescription,
      path: pagePath,
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
            <div class="article-cover${post.showCoverBorder ? "" : " has-no-border"}">
                <img src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.coverImageAlt)}">
            </div>`
    : "";

  const body = `
    <div class="master-grid blog-shell">
        <article class="article-shell">
            <header class="article-hero">
                <div class="article-hero-main">
${renderArticleMeta(post)}
                    <h1>${escapeHtml(post.title)}</h1>
                    <p>${escapeHtml(post.description)}</p>
                </div>
                <a href="/blog/" class="blog-nav-link">
                    <span>Все статьи</span>
                    <span class="blog-nav-icon" aria-hidden="true"><img src="/arrow.svg" alt=""></span>
                </a>
            </header>
            ${cover}
            <div class="article-content">
${content}
            </div>
        </article>
        <section class="footer-cta">
            <div class="mono-text footer-cta-label">[ ТЕРМИНАЛ СВЯЗИ ]</div>
            <a href="https://t.me/nefedor" class="btn-giant" target="_blank" rel="noopener noreferrer">НАПИСАТЬ В&nbsp;TELEGRAM</a>
        </section>
    </div>
${renderArticleInteractionScript()}`;

  return renderPage({
    head: renderHead({
      title: `${post.title} — ${SITE_META_SUFFIX}`,
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

function collectTagGroups(posts) {
  const groups = new Map();

  for (const post of posts) {
    for (const tag of post.tags) {
      const tagSlug = slugifyTag(tag);

      if (!groups.has(tagSlug)) {
        groups.set(tagSlug, {
          slug: tagSlug,
          title: tag,
          posts: []
        });
      }

      groups.get(tagSlug).posts.push(post);
    }
  }

  return Array.from(groups.values()).sort((a, b) => a.title.localeCompare(b.title, "ru"));
}

async function writeBlog(posts, style) {
  await fs.mkdir(path.join(DIST, "blog"), { recursive: true });
  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const pagePosts = posts.slice(
      (pageNumber - 1) * POSTS_PER_PAGE,
      pageNumber * POSTS_PER_PAGE
    );
    const pageHtml = renderBlogIndex(pagePosts, style, { currentPage: pageNumber, totalPages });
    const pageDir = pageNumber === 1
      ? path.join(DIST, "blog")
      : path.join(DIST, "blog", "page", String(pageNumber));

    await fs.mkdir(pageDir, { recursive: true });
    await fs.writeFile(path.join(pageDir, "index.html"), pageHtml, "utf8");
  }

  for (const post of posts) {
    const postDir = path.join(DIST, "blog", post.slug);
    await fs.mkdir(postDir, { recursive: true });
    await fs.writeFile(path.join(postDir, "index.html"), renderPost(post, style), "utf8");
  }

  for (const tagGroup of collectTagGroups(posts)) {
    const tagTotalPages = Math.max(1, Math.ceil(tagGroup.posts.length / POSTS_PER_PAGE));

    for (let pageNumber = 1; pageNumber <= tagTotalPages; pageNumber += 1) {
      const pagePosts = tagGroup.posts.slice(
        (pageNumber - 1) * POSTS_PER_PAGE,
        pageNumber * POSTS_PER_PAGE
      );
      const tagPath = getTagPath(tagGroup.slug, pageNumber);
      const pageHtml = renderBlogIndex(pagePosts, style, {
        currentPage: pageNumber,
        totalPages: tagTotalPages,
        pagePath: tagPath,
        getPagePath: (targetPage) => getTagPath(tagGroup.slug, targetPage),
        pageTitle: pageNumber === 1
          ? `Тег: ${tagGroup.title} — ${SITE_META_SUFFIX}`
          : `Тег: ${tagGroup.title}, страница ${pageNumber} — ${SITE_META_SUFFIX}`,
        pageDescription: `Все статьи с тегом «${tagGroup.title}».`,
        headerLabel: "Тег",
        headerSummary: `Все статьи с тегом «${tagGroup.title}».`
      });
      const pageDir = pageNumber === 1
        ? path.join(DIST, "blog", "tag", tagGroup.slug)
        : path.join(DIST, "blog", "tag", tagGroup.slug, "page", String(pageNumber));

      await fs.mkdir(pageDir, { recursive: true });
      await fs.writeFile(path.join(pageDir, "index.html"), pageHtml, "utf8");
    }
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
