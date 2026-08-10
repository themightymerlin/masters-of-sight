const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO_ROOT = path.join(__dirname, "..", "..");
const SOURCE_HTML = path.join(REPO_ROOT, "index.html");
const OUTPUT_JSON = path.join(__dirname, "..", "src", "_data", "people.json");

const START_MARKER = "const PEOPLE = [";
const END_ANCHOR = "PEOPLE.sort((a, b) => {";

function extractPeopleSource(html) {
  const startIdx = html.indexOf(START_MARKER);
  if (startIdx === -1) {
    throw new Error(`Could not find start marker: ${START_MARKER}`);
  }

  const endAnchorIdx = html.indexOf(END_ANCHOR);
  if (endAnchorIdx === -1) {
    throw new Error(`Could not find end anchor: ${END_ANCHOR}`);
  }

  const closingIdx = html.lastIndexOf("];", endAnchorIdx);
  if (closingIdx === -1 || closingIdx < startIdx) {
    throw new Error('Could not find closing "];" before end anchor');
  }

  const arrayLiteralEnd = closingIdx + 2; // include "];"
  return html.slice(startIdx + "const ".length, arrayLiteralEnd);
}

function evaluatePeopleArray(sourceSnippet) {
  const context = {};
  vm.createContext(context);
  const script = `${sourceSnippet}\nPEOPLE;`;
  return vm.runInNewContext(script, context);
}

function runIntegrityChecks(people, originalHtml) {
  const lines = [];

  lines.push(`Total entries extracted: ${people.length}`);

  const idCounts = new Map();
  for (const person of people) {
    const id = person && person.id;
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }
  const uniqueIds = idCounts.size;
  const duplicates = [...idCounts.entries()].filter(([, count]) => count > 1);
  lines.push(`Unique ids: ${uniqueIds} / ${people.length} total entries`);
  if (duplicates.length > 0) {
    lines.push(
      `WARNING: duplicate ids found: ${duplicates
        .map(([id, count]) => `${id} (x${count})`)
        .join(", ")}`
    );
  } else {
    lines.push("No duplicate ids found.");
  }

  const requiredFields = ["id", "name", "discipline", "bio", "traits", "works"];
  const missingByEntry = [];
  people.forEach((person, index) => {
    const missing = requiredFields.filter((field) => {
      const value = person ? person[field] : undefined;
      return value === undefined || value === null;
    });
    if (missing.length > 0) {
      missingByEntry.push({
        id: (person && person.id) || `<index ${index}>`,
        missing,
      });
    }
  });
  lines.push(`Entries missing required fields: ${missingByEntry.length}`);
  if (missingByEntry.length > 0) {
    lines.push(
      `WARNING: entries with missing fields: ${missingByEntry
        .map((e) => `${e.id} [${e.missing.join(", ")}]`)
        .join("; ")}`
    );
  }

  const extractedBioChars = people.reduce((sum, person) => {
    const bio = person && typeof person.bio === "string" ? person.bio : "";
    return sum + bio.length;
  }, 0);

  const bioRegexDouble = /bio:\s*"((?:[^"\\]|\\.)*)"/g;
  const bioRegexBacktick = /bio:\s*`((?:[^`\\]|\\.)*)`/gs;
  let match;
  let originalBioChars = 0;
  while ((match = bioRegexDouble.exec(originalHtml)) !== null) {
    originalBioChars += match[1].length;
  }
  while ((match = bioRegexBacktick.exec(originalHtml)) !== null) {
    originalBioChars += match[1].length;
  }

  lines.push(
    `Bio character count — extracted data: ${extractedBioChars}, original file (regex scan): ${originalBioChars}`
  );
  if (extractedBioChars !== originalBioChars) {
    lines.push(
      `WARNING: bio character counts differ by ${Math.abs(
        extractedBioChars - originalBioChars
      )} characters — possible truncation or extraction mismatch.`
    );
  } else {
    lines.push("Bio character counts match.");
  }

  return { duplicates, missingByEntry, lines };
}

function main() {
  const html = fs.readFileSync(SOURCE_HTML, "utf8");
  const peopleSource = extractPeopleSource(html);
  const people = evaluatePeopleArray(peopleSource);

  const { lines } = runIntegrityChecks(people, html);
  console.log(lines.join("\n"));

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(people, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${people.length} entries to ${path.relative(process.cwd(), OUTPUT_JSON)}`);
}

main();
