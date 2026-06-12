import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(moduleDirectory, "..", "..");
export const DIST = path.join(ROOT, "_site");
export const BLOG_DIR = path.join(ROOT, "content", "blog");
export const SITE_URL = (process.env.SITE_URL || "https://evgenbond.ru").replace(/\/$/, "");
export const SITE_TITLE = "Создание сайтов и цифровые услуги для малого и среднего бизнеса";
export const SITE_META_SUFFIX = "evgenbond.ru";
export const SITE_DESCRIPTION = "Практика, заметки и разборы о сайтах, маркетинге, контенте и цифровых системах для бизнеса.";
export const POSTS_PER_PAGE = 6;
export const AUTHOR_NAME = "Бондарчук Евгений Евгеньевич";
