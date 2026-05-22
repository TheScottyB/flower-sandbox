import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const publicIndex = path.join(rootDir, 'public', 'index.html');
const tempIndex = path.join(rootDir, 'public', 'index.html.marketing');
const distDir = path.join(rootDir, 'dist');
const distAppDir = path.join(distDir, 'app');

console.log('Starting custom web build for FlowerSandbox...');

let publicIndexMoved = false;

try {
  // 1. Move public/index.html to a temporary location so Expo Router uses its default clean template
  if (fs.existsSync(publicIndex)) {
    console.log('Backing up public/index.html to public/index.html.marketing...');
    fs.renameSync(publicIndex, tempIndex);
    publicIndexMoved = true;
  }

  // 2. Run Expo Web Export
  console.log('Running "npx expo export --platform web"...');
  const result = spawnSync('npx', ['expo', 'export', '--platform', 'web'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    throw new Error(`Expo export failed with exit code ${result.status}`);
  }

  console.log('Expo export completed successfully.');

  // 3. Create dist/app directory
  if (!fs.existsSync(distAppDir)) {
    console.log('Creating dist/app directory...');
    fs.mkdirSync(distAppDir, { recursive: true });
  }

  // 4. Move the generated React Native Web app loader dist/index.html to dist/app/index.html
  const distIndex = path.join(distDir, 'index.html');
  const distAppIndex = path.join(distAppDir, 'index.html');
  if (fs.existsSync(distIndex)) {
    console.log('Moving generated app loader from dist/index.html to dist/app/index.html...');
    fs.renameSync(distIndex, distAppIndex);
  } else {
    throw new Error('Generated dist/index.html not found!');
  }

} finally {
  // 5. Restore public/index.html
  if (publicIndexMoved && fs.existsSync(tempIndex)) {
    console.log('Restoring public/index.html...');
    fs.renameSync(tempIndex, publicIndex);
  }

  // 6. Copy the restored public/index.html to dist/index.html (the root marketing page)
  if (fs.existsSync(publicIndex)) {
    console.log('Copying marketing landing page to dist/index.html...');
    fs.copyFileSync(publicIndex, path.join(distDir, 'index.html'));
  }

  // 7. Clean up extra copied index.html.marketing from dist
  const distTempIndex = path.join(distDir, 'index.html.marketing');
  if (fs.existsSync(distTempIndex)) {
    console.log('Removing dist/index.html.marketing...');
    fs.unlinkSync(distTempIndex);
  }
}

console.log('Web build customization finished successfully!');
