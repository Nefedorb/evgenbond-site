import fs from "node:fs/promises";
import path from "node:path";
import { DIST, POSTS_PER_PAGE, SITE_URL } from "./config.mjs";
import { collectTagGroups, toAbsoluteUrl } from "./content.mjs";
import { getBlogPagePath, getTagPath } from "./render.mjs";

function renderSitemapEntry(pagePath, lastmod = "") {
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <url>
    <loc>${toAbsoluteUrl(pagePath)}</loc>${lastmodTag}
  </url>`;
}

export async function writeSeoFiles(posts) {
  const newestPostDate = posts[0]?.dateIso.slice(0, 10) || "";
  const sitemapEntries = [
    renderSitemapEntry("/"),
    renderSitemapEntry("/cookie-policy/"),
    renderSitemapEntry("/blog/", newestPostDate)
  ];
  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));

  for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
    const pagePosts = posts.slice(
      (pageNumber - 1) * POSTS_PER_PAGE,
      pageNumber * POSTS_PER_PAGE
    );
    sitemapEntries.push(renderSitemapEntry(
      getBlogPagePath(pageNumber),
      pagePosts[0]?.dateIso.slice(0, 10) || newestPostDate
    ));
  }

  for (const post of posts) {
    sitemapEntries.push(renderSitemapEntry(
      `/blog/${post.slug}/`,
      post.dateIso.slice(0, 10)
    ));
  }

  for (const tagGroup of collectTagGroups(posts)) {
    const tagTotalPages = Math.max(1, Math.ceil(tagGroup.posts.length / POSTS_PER_PAGE));

    for (let pageNumber = 1; pageNumber <= tagTotalPages; pageNumber += 1) {
      const pagePosts = tagGroup.posts.slice(
        (pageNumber - 1) * POSTS_PER_PAGE,
        pageNumber * POSTS_PER_PAGE
      );
      sitemapEntries.push(renderSitemapEntry(
        getTagPath(tagGroup.slug, pageNumber),
        pagePosts[0]?.dateIso.slice(0, 10) || newestPostDate
      ));
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.join("\n")}
</urlset>
`;
  const robots = `User-agent: *
Allow: /
Disallow: /admin/

Sitemap: ${SITE_URL}/sitemap.xml
Host: ${new URL(SITE_URL).hostname}
`;

  await Promise.all([
    fs.writeFile(path.join(DIST, "sitemap.xml"), sitemap, "utf8"),
    fs.writeFile(path.join(DIST, "robots.txt"), robots, "utf8")
  ]);
}
