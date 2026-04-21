/**
 * Second-pass uploader: handles every local image that is NOT yet in
 * image-url-mapping.json (missed in the first pass due to invalid-key
 * characters or transient Supabase errors).
 *
 * Strategy:
 *   - Sanitize the storage key (replace non-ASCII whitespace, control chars,
 *     backticks, curly quotes, etc. with '-'). Regular ASCII space → '-' too.
 *   - Upload under the sanitized key.
 *   - Add mapping entries for EVERY plausible URL form pointing at the
 *     ORIGINAL filename, so the MDX rewriter can find them regardless of
 *     whether the MDX uses raw, percent-encoded, or encodeURI-style URLs.
 */
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const BUCKET = "uploads";
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const LOCAL_DIR = path.resolve(PUBLIC_DIR, "wp-content/uploads");
const MAPPING_FILE = path.resolve(__dirname, "../image-url-mapping.json");

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

// Supabase rejects storage keys with control chars or certain whitespace.
// Replace anything non-safe with '-', collapse repeats, trim dashes around
// extension dots. Preserve letters, digits, and common punctuation.
function sanitizeKey(key) {
  const parts = key.split("/");
  const file = parts.pop();
  const cleaned = file
    .replace(/[^A-Za-z0-9._\-()]/g, "-") // keep only safe ascii subset
    .replace(/-+/g, "-")
    .replace(/-+\./g, ".")
    .replace(/^-+|-+$/g, "");
  return [...parts, cleaned].join("/");
}

function publicUrlFor(storagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function runPool(items, worker, concurrency) {
  let idx = 0;
  async function spawn() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, spawn));
}

(async () => {
  if (!fs.existsSync(MAPPING_FILE)) {
    console.error(`Missing ${MAPPING_FILE}. Run upload-images-to-supabase.js first.`);
    process.exit(1);
  }
  const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, "utf8"));

  const files = walk(LOCAL_DIR);
  // Find files that are NOT yet in the mapping (missing = first-pass failure).
  const missing = files.filter((localPath) => {
    const relToPublic = path.relative(PUBLIC_DIR, localPath).split(path.sep).join("/");
    const relUpload = relToPublic.replace(/^wp-content\/uploads\//, "");
    const keyRaw = `/wp-content/uploads/${relUpload}`;
    return !(keyRaw in mapping);
  });

  console.log(`${missing.length} images missing from mapping. Retrying with sanitized keys.`);
  let ok = 0, fail = 0, done = 0;

  await runPool(missing, async (localPath) => {
    done++;
    const relToPublic = path.relative(PUBLIC_DIR, localPath).split(path.sep).join("/");
    const relUpload = relToPublic.replace(/^wp-content\/uploads\//, "");

    const originalStoragePath = relToPublic;
    const sanitizedStoragePath = sanitizeKey(originalStoragePath);

    const buf = fs.readFileSync(localPath);

    let attempt = 0;
    let lastErr = null;
    while (attempt < 3) {
      attempt++;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(sanitizedStoragePath, buf, {
          contentType: mimeFor(localPath),
          upsert: true,
        });
      if (!error) { lastErr = null; break; }
      lastErr = error;
      if (!/gateway|timeout|network|fetch failed/i.test(error.message || "")) break;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }

    if (lastErr) {
      fail++;
      console.log(`[${done}/${missing.length}] ✗ ${originalStoragePath} → ${lastErr.message}`);
      return;
    }
    ok++;
    const url = publicUrlFor(sanitizedStoragePath);

    // Map every plausible URL form that might appear in MDX files back to the
    // new sanitized public URL:
    //   1. raw filename with actual unicode chars
    //   2. percent-encoded (encodeURI) form
    //   3. the space-replaced form (common in WP URLs where " " → "%20")
    const origKeyRaw = `/wp-content/uploads/${relUpload}`;
    const origKeyEncoded = `/wp-content/uploads/${relUpload.split("/").map(encodeURIComponent).join("/")}`;
    const origKeySpaceEnc = origKeyRaw.replace(/ /g, "%20");

    const prefixes = [
      "",
      "https://www.analytixlabs.co.in",
      "http://www.analytixlabs.co.in",
      "https://analytixlabs.co.in",
      "http://analytixlabs.co.in",
    ];
    for (const p of prefixes) {
      mapping[p + origKeyRaw] = url;
      mapping[p + origKeyEncoded] = url;
      mapping[p + origKeySpaceEnc] = url;
    }

    if (done % 25 === 0 || done === missing.length) {
      console.log(`[${done}/${missing.length}] ✓ ${sanitizedStoragePath}`);
    }
  }, 4);

  fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));

  console.log("\n─────────────────────────────────────");
  console.log(`✓ Uploaded (fix pass): ${ok}`);
  console.log(`✗ Still failing:       ${fail}`);
  console.log(`📄 Mapping (${Object.keys(mapping).length} keys): ${MAPPING_FILE}`);
  console.log("─────────────────────────────────────");
})();
