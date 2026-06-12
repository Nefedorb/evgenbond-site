import { buildSite } from "./blog/build-site.mjs";

buildSite().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
