module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({
    "src/_includes/profile.css": "assets/profile.css",
  });

  eleventyConfig.addFilter("displayDiscipline", function displayDiscipline(d, entityType) {
    if (Array.isArray(d)) {
      return d.map((x) => displayDiscipline(x, entityType)).join(" / ");
    }
    if (entityType === "duo" && d === "Director") return "Directors";
    return d === "Dream Makers" ? "Dream Maker" : d;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
