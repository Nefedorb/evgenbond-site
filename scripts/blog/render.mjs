import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import {
  AUTHOR_NAME,
  POSTS_PER_PAGE,
  SITE_DESCRIPTION,
  SITE_META_SUFFIX,
  SITE_TITLE,
  SITE_URL
} from "./config.mjs";
import {
  escapeHtml,
  formatArticleDate,
  formatCardDate,
  getPreviewTags,
  slugifyTag,
  toAbsoluteUrl
} from "./content.mjs";

marked.use({
  gfm: true,
  breaks: false
});

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

function getAuthorStructuredData() {
  return {
    "@type": "Person",
    "@id": `${SITE_URL}/#person`,
    name: AUTHOR_NAME,
    url: `${SITE_URL}/`,
    image: `${SITE_URL}/001.jpg`,
    jobTitle: "Специалист по созданию сайтов и цифровому маркетингу",
    sameAs: ["https://t.me/nefedor"]
  };
}

function getWebsiteStructuredData() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: "evgenbond.ru",
    description: SITE_TITLE,
    inLanguage: "ru-RU",
    author: { "@id": `${SITE_URL}/#person` }
  };
}

function getBlogStructuredData() {
  return {
    "@type": "Blog",
    "@id": `${SITE_URL}/blog/#blog`,
    name: `Блог — ${SITE_META_SUFFIX}`,
    description: SITE_DESCRIPTION,
    url: `${SITE_URL}/blog/`,
    inLanguage: "ru-RU",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    author: { "@id": `${SITE_URL}/#person` },
    publisher: { "@id": `${SITE_URL}/#person` }
  };
}

function getBreadcrumbStructuredData(pagePath, items) {
  const canonical = toAbsoluteUrl(pagePath);

  return {
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: toAbsoluteUrl(item.path)
    }))
  };
}

function getWebPageStructuredData({
  type = "WebPage",
  title,
  description,
  pagePath,
  breadcrumb,
  mainEntity,
  about
}) {
  const canonical = toAbsoluteUrl(pagePath);

  return {
    "@type": type,
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: title,
    description,
    inLanguage: "ru-RU",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    breadcrumb: { "@id": breadcrumb["@id"] },
    ...(mainEntity ? { mainEntity: { "@id": mainEntity } } : {}),
    ...(about ? { about: { "@id": about } } : {})
  };
}

function createStructuredDataGraph(entities) {
  return {
    "@context": "https://schema.org",
    "@graph": entities
  };
}

function getBlogPageStructuredData({
  title,
  description,
  pagePath,
  currentPage,
  pageKind,
  breadcrumbLabel
}) {
  const blog = getBlogStructuredData();
  const breadcrumbItems = [
    { name: "Главная", path: "/" },
    { name: "Блог", path: "/blog/" }
  ];

  if (pagePath !== "/blog/") {
    breadcrumbItems.push({ name: breadcrumbLabel, path: pagePath });
  }

  const breadcrumb = getBreadcrumbStructuredData(pagePath, breadcrumbItems);
  const isCollectionPage = pageKind === "tag" || currentPage > 1;
  const webpage = getWebPageStructuredData({
    type: isCollectionPage ? "CollectionPage" : "WebPage",
    title,
    description,
    pagePath,
    breadcrumb,
    mainEntity: isCollectionPage ? undefined : blog["@id"],
    about: isCollectionPage ? blog["@id"] : undefined
  });

  return createStructuredDataGraph([
    getAuthorStructuredData(),
    getWebsiteStructuredData(),
    blog,
    webpage,
    breadcrumb
  ]);
}

function getPostStructuredData(post) {
  const pagePath = `/blog/${post.slug}/`;
  const canonical = toAbsoluteUrl(pagePath);
  const articleId = `${canonical}#article`;
  const breadcrumb = getBreadcrumbStructuredData(pagePath, [
    { name: "Главная", path: "/" },
    { name: "Блог", path: "/blog/" },
    { name: post.title, path: pagePath }
  ]);
  const webpage = getWebPageStructuredData({
    title: post.title,
    description: post.description,
    pagePath,
    breadcrumb,
    mainEntity: articleId
  });
  const article = {
    "@type": "BlogPosting",
    "@id": articleId,
    headline: post.title,
    description: post.description,
    datePublished: post.dateIso,
    mainEntityOfPage: { "@id": webpage["@id"] },
    url: canonical,
    image: toAbsoluteUrl(post.sharedImage),
    keywords: post.tags,
    articleSection: post.tags,
    isAccessibleForFree: true,
    inLanguage: "ru-RU",
    isPartOf: { "@id": `${SITE_URL}/blog/#blog` },
    author: { "@id": `${SITE_URL}/#person` },
    publisher: { "@id": `${SITE_URL}/#person` }
  };

  return createStructuredDataGraph([
    getAuthorStructuredData(),
    getWebsiteStructuredData(),
    getBlogStructuredData(),
    webpage,
    article,
    breadcrumb
  ]);
}

