require('dotenv').config({ path: '.env.local' });
const { postCommentAction } = require('./src/app/actions');

async function run() {
  console.log("Testing action...");
  const res = await postCommentAction({ postSlug: 'test', userName: 'test', text: 'test' });
  console.log("Result:", res);
}
run().catch(console.error);
