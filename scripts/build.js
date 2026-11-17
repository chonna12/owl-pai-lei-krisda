// Build the plain HTML/CSS/JavaScript frontend into the public dist directory.
import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, 'frontend');
const output = resolve(root, 'dist');
const publicTypes = new Set(['.html', '.css', '.js', '.mjs', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf']);
const files = new Map();

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (entry.isFile() && publicTypes.has(extname(entry.name).toLowerCase())) {
      if (/\.m?js$/.test(entry.name)) {
        const check = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
        if (check.status !== 0) throw new Error(check.stderr || `Invalid JavaScript: ${entry.name}`);
      }
      files.set(relative(source, path).replaceAll('\\', '/'), await readFile(path));
    }
  }
}
await collect(source);
if (!files.has('index.html')) throw new Error('frontend/index.html is required');

// Update local asset versions when their contents change, without editing source files.
for (const [name, contents] of files) {
  if (!name.endsWith('.html')) continue;
  const html = contents.toString('utf8').replace(/(\b(?:src|href)=['"])([^'"?#]+)(?:\?[^'"#]*)?(['"])/g,
    (match, prefix, asset, quote) => {
      const key = relative(source, resolve(source, dirname(name), asset)).replaceAll('\\', '/');
      const data = files.get(key);
      if (!data || asset.startsWith('/') || asset.includes(':')) return match;
      const version = createHash('sha256').update(data).digest('hex').slice(0, 12);
      return `${prefix}${asset}?v=${version}${quote}`;
    });
  files.set(name, Buffer.from(html));
}

// Only replace the fixed dist folder inside this project after validation passes.
if (relative(root, output) !== 'dist') throw new Error('Unexpected build output directory');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const [name, contents] of files) {
  const destination = resolve(output, name);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, contents);
}
console.log(`Built ${files.size} public files in dist/`);
