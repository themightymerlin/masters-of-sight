module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({
    "src/_includes/profile.css": "assets/profile.css",
    "src/_includes/homepage.css": "assets/homepage.css",
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
