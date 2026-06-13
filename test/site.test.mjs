import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import test, { after, before } from "node:test";
import { buildSite } from "../scripts/blog/build-site.mjs";
import { DIST, ROOT, SITE_URL } from "../scripts/blog/config.mjs";
import { readPosts, slugifyTag, validatePost } from "../scripts/blog/content.mjs";
import { getOptimizedImagePath } from "../scripts/blog/images.mjs";
import { getBlogPagePath, getTagPath, renderBlogIndex, renderPost } from "../scripts/blog/render.mjs";

let publishedPosts;
const DOWNLOAD_FIXTURE_DIRECTORY = path.join(ROOT, "assets", "downloads");
const DOWNLOAD_FIXTURES = [
  "manual.pdf",
  "template.docx",
  "table.xlsx",
  "slides.pptx",
  "notes.txt",
  "archive.zip"
];
const IMAGE_FIXTURE_PATH = path.join(ROOT, "assets", "blog", "sharp-fixture.png");

before(async () => {
  await fs.mkdir(DOWNLOAD_FIXTURE_DIRECTORY, { recursive: true });
  await Promise.all(DOWNLOAD_FIXTURES.map((fileName) =>
    fs.writeFile(path.join(DOWNLOAD_FIXTURE_DIRECTORY, fileName), `fixture:${fileName}`, "utf8")
  ));
  await sharp({
    create: {
      width: 64,
      height: 40,
      channels: 4,
      background: { r: 200, g: 0, b: 0, alpha: 1 }
    }
  }).png().toFile(IMAGE_FIXTURE_PATH);
  publishedPosts = await readPosts();
  await buildSite();
});

after(async () => {
  await Promise.all(DOWNLOAD_FIXTURES.map((fileName) =>
    fs.rm(path.join(DOWNLOAD_FIXTURE_DIRECTORY, fileName), { force: true })
  ));
  await fs.rm(path.join(DOWNLOAD_FIXTURE_DIRECTORY, "too-large.pdf"), { force: true });
  await fs.rm(IMAGE_FIXTURE_PATH, { force: true });
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

function getGraph(data) {
  assert.equal(data["@context"], "https://schema.org");
  assert.ok(Array.isArray(data["@graph"]));
  return data["@graph"];
}

function getEntity(graph, type) {
  const entity = graph.find((item) => item["@type"] === type);
  assert.ok(entity, `Missing ${type} entity`);
  return entity;
}

function assertGraphIntegrity(graph) {
  const ids = graph.map((entity) => entity["@id"]).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, "Structured data contains duplicate @id values");

  const references = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;

    if (Object.keys(value).length === 1 && typeof value["@id"] === "string") {
      references.push(value["@id"]);
      return;
    }

    Object.values(value).forEach(visit);
  };

  graph.forEach(visit);
  for (const reference of references) {
    assert.ok(ids.includes(reference), `Unresolved structured data reference ${reference}`);
  }
}

function assertBreadcrumb(breadcrumb, expectedNames) {
  assert.deepEqual(
    breadcrumb.itemListElement.map((item) => item.position),
    expectedNames.map((_name, index) => index + 1)
  );
  assert.deepEqual(
    breadcrumb.itemListElement.map((item) => item.name),
    expectedNames
  );
  breadcrumb.itemListElement.forEach((item) => assert.ok(item.item.startsWith(SITE_URL)));
}

function createTestPostData(blocks) {
  return {
    title: "Тестовая статья",
    slug: "test-post",
    date: "2026-06-12",
    description: "Описание тестовой статьи для проверки генератора.",
    coverImage: "/sharedlink.jpg",
    coverImageAlt: "Обложка",
    sharedImage: "/sharedlink.jpg",
    sharedImageAlt: "Изображение для публикации",
    tags: ["Сайты"],
    blocks
  };
}

