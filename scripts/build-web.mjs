import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const marketingIndex = path.join(rootDir, 'public', 'index.html.marketing');
const distDir = path.join(rootDir, 'dist');
const distAppDir = path.join(distDir, 'app');

console.log('Starting custom web build for FlowerSandbox...');

try {
  // 0. Clean old dist directory
  console.log('Clearing old dist directory...');
  fs.rmSync(distDir, { recursive: true, force: true });

  // 1. Run Expo Web Export
  console.log('Running "pnpm exec expo export --platform web"...');
  const args = [
    'exec',
    'expo',
    'export',
    '--platform',
    'web',
    ...process.argv.slice(2),
  ];
  const result = spawnSync('pnpm', args, {
    cwd: rootDir,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`Expo export failed with exit code ${result.status}`);
  }

  console.log('Expo export completed successfully.');

  // 2. Create dist/app directory
  if (!fs.existsSync(distAppDir)) {
    console.log('Creating dist/app directory...');
    fs.mkdirSync(distAppDir, { recursive: true });
  }

  // 3. Move the generated React Native Web app loader dist/index.html to dist/app/index.html
  const distIndex = path.join(distDir, 'index.html');
  const distAppIndex = path.join(distAppDir, 'index.html');
  if (fs.existsSync(distIndex)) {
    console.log(
      'Moving generated app loader from dist/index.html to dist/app/index.html...',
    );
    fs.renameSync(distIndex, distAppIndex);
  } else {
    throw new Error('Generated dist/index.html not found!');
  }

  // 4. Copy public/index.html.marketing to dist/index.html (the root marketing page)
  if (fs.existsSync(marketingIndex)) {
    console.log('Copying marketing landing page to dist/index.html...');
    fs.copyFileSync(marketingIndex, path.join(distDir, 'index.html'));
  } else {
    console.warn('Warning: public/index.html.marketing not found!');
  }

  // 5. Clean up the copied index.html.marketing from dist/ since it was copied from public/ during expo export
  const distTempIndex = path.join(distDir, 'index.html.marketing');
  if (fs.existsSync(distTempIndex)) {
    console.log('Removing dist/index.html.marketing...');
    fs.unlinkSync(distTempIndex);
  }
} catch (error) {
  console.error('Build step failed:', error);
  process.exit(1);
}

console.log('Web build customization finished successfully!');
