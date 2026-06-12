import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { before } from "node:test";
import { buildSite } from "../scripts/blog/build-site.mjs";
import { DIST, ROOT, SITE_URL } from "../scripts/blog/config.mjs";
import { readPosts, slugifyTag, validatePost } from "../scripts/blog/content.mjs";
import { getBlogPagePath, getTagPath } from "../scripts/blog/render.mjs";

let publishedPosts;

before(async () => {
  publishedPosts = await readPosts();
  await buildSite();
});

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(entryPath));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

function localUrlToPath(url) {
  const pathname = url.split(/[?#]/, 1)[0];
  if (pathname === "/") return path.join(DIST, "index.html");
  if (pathname.endsWith("/")) {
    return path.join(DIST, pathname.replace(/^\/+/, ""), "index.html");
  }
  return path.join(DIST, pathname.replace(/^\/+/, ""));
}

function readJsonLd(html) {
  return Array.from(html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
  ), (match) => JSON.parse(match[1]));
}

test("article validation accepts valid content and rejects invalid slugs", () => {
  const post = validatePost({
    title: "Тестовая статья",
    slug: "test-post",
    date: "2026-06-12",
    description: "Описание статьи",
    coverImage: "/sharedlink.jpg",
    coverImageAlt: "Обложка",
    sharedImage: "/sharedlink.jpg",
    sharedImageAlt: "Изображение для публикации",
    tags: ["Сайты", "Сайты"],
    blocks: [{ type: "text", body: "Текст статьи." }]
  }, "", "test.md");

  assert.equal(post.slug, "test-post");
  assert.deepEqual(post.tags, ["Сайты"]);
  assert.throws(
    () => validatePost({
      title: "Ошибка",
      slug: "Неверный slug",
      date: "2026-06-12",
      description: "Описание",
      sharedImageAlt: "Изображение"
    }, "Текст", "invalid.md"),
    /slug должен содержать только латиницу/
  );
});

test("public URL helpers remain stable", () => {
  assert.equal(getBlogPagePath(1), "/blog/");
  assert.equal(getBlogPagePath(3), "/blog/page/3/");
  assert.equal(getTagPath("sayty", 1), "/blog/tag/sayty/");
  assert.equal(getTagPath("sayty", 2), "/blog/tag/sayty/page/2/");
  assert.equal(slugifyTag("Сайты и SEO"), "sayty-i-seo");
});

test("robots and sitemap expose only public generated pages", async () => {
  const [robots, sitemap] = await Promise.all([
    fs.readFile(path.join(DIST, "robots.txt"), "utf8"),
    fs.readFile(path.join(DIST, "sitemap.xml"), "utf8")
  ]);

  assert.match(robots, /Disallow: \/admin\//);
  assert.match(robots, new RegExp(`Sitemap: ${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/sitemap\\.xml`));
  assert.doesNotMatch(sitemap, /\/admin\//);

  const urls = Array.from(sitemap.matchAll(/<loc>(.*?)<\/loc>/g), (match) => match[1]);
  assert.ok(urls.length >= 5);

  for (const absoluteUrl of urls) {
    const url = new URL(absoluteUrl);
    assert.equal(url.origin, SITE_URL);
    assert.equal(await pathExists(localUrlToPath(url.pathname)), true, `Missing page for ${absoluteUrl}`);
  }
});

test("all local HTML links and resources resolve", async () => {
  const htmlFiles = (await listFiles(DIST)).filter((file) => file.endsWith(".html"));

  for (const htmlFile of htmlFiles) {
    const html = await fs.readFile(htmlFile, "utf8");
    const references = Array.from(html.matchAll(/\b(?:href|src)="([^"]+)"/g), (match) => match[1]);

    for (const reference of references) {
      if (!reference.startsWith("/") || reference.startsWith("//")) continue;
      assert.equal(
        await pathExists(localUrlToPath(reference)),
        true,
        `${path.relative(ROOT, htmlFile)} references missing ${reference}`
      );
    }
  }
});

test("generated pages use local styles, one main landmark, and valid JSON-LD", async () => {
  assert.ok(publishedPosts.length > 0);
  const articlePath = path.join(DIST, "blog", publishedPosts[0].slug, "index.html");
  const pages = await Promise.all([
    fs.readFile(path.join(DIST, "index.html"), "utf8"),
    fs.readFile(path.join(DIST, "blog", "index.html"), "utf8"),
    fs.readFile(articlePath, "utf8"),
    fs.readFile(path.join(DIST, "cookie-policy", "index.html"), "utf8")
  ]);

  for (const html of pages) {
    assert.equal((html.match(/<main\b/g) || []).length, 1);
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
    assert.doesNotMatch(html, /<style\b/);
  }

  const [homeData] = readJsonLd(pages[0]);
  assert.deepEqual(homeData["@graph"].map((item) => item["@type"]), ["WebSite", "Person"]);

  const [blogData] = readJsonLd(pages[1]);
  assert.equal(blogData["@type"], "Blog");

  const [articleData] = readJsonLd(pages[2]);
  assert.equal(articleData["@type"], "BlogPosting");
  assert.equal(articleData.author.name, "Бондарчук Евгений Евгеньевич");
  assert.ok(articleData.headline);
  assert.ok(articleData.datePublished);
  assert.ok(articleData.image.startsWith(SITE_URL));
});

test("required local CSS, fonts, images, and scripts are published", async () => {
  const resources = [
    "assets/site/base.css",
    "assets/site/home.css",
    "assets/site/blog.css",
    "assets/site/policy.css",
    "assets/site/cookie-consent.css",
    "assets/site/home.js",
    "assets/site/cookie-consent.js",
    "assets/site/fonts/inter-tight-cyrillic.woff2",
    "assets/site/fonts/inter-tight-latin.woff2",
    "assets/site/fonts/jetbrains-mono-cyrillic.woff2",
    "assets/site/fonts/jetbrains-mono-latin.woff2",
    "assets/site/images/portrait-default-480.webp",
    "assets/site/images/kinescope-poster.webp"
  ];

  for (const resource of resources) {
    assert.equal(await pathExists(path.join(DIST, resource)), true, `Missing ${resource}`);
  }
});
