/**
 * Backfill `read_time` for every post in Supabase using the shared model
 * from src/lib/readTime.js (re-implemented inline here because this script
 * runs outside Next's module resolution).
 *
 * Usage:
 *   node scripts/backfill-read-time.mjs              # dry-run: log old → new, no writes
 *   node scripts/backfill-read-time.mjs --apply      # actually UPDATE rows
 *
 * Reads .env.local for Supabase service credentials.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.local');
const APPLY = process.argv.includes('--apply');

function loadEnv(filepath) {
  if (!fs.existsSync(filepath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filepath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = { ...loadEnv(path.join(ROOT, '.env')), ...loadEnv(ENV_FILE) };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Mirror of src/lib/readTime.js. If you change the model, change both.
function calculateReadTime(html) {
  if (!html || typeof html !== 'string') return 0;
  let s = html;
  const codeBlocks = (s.match(/<pre[\s>][\s\S]*?<\/pre>/gi) || []).length;
  s = s.replace(/<pre[\s>][\s\S]*?<\/pre>/gi, ' ');
  s = s.replace(/<code[\s>][\s\S]*?<\/code>/gi, ' ');
  const images = (s.match(/<img\b[^>]*>/gi) || []).length;
  const iframes = (s.match(/<iframe\b[\s\S]*?<\/iframe>/gi) || []).length;
  s = s.replace(/<img\b[^>]*>/gi, ' ');
  s = s.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, ' ');
  s = s.replace(/<figure\b[\s\S]*?<\/figure>/gi, ' ');
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  const text = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').filter(Boolean).length : 0;
  let imgSecs = 0;
  for (let i = 0; i < images; i++) imgSecs += Math.max(3, 12 - i);
  const totalMin = words / 238 + (codeBlocks * 30 + iframes * 30 + imgSecs) / 60;
  if (totalMin <= 0) return 0;
  return Math.max(1, Math.round(totalMin));
}

function parseStored(value) {
  if (value == null) return 0;
  const match = String(value).match(/-?\d+/);
  if (!match) return 0;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function main() {
  console.log(APPLY ? 'MODE: APPLY (writes will be made)' : 'MODE: DRY-RUN (no writes — pass --apply to commit)');
  console.log('Fetching all posts…\n');

  const { data, error } = await supabase
    .from('posts')
    .select('id, slug, title, content, read_time')
    .order('id', { ascending: true });

  if (error) {
    console.error('Fetch failed:', error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.log('No posts found.');
    return;
  }

  const updates = [];
  let unchanged = 0;
  let noContent = 0;

  for (const post of data) {
    const oldMinutes = parseStored(post.read_time);
    const newMinutes = calculateReadTime(post.content);
    const oldLabel = post.read_time || '(empty)';
    const newLabel = newMinutes > 0 ? `${newMinutes} min read` : '(empty)';

    if (newMinutes === 0) {
      noContent++;
      console.log(`SKIP  ${String(post.id).padStart(4)}  ${post.slug}  →  no content`);
      continue;
    }

    if (oldMinutes === newMinutes) {
      unchanged++;
      continue;
    }

    const flag = oldMinutes === 0 ? 'FIX ' : 'UPD ';
    console.log(`${flag} ${String(post.id).padStart(4)}  ${post.slug.padEnd(60)}  ${oldLabel.padEnd(14)} →  ${newLabel}`);
    updates.push({ id: post.id, read_time: newLabel });
  }

  console.log(`\n── Summary ──`);
  console.log(`Total posts:         ${data.length}`);
  console.log(`Would update:        ${updates.length}`);
  console.log(`Already correct:     ${unchanged}`);
  console.log(`Skipped (no body):   ${noContent}`);

  if (!APPLY) {
    console.log('\nDry-run complete. Re-run with --apply to commit changes.');
    return;
  }

  if (updates.length === 0) {
    console.log('\nNothing to update.');
    return;
  }

  console.log(`\nApplying ${updates.length} updates…`);
  let ok = 0;
  let fail = 0;
  for (const u of updates) {
    const { error: updErr } = await supabase
      .from('posts')
      .update({ read_time: u.read_time })
      .eq('id', u.id);
    if (updErr) {
      fail++;
      console.error(`  FAIL id=${u.id}: ${updErr.message}`);
    } else {
      ok++;
    }
  }
  console.log(`\nDone. ${ok} updated, ${fail} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
