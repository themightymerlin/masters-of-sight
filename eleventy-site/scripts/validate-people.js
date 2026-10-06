// Report-only validator for src/_data/people.json. Exit 1 if any ERROR.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', '_data', 'people.json');
const LONG_BIO_OK = new Set(['bungie', 'naughty-dog', 'rockstar-games', 'steven-spielberg']);
const MATTER_KEYS = /^(why.*matter.*|matters?)$/i;

const findings = [];
const legacyGallery = [];
const add = (level, id, msg) => findings.push({ level, id, msg });

let data;
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  console.log(`[ERROR] (file): JSON failed to parse: ${e.message}`);
  console.log('\n1 error, 0 warnings');
  process.exit(1);
}
if (!Array.isArray(data)) {
  console.log('[ERROR] (file): top level is not an array');
  process.exit(1);
}

// Walk every string value; cb(str, keyPath, inWorkTitle)
function walk(node, keyPath, cb) {
  if (typeof node === 'string') return cb(node, keyPath);
  if (Array.isArray(node)) return node.forEach((v, i) => walk(v, keyPath.concat(i), cb));
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) walk(node[k], keyPath.concat(k), cb);
  }
}
function walkKeys(node, cb) {
  if (Array.isArray(node)) return node.forEach((v) => walkKeys(v, cb));
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      cb(k);
      walkKeys(node[k], cb);
    }
  }
}

// A work title (works[n].title) or Also Worked On entry (alsoWorkedOn[n])
const isTitleLike = (kp) =>
  (kp[0] === 'works' && kp[2] === 'title') || (kp[0] === 'alsoWorkedOn' && kp.length === 2);

function countSentences(text) {
  const t = text
    .replace(/\b([A-Z])\./g, '$1\u0000') // initials like J.J.
    .replace(/\b(Mr|Mrs|Ms|Dr|St|Jr|Sr|vs|etc|No)\./g, '$1\u0000')
    .replace(/\.\.\./g, '\u0001');
  const parts = t.split(/[.!?]+["')”]*(?=\s+\S|\s*$)/).filter((s) => s.trim().length > 0);
  return parts.length;
}

const ids = new Set();
const seen = new Set();
for (const m of data) {
  if (seen.has(m.id)) add('ERROR', m.id, 'duplicate id');
  seen.add(m.id);
  ids.add(m.id);
}

for (const m of data) {
  const id = m.id;

  for (const r of m.related || []) {
    if (!ids.has(r)) add('ERROR', id, `related id does not exist: ${r}`);
  }

  const gm = m.galleryMedia;
  if (Array.isArray(gm)) {
    gm.forEach((g, i) => {
      if (g.type === 'video' && i !== gm.length - 1) {
        add('ERROR', id, `video at galleryMedia[${i}] is not last (length ${gm.length})`);
      }
    });
  }
  const mediaImgs = Array.isArray(gm) ? gm.filter((g) => g.type === 'image').length : 0;
  const legacyImgs = Array.isArray(m.galleryImages)
    ? m.galleryImages.filter((u) => typeof u === 'string').length
    : 0;
  if (legacyImgs > 0 && !Array.isArray(gm)) legacyGallery.push(id);
  const imgs = mediaImgs + legacyImgs;
  if (imgs < 4) {
    add('WARN', id, `${imgs} image(s) in galleryMedia + galleryImages, fewer than four`);
  }

  if (Object.prototype.hasOwnProperty.call(m, 'galleryLayout')) {
    add('ERROR', id, 'galleryLayout key present');
  }

  let cloudTotal = 0;
  let cloudBad = 0;
  walk(m, [], (s, kp) => {
    const where = kp.join('.');
    if (s.includes('—')) add('ERROR', id, `em-dash in ${where}`);
    // URLs legitimately contain "--"; only prose is checked for double hyphens
    if (s.includes('--') && !isTitleLike(kp) && !/^https?:\/\//.test(s)) {
      add('ERROR', id, `double hyphen in ${where}`);
    }
    if (/masters of sight/i.test(s)) {
      for (const hit of s.match(/masters of sight/gi)) {
        if (hit !== 'Masters Of Sight') add('WARN', id, `"${hit}" in ${where} should be "Masters Of Sight"`);
      }
    }
    if (/res\.cloudinary\.com/.test(s)) {
      cloudTotal++;
      const u = s.indexOf('/upload/');
      if (u === -1 || !s.startsWith('f_auto,q_auto', u + '/upload/'.length)) cloudBad++;
    }
  });
  if (cloudBad > 0) {
    add('WARN', id, `${cloudBad} of ${cloudTotal} Cloudinary URLs missing f_auto,q_auto`);
  }

  // Spaced hyphen in bio, traits, why-they-matter text only
  const prose = [];
  if (typeof m.bio === 'string') prose.push(['bio', m.bio]);
  (m.traits || []).forEach((t, i) => typeof t === 'string' && prose.push([`traits.${i}`, t]));
  for (const k of Object.keys(m)) {
    if (MATTER_KEYS.test(k) && typeof m[k] === 'string') prose.push([k, m[k]]);
  }
  for (const [where, s] of prose) {
    if (/ - /.test(s)) add('WARN', id, `spaced hyphen " - " in ${where}`);
  }

  if (!Array.isArray(m.traits) || m.traits.length !== 5) {
    add('WARN', id, `traits count is ${Array.isArray(m.traits) ? m.traits.length : 'missing'}, expected 5`);
  }

  if (typeof m.bio === 'string' && !LONG_BIO_OK.has(id)) {
    const n = countSentences(m.bio);
    if (n < 3 || n > 5) add('WARN', id, `bio has ~${n} sentences, expected 3-5`);
  }

  walkKeys(m, (k) => {
    if (/philosoph|ethos/i.test(k)) add('WARN', id, `key named like philosophy/ethos: ${k}`);
  });
}

const errors = findings.filter((f) => f.level === 'ERROR');
const warns = findings.filter((f) => f.level === 'WARN');
for (const f of [...errors, ...warns]) console.log(`[${f.level}] ${f.id}: ${f.msg}`);
if (legacyGallery.length) {
  console.log(`[INFO] ${legacyGallery.length} master(s) still use galleryImages instead of galleryMedia: ${legacyGallery.join(', ')}`);
}
console.log(`\n${errors.length} error${errors.length === 1 ? '' : 's'}, ${warns.length} warning${warns.length === 1 ? '' : 's'}`);
process.exit(errors.length ? 1 : 0);
