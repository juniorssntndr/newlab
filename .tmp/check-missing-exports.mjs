import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const files = execSync('git ls-tree -r origin/main --name-only frontend/src', {
  encoding: 'utf8',
})
  .trim()
  .split(/\r?\n/)
  .filter((f) => /\.(jsx?|mjs)$/.test(f));

const namedImportRe =
  /import\s*\{([^}]+)\}\s*from\s*['"](\.\.?\/[^'"]+)['"]/g;
const exportNameRe =
  /export\s+(?:async\s+)?(?:function|const|class|let|var)\s+([A-Za-z0-9_]+)|export\s*\{([^}]+)\}/g;

function resolveModule(fromFile, raw) {
  const base = path.posix.normalize(
    path.posix.join(path.posix.dirname(fromFile), raw),
  );
  for (const candidate of [
    base,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.js`,
    `${base}/index.jsx`,
  ]) {
    try {
      execSync(`git cat-file -e origin/main:${candidate}`, { stdio: 'ignore' });
      return candidate;
    } catch {
      // continue
    }
  }
  return null;
}

function getExports(file) {
  const src = execSync(`git show origin/main:${file}`, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  const names = new Set();
  let match;
  while ((match = exportNameRe.exec(src))) {
    if (match[1]) names.add(match[1]);
    if (match[2]) {
      match[2].split(',').forEach((part) => {
        const cleaned = part.trim().split(/\s+as\s+/).pop().trim();
        if (cleaned) names.add(cleaned);
      });
    }
  }
  return names;
}

const problems = [];
for (const file of files) {
  const src = execSync(`git show origin/main:${file}`, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  let match;
  while ((match = namedImportRe.exec(src))) {
    const names = match[1]
      .split(',')
      .map((part) => part.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    const mod = resolveModule(file, match[2]);
    if (!mod) {
      problems.push(`${file}: missing module ${match[2]}`);
      continue;
    }
    const exports = getExports(mod);
    for (const name of names) {
      if (name === 'default') continue;
      if (!exports.has(name)) {
        problems.push(`${file}: ${name} not exported by ${mod}`);
      }
    }
  }
}

console.log(problems.length ? problems.join('\n') : 'NONE');
console.log(`count ${problems.length}`);
