import 'dotenv/config';
import { getServiceClient } from '../src/lib/supabase.js';

async function checkPostsTable() {
  const db = getServiceClient();
  const { data, error } = await db.from('posts').select('*').limit(1);
  if (error) {
    console.error('DB Error:', error);
  } else if (data && data.length > 0) {
    console.log('Columns in posts table:', Object.keys(data[0]));
    console.log('Sample data:', data[0]);
  } else {
    console.log('No posts found.');
  }
}

checkPostsTable();
