import { execSync } from 'child_process';
try {
  console.log(execSync('git status', { encoding: 'utf8' }));
} catch (err) {
  console.error(err.stdout || err.message);
}