test("article validation accepts valid content and rejects invalid slugs", () => {
  const post = validatePost({
    ...createTestPostData([{ type: "text", body: "Текст статьи." }]),
    tags: ["Сайты", "Сайты"]
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

test("download blocks accept common formats and render downloadable cards", () => {
  const blocks = DOWNLOAD_FIXTURES.map((fileName) => ({
    type: "download",
    file: `/assets/downloads/${fileName}`,
    title: `Скачать ${fileName}`,
    description: "Полезный файл к статье."
  }));
  const post = validatePost(createTestPostData(blocks), "", "downloads.md");
  const html = renderPost(post);

  assert.equal(post.blocks.length, DOWNLOAD_FIXTURES.length);

  for (const [index, fileName] of DOWNLOAD_FIXTURES.entries()) {
    const block = post.blocks[index];
    const extension = path.extname(fileName).slice(1).toUpperCase();

    assert.equal(block.fileName, fileName);
    assert.equal(block.fileExtension, extension);
    assert.ok(block.fileSize > 0);
    assert.match(html, new RegExp(`href="/assets/downloads/${fileName.replace(".", "\\.")}"`));
    assert.match(html, new RegExp(`download="${fileName.replace(".", "\\.")}"`));
    assert.match(html, new RegExp(`\\[ ${extension} //`));
  }

  assert.match(html, /Скачать файл/);
  assert.match(html, /Полезный файл к статье\./);
  assert.match(html, /class="article-download-icon"/);
  assert.match(html, /<svg viewBox="0 0 65 35"/);
  assert.match(html, /fill="currentColor"/);
  assert.match(html, /stroke="currentColor"/);
  assert.doesNotMatch(html, /article-download-icon[^]*?<img/);
});

test("download validation rejects unsafe, missing, and unsupported files", () => {
  const validateDownload = (file) => validatePost(createTestPostData([{
    type: "download",
    file,
    title: "Файл"
  }]), "", "invalid-download.md");

  assert.throws(() => validateDownload("https://example.com/file.pdf"), /локальным путём/);
  assert.throws(() => validateDownload("/assets/downloads/../secret.pdf"), /локальным путём/);
  assert.throws(() => validateDownload("/assets/downloads/missing.pdf"), /не найден/);

  for (const extension of ["exe", "msi", "bat", "cmd", "ps1", "js", "vbs", "docm", "xlsm", "pptm"]) {
    assert.throws(
      () => validateDownload(`/assets/downloads/unsafe.${extension}`),
      /запрещённый формат/
    );
  }
});

test("download validation rejects files larger than 20 MB", async () => {
  const oversizedPath = path.join(DOWNLOAD_FIXTURE_DIRECTORY, "too-large.pdf");
  const file = await fs.open(oversizedPath, "w");

  try {
    await file.truncate(20 * 1024 * 1024 + 1);
  } finally {
    await file.close();
  }

  try {
    assert.throws(
      () => validatePost(createTestPostData([{
        type: "download",
        file: "/assets/downloads/too-large.pdf",
        title: "Слишком большой файл"
      }]), "", "oversized-download.md"),
      /превышает лимит 20 МБ/
    );
  } finally {
    await fs.rm(oversizedPath, { force: true });
  }
});

test("Sharp creates WebP variants and article images use them with fallback", async () => {
  const publicImagePath = "/assets/blog/sharp-fixture.png";
  const optimizedPublicPath = getOptimizedImagePath(publicImagePath);
  const optimizedFilePath = localUrlToPath(optimizedPublicPath);
  const metadata = await sharp(await fs.readFile(optimizedFilePath)).metadata();
  const post = validatePost(createTestPostData([{
    type: "image",
    image: publicImagePath,
    alt: "Красный тестовый прямоугольник",
    caption: "Проверка WebP и оформления",
    showBorder: true,
    borderWidth: 4,
    borderStyle: "dashed",
    borderColor: "#c80000",
    borderRadius: 18,
    size: "normal"
  }]), "", "image-options.md");
  const html = renderPost(post);

  assert.equal(optimizedPublicPath, "/assets/blog/sharp-fixture.png.webp");
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 64);
  assert.equal(metadata.height, 40);
  assert.match(html, /<picture><source type="image\/webp" srcset="\/assets\/blog\/sharp-fixture\.png\.webp">/);
  assert.match(html, /src="\/assets\/blog\/sharp-fixture\.png"/);
  assert.match(html, /--article-image-border-width:4px/);
  assert.match(html, /--article-image-border-style:dashed/);
  assert.match(html, /--article-image-border-color:#C80000/);
  assert.match(html, /--article-image-radius:18px/);
});

test("image appearance validation rejects unsafe and out-of-range values", () => {
  const validateAppearance = (overrides) => validatePost(createTestPostData([{
    type: "image",
    image: "/assets/blog/sharp-fixture.png",
    alt: "Тест",
    ...overrides
  }]), "", "invalid-image-options.md");

  assert.throws(() => validateAppearance({ borderWidth: 0 }), /borderWidth должен быть числом от 1 до 12/);
  assert.throws(() => validateAppearance({ borderRadius: 65 }), /borderRadius должен быть числом от 0 до 64/);
  assert.throws(() => validateAppearance({ borderColor: "red" }), /HEX-цветом/);
  assert.throws(() => validateAppearance({ borderStyle: "groove" }), /неизвестный стиль рамки/);
});

test("images use the default border appearance", () => {
  const post = validatePost(createTestPostData([{
    type: "image",
    image: "/assets/blog/sharp-fixture.png",
    alt: "Тест"
  }]), "", "default-image-options.md");
  const html = renderPost(post);

  assert.equal(post.blocks[0].borderColor, "#EAEAEA");
  assert.equal(post.blocks[0].borderWidth, 3);
  assert.equal(post.blocks[0].borderRadius, 10);
  assert.equal(post.coverAppearance.borderColor, "#EAEAEA");
  assert.equal(post.coverAppearance.borderWidth, 3);
  assert.equal(post.coverAppearance.borderRadius, 10);
  assert.match(html, /--article-image-border-width:3px/);
  assert.match(html, /--article-image-border-color:#EAEAEA/);
  assert.match(html, /--article-image-radius:10px/);
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
  const firstTag = publishedPosts[0].tags[0];
  const tagPath = path.join(DIST, "blog", "tag", slugifyTag(firstTag), "index.html");
  const pages = await Promise.all([
    fs.readFile(path.join(DIST, "index.html"), "utf8"),
    fs.readFile(path.join(DIST, "blog", "index.html"), "utf8"),
    fs.readFile(tagPath, "utf8"),
    fs.readFile(articlePath, "utf8"),
    fs.readFile(path.join(DIST, "cookie-policy", "index.html"), "utf8")
  ]);

  for (const html of pages) {
    assert.equal((html.match(/<main\b/g) || []).length, 1);
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
    assert.doesNotMatch(html, /<style\b/);
  }

  const graphs = pages.map((html) => {
    const dataBlocks = readJsonLd(html);
    assert.equal(dataBlocks.length, 1);
    const graph = getGraph(dataBlocks[0]);
    assertGraphIntegrity(graph);
    return graph;
  });

  const homePerson = getEntity(graphs[0], "Person");
  assert.deepEqual(homePerson.sameAs, ["https://t.me/nefedor"]);
  assert.equal(homePerson.image, `${SITE_URL}/001.jpg`);
  assert.equal(homePerson.jobTitle, "Специалист по созданию сайтов и цифровому маркетингу");

  const blog = getEntity(graphs[1], "Blog");
  assert.equal(blog["@id"], `${SITE_URL}/blog/#blog`);
  assertBreadcrumb(getEntity(graphs[1], "BreadcrumbList"), ["Главная", "Блог"]);

  const tagPage = getEntity(graphs[2], "CollectionPage");
  assert.equal(tagPage.isPartOf["@id"], `${SITE_URL}/#website`);
  assert.equal(tagPage.about["@id"], `${SITE_URL}/blog/#blog`);
  assertBreadcrumb(getEntity(graphs[2], "BreadcrumbList"), ["Главная", "Блог", `Тег: ${firstTag}`]);

  const article = getEntity(graphs[3], "BlogPosting");
  const articlePage = getEntity(graphs[3], "WebPage");
  assert.equal(article.author["@id"], `${SITE_URL}/#person`);
  assert.equal(article.publisher["@id"], `${SITE_URL}/#person`);
  assert.equal(article.isPartOf["@id"], `${SITE_URL}/blog/#blog`);
  assert.equal(article.mainEntityOfPage["@id"], articlePage["@id"]);
  assert.equal(articlePage.mainEntity["@id"], article["@id"]);
  assert.equal(article.isAccessibleForFree, true);
  assert.deepEqual(article.articleSection, publishedPosts[0].tags);
  assert.ok(article.headline);
  assert.ok(article.datePublished);
  assert.ok(article.image.startsWith(SITE_URL));
  assertBreadcrumb(
    getEntity(graphs[3], "BreadcrumbList"),
    ["Главная", "Блог", publishedPosts[0].title]
  );

  const policyPage = getEntity(graphs[4], "WebPage");
  assert.equal(policyPage["@id"], `${SITE_URL}/cookie-policy/#webpage`);
  assertBreadcrumb(
    getEntity(graphs[4], "BreadcrumbList"),
    ["Главная", "Политика использования Cookie-файлов"]
  );
});

test("paginated blog pages use CollectionPage and page breadcrumbs", () => {
  const html = renderBlogIndex(publishedPosts, {
    currentPage: 2,
    totalPages: 2,
    pagePath: getBlogPagePath(2)
  });
  const [data] = readJsonLd(html);
  const graph = getGraph(data);

  assertGraphIntegrity(graph);
  getEntity(graph, "CollectionPage");
  assertBreadcrumb(getEntity(graph, "BreadcrumbList"), ["Главная", "Блог", "Страница 2"]);
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

  for (const fileName of DOWNLOAD_FIXTURES) {
    assert.equal(
      await pathExists(path.join(DIST, "assets", "downloads", fileName)),
      true,
      `Missing published download fixture ${fileName}`
    );
  }

  assert.equal(
    await pathExists(path.join(DIST, "assets", "blog", "sharp-fixture.png.webp")),
    true,
    "Missing generated WebP fixture"
  );
});