function renderHead({ title, description, path: pagePath, image, imageAlt, type = "website", structuredData }) {
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
    <link rel="preload" href="/assets/site/fonts/inter-tight-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="/assets/site/base.css">
    <link rel="stylesheet" href="/assets/site/blog.css">
    <link rel="stylesheet" href="/assets/site/cookie-consent.css">
    <script defer src="/assets/site/cookie-consent.js"></script>${structuredData ? `
    <script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>` : ""}`;
}

function renderPage({ head, body }) {
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>${head}
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

function formatDownloadSize(bytes) {
  const units = [
    { size: 1024 * 1024, label: "МБ" },
    { size: 1024, label: "КБ" }
  ];
  const unit = units.find((candidate) => bytes >= candidate.size);

  if (!unit) return `${bytes} Б`;

  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: bytes >= unit.size * 10 ? 0 : 1
  }).format(bytes / unit.size)} ${unit.label}`;
}

function renderDownloadBlock(block) {
  const description = block.description
    ? `<p class="article-download-description">${escapeHtml(block.description)}</p>`
    : "";

  return `
                <section class="article-block article-download-block" aria-label="Файл для скачивания">
                    <div class="mono-text article-download-meta">[ ${escapeHtml(block.fileExtension)} // ${escapeHtml(formatDownloadSize(block.fileSize))} ]</div>
                    <h2 class="article-download-title">${escapeHtml(block.title)}</h2>
                    ${description}
                    <a class="article-download-link" href="${escapeHtml(block.file)}" download="${escapeHtml(block.fileName)}">
                        <span>Скачать файл</span>
                        <span aria-hidden="true">[ → ]</span>
                    </a>
                </section>`;
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
    if (block.type === "download") return renderDownloadBlock(block);

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

export function getTagPath(tagSlug, pageNumber = 1) {
  return pageNumber === 1
    ? `/blog/tag/${tagSlug}/`
    : `/blog/tag/${tagSlug}/page/${pageNumber}/`;
}

export function getBlogPagePath(pageNumber) {
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

export function renderBlogIndex(posts, {
  currentPage = 1,
  totalPages = 1,
  pagePath = getBlogPagePath(currentPage),
  getPagePath = getBlogPagePath,
  pageTitle = currentPage === 1 ? `Блог — ${SITE_META_SUFFIX}` : `Блог, страница ${currentPage} — ${SITE_META_SUFFIX}`,
  pageDescription = SITE_DESCRIPTION,
  headerLabel = "Блог",
  headerSummary = SITE_DESCRIPTION,
  pageKind = "blog",
  breadcrumbLabel = currentPage > 1 ? `Страница ${currentPage}` : "Блог"
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
    <main class="master-grid blog-shell">
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
            <div class="legal-links"><a href="/cookie-policy/">Политика использования Cookie-файлов</a></div>
        </section>
    </main>`;

  return renderPage({
    head: renderHead({
      title: pageTitle,
      description: pageDescription,
      path: pagePath,
      image: "/sharedlink.jpg",
      imageAlt: SITE_TITLE,
      structuredData: getBlogPageStructuredData({
        title: pageTitle,
        description: pageDescription,
        pagePath,
        currentPage,
        pageKind,
        breadcrumbLabel
      })
    }),
    body
  });
}

export function renderPost(post) {
  const content = renderArticleBlocks(post.blocks);
  const cover = post.showCoverInArticle
    ? `
            <div class="article-cover${post.showCoverBorder ? "" : " has-no-border"}">
                <img src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.coverImageAlt)}">
            </div>`
    : "";

  const body = `
    <main class="master-grid blog-shell">
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
            <div class="legal-links"><a href="/cookie-policy/">Политика использования Cookie-файлов</a></div>
        </section>
    </main>
${renderArticleInteractionScript()}`;

  return renderPage({
    head: renderHead({
      title: `${post.title} — ${SITE_META_SUFFIX}`,
      description: post.description,
      path: `/blog/${post.slug}/`,
      image: post.sharedImage,
      imageAlt: post.sharedImageAlt,
      type: "article",
      structuredData: getPostStructuredData(post)
    }),
    body
  });
}
