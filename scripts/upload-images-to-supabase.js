/**
 * Upload every image under public/wp-content/uploads/ to Supabase Storage,
 * preserving the year/month folder structure. Writes image-url-mapping.json
 * mapping every old WordPress/local URL → new Supabase public URL so the
 * companion MDX rewriter can find-and-replace them.
 */
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const BUCKET = "uploads";
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const LOCAL_DIR = path.resolve(PUBLIC_DIR, "wp-content/uploads");
const MAPPING_FILE = path.resolve(__dirname, "../image-url-mapping.json");
const CONCURRENCY = 6;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) out.push(p);
  }
  return out;
}

function mimeFor(p) {
  const ext = path.extname(p).toLowerCase();
  return ({
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  })[ext] || "application/octet-stream";
}

function publicUrlFor(storagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function uploadOne(localPath) {
  const relToPublic = path.relative(PUBLIC_DIR, localPath).split(path.sep).join("/");
  // relToPublic: wp-content/uploads/2024/08/foo.png
  const storagePath = relToPublic;
  const relUpload = relToPublic.replace(/^wp-content\/uploads\//, "");

  const buf = fs.readFileSync(localPath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: mimeFor(localPath), upsert: true });

  const url = publicUrlFor(storagePath);
  return {
    storagePath,
    url,
    error,
    keys: [
      `/wp-content/uploads/${relUpload}`,
      `https://www.analytixlabs.co.in/wp-content/uploads/${relUpload}`,
      `http://www.analytixlabs.co.in/wp-content/uploads/${relUpload}`,
    ],
  };
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let idx = 0;
  async function spawn() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, spawn));
  return results;
}

(async () => {
  if (!fs.existsSync(LOCAL_DIR)) {
    console.error(`Source directory not found: ${LOCAL_DIR}`);
    process.exit(1);
  }

  const files = walk(LOCAL_DIR);
  console.log(`Found ${files.length} images. Uploading to bucket "${BUCKET}" with concurrency=${CONCURRENCY}...\n`);

  // Preserve any prior mapping so reruns are safe
  let mapping = {};
  if (fs.existsSync(MAPPING_FILE)) {
    try { mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, "utf8")); } catch {}
  }

  let ok = 0, fail = 0, done = 0;
  const t0 = Date.now();

  await runPool(files, async (localPath) => {
    done++;
    const pct = ((done / files.length) * 100).toFixed(1);
    try {
      const r = await uploadOne(localPath);
      if (r.error) {
        fail++;
        console.log(`[${done}/${files.length} ${pct}%] ✗ ${r.storagePath} → ${r.error.message}`);
      } else {
        ok++;
        for (const k of r.keys) mapping[k] = r.url;
        if (done % 50 === 0 || done === files.length) {
          console.log(`[${done}/${files.length} ${pct}%] ✓ ${r.storagePath}`);
        }
      }
    } catch (err) {
      fail++;
      console.log(`[${done}/${files.length} ${pct}%] ✗ ${localPath} → ${err.message}`);
    }
    // Checkpoint mapping every 200 files so a crash doesn't lose progress
    if (done % 200 === 0) {
      fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
    }
  }, CONCURRENCY);

  fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log("\n─────────────────────────────────────");
  console.log(`✓ Uploaded: ${ok}`);
  console.log(`✗ Failed:   ${fail}`);
  console.log(`📄 Mapping (${Object.keys(mapping).length} keys): ${MAPPING_FILE}`);
  console.log(`⏱  Took ${secs}s`);
  console.log("─────────────────────────────────────");
  process.exit(fail > 0 ? 1 : 0);
})();
