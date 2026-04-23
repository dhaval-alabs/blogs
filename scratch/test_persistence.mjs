import 'dotenv/config';
import { getServiceClient } from '../src/lib/supabase.js';

async function testLikePersistence() {
  const db = getServiceClient();
  
  // 1. Get any comment
  const { data: comments, error: fetchErr } = await db
    .from('comments')
    .select('id, text, likes, status')
    .limit(1);

  if (fetchErr || !comments || comments.length === 0) {
    console.error('No approved comments found to test with.', fetchErr);
    return;
  }

  const comment = comments[0];
  const originalLikes = comment.likes || 0;
  console.log(`Testing Comment ID: ${comment.id}`);
  console.log(`Original Likes: ${originalLikes}`);

  // 2. Increment likes
  const { error: updateErr } = await db
    .from('comments')
    .update({ likes: originalLikes + 1 })
    .eq('id', comment.id);

  if (updateErr) {
    console.error('FAILED to update likes:', updateErr);
    return;
  }
  console.log('Update successful (DB returned no error).');

  // 3. Verify increment
  const { data: updated, error: verifyErr } = await db
    .from('comments')
    .select('likes')
    .eq('id', comment.id)
    .single();

  if (verifyErr) {
    console.error('FAILED to verify update:', verifyErr);
    return;
  }

  console.log(`Verified Likes in DB: ${updated.likes}`);
  
  if (updated.likes === originalLikes + 1) {
    console.log('✅ PERSISTENCE SUCCESS: DB is updated.');
  } else {
    console.log('❌ PERSISTENCE FAILURE: Count did not increment correctly.');
  }
}

testLikePersistence();
