module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({
    "src/_includes/profile.css": "assets/profile.css",
    "src/_includes/homepage.css": "assets/homepage.css",
  });

  eleventyConfig.addGlobalData("buildVersion", () => String(Date.now()));

  eleventyConfig.addFilter("cld", function cld(url, width) {
    if (typeof url !== "string") return url;
    return url.replace("/upload/f_auto,q_auto/", "/upload/f_auto,q_auto,w_" + width + ",c_limit/");
  });

  eleventyConfig.addFilter("displayDiscipline", function displayDiscipline(d, entityType) {
    if (Array.isArray(d)) {
      return d.map((x) => displayDiscipline(x, entityType)).join(" / ");
    }
    if (entityType === "duo" && d === "Director") return "Directors";
    return d === "Dream Makers" ? "Dream Maker" : d;
  });

  return {
    pathPrefix: "/",
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
