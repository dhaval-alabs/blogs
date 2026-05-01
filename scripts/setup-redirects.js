
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function setupRedirectsTable() {
  console.log('Setting up redirects table...');
  
  // Note: We can't directly run arbitrary SQL via the supabase client unless we use a RPC
  // or the postgres connection. Since I have DIRECT_URL, I could use pg, but
  // let's try to check if it exists via a dummy query first.
  
  const { error: checkError } = await supabase.from('redirects').select('count', { count: 'exact', head: true }).limit(0);
  
  if (checkError && checkError.code === 'PGRST116' || checkError?.message?.includes('does not exist')) {
    console.log('Table "redirects" does not exist. Please run the following SQL in your Supabase Dashboard:');
    console.log(`
      CREATE TABLE IF NOT EXISTS redirects (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        source TEXT NOT NULL UNIQUE,
        destination TEXT NOT NULL,
        type INTEGER DEFAULT 301, -- 301, 302, 307, 308
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Add RLS policy for admins
      ALTER TABLE redirects ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Allow all for authenticated users" ON redirects FOR ALL TO authenticated USING (true);
    `);
  } else if (checkError) {
      console.error('Error checking redirects table:', checkError);
  } else {
    console.log('Table "redirects" already exists.');
  }
}

setupRedirectsTable();
