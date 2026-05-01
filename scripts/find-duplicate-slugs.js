
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function findDuplicateSlugs() {
  const { data, error } = await supabase
    .from('posts')
    .select('id, slug, title, status');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const slugMap = {};
  const duplicates = [];

  data.forEach(post => {
    // Check if the slug (without the numerical suffix if it was added by our system) 
    // matches another slug's base form.
    // Our suffixes are either -Date.now() (long) or -id (short).
    const baseSlug = post.slug.replace(/-\d+$/, '');
    
    if (!slugMap[post.slug]) {
        slugMap[post.slug] = [];
    }
    slugMap[post.slug].push(post);
  });

  console.log('--- All Slugs ---');
  Object.keys(slugMap).forEach(slug => {
    if (slugMap[slug].length > 1) {
        console.log(`DUPLICATE SLUG: ${slug}`);
        slugMap[slug].forEach(p => console.log(`  - ID: ${p.id}, Title: ${p.title}, Status: ${p.status}`));
    }
  });

  console.log('--- Slugs with Suffixes ---');
  data.filter(p => /-\d+$/.test(p.slug)).forEach(p => {
      console.log(`SUFFIXED SLUG: ${p.slug} (ID: ${p.id}, Title: ${p.title})`);
  });
}

findDuplicateSlugs();
