
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkId15() {
  const { data, error } = await supabase.from('posts').select('id, slug, title, status, updated_at').eq('id', 15).single();
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

checkId15();
