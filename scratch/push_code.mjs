import { execSync } from 'child_process';

try {
  console.log('Running git status...');
  const status = execSync('git status', { encoding: 'utf8' });
  console.log(status);

  console.log('Staging changes...');
  execSync('git add .');

  console.log('Committing changes...');
  execSync('git commit -m "Hardened DOM event handlers and fixed like count synchronization"');

  console.log('Pushing to github...');
  execSync('git push origin main');
  console.log('Done!');
} catch (err) {
  console.error('Git Error:', err.stdout || err.message);
}
