import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = resolve(__filename, '../../');

const targets = [
  join(rootDir, 'backend/src'),
  join(rootDir, 'frontend'),
  join(rootDir, 'scripts'),
  join(rootDir, 'test')
];

function getJsFiles(dir) {
  const files = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...getJsFiles(fullPath));
      } else if (entry.endsWith('.js') || entry.endsWith('.mjs')) {
        files.push(fullPath);
      }
    }
  } catch (_) {}
  return files;
}

const jsFiles = targets.flatMap(getJsFiles);
let errors = 0;
const debuggerRegex = new RegExp('\\b' + 'debugger' + '\\b');

console.log(`[LINT] Checking ${jsFiles.length} JavaScript files...`);

for (const file of jsFiles) {
  // 1. Syntax check
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (check.status !== 0) {
    console.error(`[SYNTAX ERROR] in ${file}:\n${check.stderr}`);
    errors++;
    continue;
  }

  // 2. Disallow stray debugger statements (except in lint.js itself)
  if (file !== __filename) {
    const content = readFileSync(file, 'utf8');
    if (debuggerRegex.test(content)) {
      console.error(`[LINT ERROR] Stray debugger statement found in ${file}`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n❌ Lint failed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log(`✅ All ${jsFiles.length} files passed syntax and lint checks.`);
  process.exit(0);
}
