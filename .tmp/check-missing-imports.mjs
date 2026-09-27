import { execSync } from 'node:child_process';
import path from 'node:path';

const files = execSync('git ls-tree -r origin/main --name-only frontend/src', {
  encoding: 'utf8',
})
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);

const set = new Set(files);
const importRe =
  /from\s+['"](\.\.?\/[^'"]+)['"]|import\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;
const missing = [];

for (const file of files) {
  if (!/\.(jsx?|tsx?|mjs|css)$/.test(file)) continue;
  let src;
  try {
    src = execSync(`git show origin/main:${file}`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    continue;
  }

  let match;
  while ((match = importRe.exec(src))) {
    const raw = match[1] || match[2];
    if (!raw.startsWith('.')) continue;
    const resolved = path.posix.normalize(
      path.posix.join(path.posix.dirname(file.replace(/\\/g, '/')), raw),
    );
    const candidates = [
      resolved,
      `${resolved}.js`,
      `${resolved}.jsx`,
      `${resolved}.ts`,
      `${resolved}.tsx`,
      `${resolved}.css`,
      `${resolved}.svg`,
      `${resolved}/index.js`,
      `${resolved}/index.jsx`,
    ];
    if (!candidates.some((candidate) => set.has(candidate))) {
      missing.push(`${file} -> ${raw}`);
    }
  }
}

console.log(missing.length ? missing.join('\n') : 'NONE');
console.log(`count ${missing.length}`);
