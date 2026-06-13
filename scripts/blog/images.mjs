import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { DIST, ROOT } from "./config.mjs";

const BLOG_IMAGE_ROOT = "/assets/blog/";
const OPTIMIZABLE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const MAX_IMAGE_DIMENSION = 1600;

export function getOptimizedImagePath(publicPath) {
  if (typeof publicPath !== "string" || !publicPath.startsWith(BLOG_IMAGE_ROOT)) {
    return "";
  }

  const extension = path.posix.extname(publicPath).toLowerCase();
  if (!OPTIMIZABLE_EXTENSIONS.has(extension)) return "";

  return `${publicPath}.webp`;
}

async function listOptimizableImages(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listOptimizableImages(entryPath));
      continue;
    }

    if (entry.isFile() && OPTIMIZABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }

  return files;
}

export async function optimizeBlogImages() {
  const sourceDirectory = path.join(ROOT, "assets", "blog");
  const sourceFiles = await listOptimizableImages(sourceDirectory);
  let sourceBytes = 0;
  let outputBytes = 0;

  for (const sourcePath of sourceFiles) {
    const relativePath = path.relative(ROOT, sourcePath);
    const outputPath = path.join(DIST, `${relativePath}.webp`);
    const sourceStats = await fs.stat(sourcePath);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await sharp(sourcePath)
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({
        quality: 86,
        effort: 4,
        smartSubsample: true
      })
      .toFile(outputPath);

    const outputStats = await fs.stat(outputPath);
    sourceBytes += sourceStats.size;
    outputBytes += outputStats.size;
  }

  return {
    count: sourceFiles.length,
    sourceBytes,
    outputBytes
  };
}
