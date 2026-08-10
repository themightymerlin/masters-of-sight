const fs = require("fs");
const path = require("path");

const DEFAULT_HTML = path.join(__dirname, "..", "_site", "masters", "the-wachowskis", "index.html");
const CSS_PATH = path.join(__dirname, "..", "src", "_includes", "profile.css");

function extractHtmlClasses(html) {
  const classes = new Set();
  const classAttrRegex = /class="([^"]*)"/g;
  let match;
  while ((match = classAttrRegex.exec(html)) !== null) {
    match[1]
      .split(/\s+/)
      .map((c) => c.trim())
      .filter(Boolean)
      .forEach((c) => classes.add(c));
  }
  return classes;
}

function extractCssClasses(css) {
  const classes = new Set();
  const classSelectorRegex = /\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g;
  let match;
  while ((match = classSelectorRegex.exec(css)) !== null) {
    classes.add(match[1]);
  }
  return classes;
}

function main() {
  const htmlPath = process.argv[2] || DEFAULT_HTML;

  const html = fs.readFileSync(htmlPath, "utf8");
  const css = fs.readFileSync(CSS_PATH, "utf8");

  const htmlClasses = extractHtmlClasses(html);
  const cssClasses = extractCssClasses(css);

  const uncovered = [...htmlClasses].filter((c) => !cssClasses.has(c)).sort();

  console.log(`Checked: ${path.relative(process.cwd(), htmlPath)}`);
  console.log(`Against: ${path.relative(process.cwd(), CSS_PATH)}`);
  console.log(`HTML classes found: ${htmlClasses.size}`);
  console.log(`CSS class selectors found: ${cssClasses.size}`);

  if (uncovered.length === 0) {
    console.log("\nNo gaps found — every class used in the HTML has a matching rule in profile.css.");
  } else {
    console.log(`\nWARNING: ${uncovered.length} class(es) used in HTML with no matching rule in profile.css:`);
    uncovered.forEach((c) => console.log(`  - ${c}`));
  }
}

main();
