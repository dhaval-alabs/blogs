
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function checkRedirects() {
  const { data, error } = await supabase.from('redirects').select('*');
  if (error) {
    console.error('Error fetching redirects:', error);
  } else {
    console.log('Current Redirects:');
    console.log(JSON.stringify(data, null, 2));
  }
}

checkRedirects();
