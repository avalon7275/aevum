import { copyFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find the most recently modified versioned installer (Aevum_X.X.X_x64-setup.exe)
const nsisDir = join(__dirname, 'src-tauri/target/release/bundle/nsis');
const files = readdirSync(nsisDir)
  .filter(f => f.match(/^Aevum_\d+\.\d+\.\d+_x64-setup\.exe$/))
  .map(f => ({
    name: f,
    path: join(nsisDir, f),
    mtime: statSync(join(nsisDir, f)).mtime
  }))
  .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first

if (files.length === 0) {
  console.error('✗ No versioned installer found in:', nsisDir);
  process.exit(1);
}

const latestInstaller = files[0];
const destPath = join(nsisDir, 'Aevum_x64-setup.exe');

copyFileSync(latestInstaller.path, destPath);
console.log(`✓ Copied ${latestInstaller.name} → Aevum_x64-setup.exe`);
