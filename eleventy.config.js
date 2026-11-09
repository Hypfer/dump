const FONT_FILES = {
  "node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2":
    "assets/fonts/ibm-plex-sans-latin-400.woff2",
  "node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2":
    "assets/fonts/ibm-plex-sans-latin-600.woff2",
  "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2":
    "assets/fonts/ibm-plex-mono-latin-400.woff2",
  "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2":
    "assets/fonts/ibm-plex-mono-latin-600.woff2",
};

export default function (eleventyConfig) {
  eleventyConfig.ignores.add("entries");
  eleventyConfig.addWatchTarget("./entries");

  eleventyConfig.addPassthroughCopy("assets");

  for (const [from, to] of Object.entries(FONT_FILES)) {
    eleventyConfig.addPassthroughCopy({ [from]: to });
  }

  eleventyConfig.addFilter("rfc822", (d) => new Date(d).toUTCString());

  return {
    dir: { input: ".", includes: "_includes", data: "_data", output: "_site" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
    pathPrefix: "/",
  };
}
