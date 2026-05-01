
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanupSlugs() {
  // Check if base slug is available
  const baseSlug = 'data-science-and-ai';
  const { data: existing } = await supabase.from('posts').select('id, title').eq('slug', baseSlug).maybeSingle();
  
  if (existing) {
    console.log(`Base slug "${baseSlug}" is taken by ID ${existing.id}: "${existing.title}"`);
  } else {
    console.log(`Base slug "${baseSlug}" is AVAILABLE.`);
  }

  // Check 998 and 999
  const { data: p998 } = await supabase.from('posts').select('*').eq('id', 998).maybeSingle();
  const { data: p999 } = await supabase.from('posts').select('*').eq('id', 999).maybeSingle();
  
  console.log('Post 998:', p998?.slug, p998?.status);
  console.log('Post 999:', p999?.slug, p999?.status);
}

cleanupSlugs();
