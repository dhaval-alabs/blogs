
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function comparePosts() {
  const { data: p998 } = await supabase.from('posts').select('title, content').eq('id', 998).single();
  const { data: p999 } = await supabase.from('posts').select('title, content').eq('id', 999).single();
  const { data: p15 } = await supabase.from('posts').select('title, content').eq('id', 15).single();

  console.log('Compare 998 vs 999:', p998.title === p999.title && p998.content === p999.content);
  console.log('Compare 999 vs 15:', p999.title === p15.title && p999.content === p15.content);
}

comparePosts();
