// Ingest a Master's images from the inbox into Cloudinary. Dry run by default.
//   node scripts/ingest-masters.js "Brad Bird"            (dry run)
//   node scripts/ingest-masters.js "Brad Bird" --upload   (real upload)
//   Optional: --inbox <path> overrides the inbox folder.
// Never prints, logs, or writes the API key, secret, or signature.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const SITE_ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(SITE_ROOT, '.env');
const PEOPLE_FILE = path.join(SITE_ROOT, 'src', '_data', 'people.json');
const DEFAULT_INBOX = path.join(os.homedir(), 'Desktop', 'New Master Images');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff', '.avif']);
const MAX_BYTES = 10 * 1024 * 1024;
const REQUIRED_ENV = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(2) + ' MB';

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Replace any occurrence of a secret value with "[redacted]".
function scrub(text, secrets) {
  let out = String(text);
  for (const s of secrets) {
    if (s) out = out.split(s).join('[redacted]');
  }
  return out;
}

function parseArgs(argv) {
  const args = { name: null, upload: false, inbox: DEFAULT_INBOX };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--upload') args.upload = true;
    else if (a === '--inbox') args.inbox = path.resolve(argv[++i] || '');
    else if (!args.name) args.name = a;
  }
  return args;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function scanFolder(dir) {
  const images = [];
  const skipped = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    if (e.name.startsWith('_') || e.name.startsWith('.')) {
      skipped.push({ name: e.name, reason: 'skipped (hidden or underscore name)' });
    } else if (e.isDirectory()) {
      skipped.push({ name: e.name, reason: 'skipped (subfolder, not recursed)' });
    } else if (!e.isFile() || !IMAGE_EXT.has(path.extname(e.name).toLowerCase())) {
      skipped.push({ name: e.name, reason: 'skipped (not an image)' });
    } else {
      images.push({ name: e.name, file: path.join(dir, e.name), bytes: fs.statSync(path.join(dir, e.name)).size });
    }
  }
  return { images, skipped };
}

function readManifest(manifestFile) {
  if (!fs.existsSync(manifestFile)) return [];
  const data = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (!Array.isArray(data)) throw new Error('Existing manifest is not an array: ' + manifestFile);
  return data;
}

function signUpload(params, secret) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + secret).digest('hex');
}

async function uploadOne(img, slug, creds) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = { asset_folder: slug, timestamp, unique_filename: 'true', use_filename: 'true' };
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(img.file)]), img.name);
  form.append('api_key', creds.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signUpload(signed, creds.apiSecret));
  form.append('asset_folder', slug);
  form.append('use_filename', 'true');
  form.append('unique_filename', 'true');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${creds.cloudName}/image/upload`, { method: 'POST', body: form });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch (e) {
    // non-JSON response, handled below
  }
  if (!res.ok) {
    const msg = body && body.error && body.error.message ? body.error.message : 'no error message in response';
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  const url = body && body.secure_url;
  if (typeof url !== 'string' || !/image\/upload\/v\d+\//.test(url)) {
    throw new Error('secure_url missing or not in the expected image/upload/v<digits>/ form');
  }
  return { publicId: body.public_id, url: url.replace('/upload/', '/upload/f_auto,q_auto/') };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.name) {
    console.error('Usage: node scripts/ingest-masters.js "<Folder Name>" [--upload] [--inbox <path>]');
    process.exit(1);
  }
  if (args.name.includes('/') || args.name.includes('\\') || args.name === '.' || args.name === '..') {
    console.error('Folder name must be a single subfolder name inside the inbox.');
    process.exit(1);
  }
  const folder = path.join(args.inbox, args.name);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    console.error(`Folder not found: "${args.name}" inside ${args.inbox}`);
    process.exit(1);
  }

  const slug = slugify(args.name);
  if (!slug) {
    console.error('Folder name produced an empty slug.');
    process.exit(1);
  }
  const manifestFile = path.join(args.inbox, '_manifests', slug + '.json');
  const { images, skipped } = scanFolder(folder);

  console.log(`Mode: ${args.upload ? 'UPLOAD' : 'dry run'}`);
  console.log(`Folder: ${args.name}`);
  console.log(`Slug: ${slug}`);
  console.log(`\nImages (${images.length}):`);
  for (const img of images) {
    console.log(`  ${img.name}  ${mb(img.bytes)}`);
    if (img.bytes > MAX_BYTES) console.log(`    WARNING: over 10 MB, Cloudinary may reject it.`);
  }
  console.log(`\nSkipped (${skipped.length}):`);
  for (const s of skipped) console.log(`  ${s.name}: ${s.reason}`);
  const totalBytes = images.reduce((n, i) => n + i.bytes, 0);
  console.log(`\nTotals: ${images.length} images, ${mb(totalBytes)}, ${skipped.length} skipped`);

  const people = JSON.parse(fs.readFileSync(PEOPLE_FILE, 'utf8'));
  const found = Array.isArray(people) && people.some((p) => p && p.id === slug);
  console.log(found ? 'id found in people.json' : 'id not found (expected for a brand new Master)');

  const manifest = readManifest(manifestFile);
  const known = new Set(manifest.map((m) => m.sha256));
  for (const img of images) img.sha256 = sha256(img.file);
  const fresh = images.filter((i) => !known.has(i.sha256));
  if (manifest.length || args.upload) {
    console.log(`Manifest: ${images.length - fresh.length} already uploaded, ${fresh.length} new`);
  }

  if (!args.upload) {
    console.log('\nDry run only. Nothing was uploaded.');
    return;
  }

  // Real upload: the only place .env is loaded.
  try {
    process.loadEnvFile(ENV_FILE);
  } catch (e) {
    console.error('Could not load eleventy-site/.env');
    process.exit(1);
  }
  const missing = REQUIRED_ENV.filter((n) => !process.env[n]);
  if (missing.length) {
    for (const n of missing) console.error(`Missing or empty: ${n}`);
    process.exit(1);
  }
  const creds = {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  };
  const secrets = [creds.apiKey, creds.apiSecret];

  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  let failures = 0;
  const failed = new Map();
  console.log('');
  for (const img of fresh) {
    try {
      const r = await uploadOne(img, slug, creds);
      manifest.push({
        file: img.name,
        sha256: img.sha256,
        bytes: img.bytes,
        public_id: r.publicId,
        url: r.url,
        uploadedAt: new Date().toISOString(),
      });
      fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
      console.log(`uploaded: ${img.name}`);
    } catch (e) {
      failures++;
      const why = scrub(e && e.message ? e.message : e, secrets);
      failed.set(img.name, why);
      console.error(`FAILED: ${img.name}: ${why}`);
    }
  }

  console.log('\nFile name | url');
  const bySha = new Map(manifest.map((m) => [m.sha256, m]));
  for (const img of images) {
    const m = bySha.get(img.sha256);
    console.log(`${img.name} | ${m ? m.url : 'FAILED (' + (failed.get(img.name) || 'not uploaded') + ')'}`);
  }
  if (failures) {
    console.error(`\n${failures} file(s) failed. Nothing was retried.`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Error: ' + scrub(e && e.message ? e.message : e, [process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET]));
    process.exit(1);
  });
}

module.exports = { scrub, slugify };
