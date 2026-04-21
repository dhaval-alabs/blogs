/**
 * Rewrites image references in every .mdx file under content/blog/
 * using image-url-mapping.json (old WordPress/local URL → Supabase public URL).
 */
const fs = require("fs");
const path = require("path");

const MAPPING_FILE = path.resolve(__dirname, "../image-url-mapping.json");
const CONTENT_DIR = path.resolve(__dirname, "../content/blog");

if (!fs.existsSync(MAPPING_FILE)) {
  console.error(`Missing ${MAPPING_FILE}. Run upload-images-to-supabase.js first.`);
  process.exit(1);
}

const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, "utf8"));
// Replace longest keys first so partial-prefix matches never clobber full URLs.
const keys = Object.keys(mapping).sort((a, b) => b.length - a.length);

const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".mdx"));
let totalReplacements = 0;
let filesModified = 0;

for (const file of files) {
  const fp = path.join(CONTENT_DIR, file);
  let content = fs.readFileSync(fp, "utf8");
  const before = content;
  let localReplacements = 0;

  for (const oldUrl of keys) {
    if (!content.includes(oldUrl)) continue;
    const parts = content.split(oldUrl);
    localReplacements += parts.length - 1;
    content = parts.join(mapping[oldUrl]);
  }

  if (content !== before) {
    fs.writeFileSync(fp, content, "utf8");
    filesModified++;
    totalReplacements += localReplacements;
    console.log(`✓ ${file} (${localReplacements} replacements)`);
  }
}

console.log(`\n─────────────────────────────────────`);
console.log(`Files modified: ${filesModified} / ${files.length}`);
console.log(`Total image URLs rewritten: ${totalReplacements}`);
console.log(`─────────────────────────────────────`);
