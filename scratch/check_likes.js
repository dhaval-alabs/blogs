import { getServiceClient } from './src/lib/supabase.js';

async function check() {
  const db = getServiceClient();
  const { data, error } = await db
    .from('comments')
    .select('id, text, likes')
    .eq('status', 'approved')
    .limit(5);

  if (error) {
    console.error('Error fetching comments:', error);
    return;
  }

  console.log('--- Approved Comments ---');
  data.forEach(c => {
    console.log(`ID: ${c.id} | Likes: ${c.likes} | Text: ${c.text.substring(0, 30)}...`);
  });
}

check();
