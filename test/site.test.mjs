import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { before } from "node:test";
import { buildSite } from "../scripts/blog/build-site.mjs";
import { DIST, ROOT, SITE_URL } from "../scripts/blog/config.mjs";
import { readPosts, slugifyTag, validatePost } from "../scripts/blog/content.mjs";
import { getBlogPagePath, getTagPath, renderBlogIndex } from "../scripts/blog/render.mjs";

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
});
