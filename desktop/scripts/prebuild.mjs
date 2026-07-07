import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const uiSource = resolve(repoRoot, 'rust-mcp', 'static', 'dist');
const uiTarget = resolve(repoRoot, 'desktop', 'src-tauri', 'static', 'dist');

if (!existsSync(uiSource)) {
  throw new Error(`UI source not found at ${uiSource}. Run: cd config-ui && npm run build`);
}

rmSync(uiTarget, { recursive: true, force: true });
mkdirSync(uiTarget, { recursive: true });
cpSync(uiSource, uiTarget, { recursive: true });

console.log(`UI assets synced from ${uiSource} to ${uiTarget}`);