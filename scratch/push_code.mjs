import { execSync } from 'child_process';

try {
  console.log('Staging changes...');
  execSync('git add .');

  console.log('Committing changes...');
  execSync('git commit -m "Finalized DOM hardening and like synchronization fixes"');

  console.log('Pushing to github...');
  execSync('git push origin main');
  console.log('Successfully pushed to GitHub!');
} catch (err) {
  if (err.stdout && err.stdout.includes('nothing to commit')) {
    console.log('Nothing to commit, working tree clean.');
  } else {
    console.error('Git Error:', err.stdout || err.message);
  }
}
