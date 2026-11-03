const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve('.');
const distDir = path.join(rootDir, 'dist');
const backupDir = 'C:\\Users\\Seven Studio PC\\AppData\\Local\\Temp\\gh_dist';

if (!fs.existsSync(distDir)) {
  console.log('[Deploy] Building dist...');
  execSync('npm.cmd run build', { stdio: 'inherit' });
  fs.copyFileSync(path.join(distDir, 'index.html'), path.join(distDir, '404.html'));
}

console.log('[Deploy] Backing up dist to:', backupDir);
if (fs.existsSync(backupDir)) {
  fs.rmSync(backupDir, { recursive: true, force: true });
}
fs.cpSync(distDir, backupDir, { recursive: true });

console.log('[Deploy] Switching to gh-pages...');
execSync('git checkout gh-pages', { stdio: 'inherit' });

console.log('[Deploy] Copying files from backup to gh-pages...');
fs.cpSync(backupDir, rootDir, { recursive: true });

console.log('[Deploy] Staging distribution files...');
const filesToStage = [
  'index.html',
  '404.html',
  'sw.js',
  'manifest.webmanifest',
  'assets',
  'server.cjs',
  'server.cjs.map',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable.png',
];

for (const file of filesToStage) {
  if (fs.existsSync(path.join(rootDir, file))) {
    execSync(`git add "${file}"`, { stdio: 'inherit' });
  }
}

try {
  console.log('[Deploy] Committing...');
  execSync('git commit -m "deploy: update gh-pages with latest patch"', { stdio: 'inherit' });
  console.log('[Deploy] Pushing to origin gh-pages...');
  execSync('git push origin gh-pages', { stdio: 'inherit' });
  console.log('[Deploy] SUCCESS!');
} catch (err) {
  console.log('[Deploy] No changes or push error:', err.message);
} finally {
  console.log('[Deploy] Switching back to main...');
  execSync('git checkout main', { stdio: 'inherit' });
}
