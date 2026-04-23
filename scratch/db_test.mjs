import 'dotenv/config';
import { getServiceClient } from '../src/lib/supabase.js';

async function test() {
  const db = getServiceClient();
  const { data, error, count } = await db.from('comments').select('*', { count: 'exact' });
  if (error) {
    console.error('DB Error:', error);
  } else {
    console.log('Total Comments:', count);
    console.log('Sample data:', data.slice(0, 2));
  }
}

test();
