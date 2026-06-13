import { existsSync, statSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { BLOG_DIR, ROOT, SITE_URL } from "./config.mjs";

const DOWNLOAD_DIRECTORY = "/assets/downloads/";
const MAX_DOWNLOAD_SIZE = 20 * 1024 * 1024;
const DOWNLOAD_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "rtf", "odt",
  "xls", "xlsx", "ods", "csv",
  "ppt", "pptx", "odp",
  "txt", "md", "html", "htm", "json", "xml",
  "zip"
]);

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function toAbsoluteUrl(value) {
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

export function formatArticleDate(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatCardDate(date) {
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

export function slugifyTag(tag) {
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

export function getPreviewTags(tags) {
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

export function normalizeVideoEmbedUrl(provider, value, sourceFile, fieldName) {
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

function normalizeNumber(value, fallback, min, max, sourceFile, fieldName) {
  if (value === undefined || value === null || value === "") return fallback;

  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < min || normalized > max) {
    throw new Error(`${sourceFile}: ${fieldName} должен быть числом от ${min} до ${max}`);
  }

  return normalized;
}

function normalizeBorderStyle(value, sourceFile, fieldName) {
  const normalized = typeof value === "string" && value.trim() ? value.trim() : "solid";

  if (!["solid", "dashed", "dotted", "double"].includes(normalized)) {
    throw new Error(`${sourceFile}: ${fieldName} использует неизвестный стиль рамки ${normalized}`);
  }

  return normalized;
}

function normalizeBorderColor(value, sourceFile, fieldName) {
  const normalized = typeof value === "string" && value.trim() ? value.trim() : "#0D0D0D";

  if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error(`${sourceFile}: ${fieldName} должен быть HEX-цветом вида #0D0D0D`);
  }

  return normalized.toUpperCase();
}

function normalizeImageAppearance(data, sourceFile, fieldPrefix) {
  return {
    borderWidth: normalizeNumber(data.borderWidth, 1, 1, 12, sourceFile, `${fieldPrefix}.borderWidth`),
    borderStyle: normalizeBorderStyle(data.borderStyle, sourceFile, `${fieldPrefix}.borderStyle`),
    borderColor: normalizeBorderColor(data.borderColor, sourceFile, `${fieldPrefix}.borderColor`),
    borderRadius: normalizeNumber(data.borderRadius, 0, 0, 64, sourceFile, `${fieldPrefix}.borderRadius`)
  };
}

function validateDownload(downloadPath, sourceFile, fieldName) {
  const normalizedPath = requireString(downloadPath, sourceFile, fieldName);

  if (
    /^https?:\/\//i.test(normalizedPath) ||
    !normalizedPath.startsWith(DOWNLOAD_DIRECTORY) ||
    normalizedPath.includes("..") ||
    normalizedPath.includes("?") ||
    normalizedPath.includes("#")
  ) {
    throw new Error(
      `${sourceFile}: ${fieldName} должен быть локальным путём внутри ${DOWNLOAD_DIRECTORY}`
    );
  }

  const fileName = path.posix.basename(normalizedPath);
  const extension = path.posix.extname(fileName).slice(1).toLowerCase();

  if (!DOWNLOAD_EXTENSIONS.has(extension)) {
    throw new Error(`${sourceFile}: ${fieldName} использует запрещённый формат .${extension || "(без расширения)"}`);
  }

  const localPath = path.join(ROOT, normalizedPath.replace(/^\/+/, ""));
  const relative = path.relative(ROOT, localPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${sourceFile}: ${fieldName} выходит за пределы проекта`);
  }

  if (!existsSync(localPath)) {
    throw new Error(`${sourceFile}: файл для скачивания не найден: ${normalizedPath}`);
  }

  const stats = statSync(localPath);

  if (!stats.isFile()) {
    throw new Error(`${sourceFile}: ${fieldName} должен указывать на файл`);
  }

  if (stats.size > MAX_DOWNLOAD_SIZE) {
    throw new Error(`${sourceFile}: ${fieldName} превышает лимит 20 МБ`);
  }

  return {
    file: normalizedPath,
    fileName,
    fileExtension: extension.toUpperCase(),
    fileSize: stats.size
  };
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
      ...normalizeImageAppearance(block, sourceFile, blockPrefix),
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

  if (type === "download") {
    const download = validateDownload(block.file, sourceFile, `${blockPrefix}.file`);

    return {
      type,
      ...download,
      title: requireString(block.title, sourceFile, `${blockPrefix}.title`),
      description: typeof block.description === "string" ? block.description.trim() : ""
    };
  }

  throw new Error(`${sourceFile}: неизвестный тип блока ${type || "(пусто)"}`);
}

export function validatePost(frontmatter, rawBody, sourceFile) {
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
    coverAppearance: normalizeImageAppearance({
      borderWidth: frontmatter.coverBorderWidth,
      borderStyle: frontmatter.coverBorderStyle,
      borderColor: frontmatter.coverBorderColor,
      borderRadius: frontmatter.coverBorderRadius
    }, sourceFile, "coverImage"),
    sharedImage,
    sharedImageAlt: frontmatter.sharedImageAlt.trim(),
    tags,
    blocks
  };
}

export async function readPosts() {
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

export function collectTagGroups(posts) {
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
