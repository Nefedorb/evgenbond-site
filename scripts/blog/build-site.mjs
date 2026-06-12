import fs from "node:fs/promises";
import path from "node:path";
import { DIST, POSTS_PER_PAGE, ROOT, SITE_META_SUFFIX } from "./config.mjs";
import { collectTagGroups, readPosts } from "./content.mjs";
import { getTagPath, renderBlogIndex, renderPost } from "./render.mjs";
import { writeSeoFiles } from "./seo.mjs";

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
  const publicDirectories = new Set(["assets", "admin", "cookie-policy"]);

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

async function writeBlog(posts) {
  await fs.mkdir(path.join(DIST, "blog"), { recursive: true });
  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const pagePosts = posts.slice(
      (pageNumber - 1) * POSTS_PER_PAGE,
      pageNumber * POSTS_PER_PAGE
    );
    const pageHtml = renderBlogIndex(pagePosts, { currentPage: pageNumber, totalPages });
    const pageDir = pageNumber === 1
      ? path.join(DIST, "blog")
      : path.join(DIST, "blog", "page", String(pageNumber));

    await fs.mkdir(pageDir, { recursive: true });
    await fs.writeFile(path.join(pageDir, "index.html"), pageHtml, "utf8");
  }

  for (const post of posts) {
    const postDir = path.join(DIST, "blog", post.slug);
    await fs.mkdir(postDir, { recursive: true });
    await fs.writeFile(path.join(postDir, "index.html"), renderPost(post), "utf8");
  }

  for (const tagGroup of collectTagGroups(posts)) {
    const tagTotalPages = Math.max(1, Math.ceil(tagGroup.posts.length / POSTS_PER_PAGE));

    for (let pageNumber = 1; pageNumber <= tagTotalPages; pageNumber += 1) {
      const pagePosts = tagGroup.posts.slice(
        (pageNumber - 1) * POSTS_PER_PAGE,
        pageNumber * POSTS_PER_PAGE
      );
      const tagPath = getTagPath(tagGroup.slug, pageNumber);
      const pageHtml = renderBlogIndex(pagePosts, {
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

export async function buildSite() {
  await ensureCleanDist();
  await copyPublicAssets();

  const posts = await readPosts();
  await writeBlog(posts);
  await writeSeoFiles(posts);

  console.log(`Built ${posts.length} published blog post(s) into ${path.relative(ROOT, DIST)}`);
}
