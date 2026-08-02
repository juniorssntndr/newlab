import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = fs.readFileSync('c:/Users/Junn/Downloads/odontograma.svg', 'utf8');
const viewBox = (raw.match(/viewBox="([^"]+)"/) || [])[1];

const teeth = {};

const groupRe = /<g[^>]*id="_(\d{2})"[^>]*>([\s\S]*?)<\/g>/g;
let m;
while ((m = groupRe.exec(raw))) {
  const code = m[1];
  const pathMatch = m[2].match(/\sd="([^"]+)"/);
  const transformMatch = m[0].match(/transform="([^"]+)"/);
  if (pathMatch) {
    teeth[code] = { d: pathMatch[1], transform: transformMatch?.[1] || null };
  }
}

const pathRe = /<path[^>]*id="_(\d{2})"[^>]*d="([^"]+)"[^>]*\/?>/g;
while ((m = pathRe.exec(raw))) {
  const code = m[1];
  if (!teeth[code]) teeth[code] = { d: m[2], transform: null };
}

const maxSup = raw.match(/<g id="maxilar-superior-"[\s\S]*?<\/g>/);
const maxInf = raw.match(/id="maxilar-inferior-"[^>]*d="([^"]+)"/);
const baseSup = raw.match(/id="base-superior-"[^>]*d="([^"]+)"/);
const maxSupPaths = [];
if (maxSup) {
  const re = /\sd="([^"]+)"/g;
  let p;
  while ((p = re.exec(maxSup[0]))) maxSupPaths.push(p[1]);
}

function parseMatrix(transform) {
  if (!transform) return null;
  const mm = transform.match(/matrix\(([^)]+)\)/);
  if (!mm) return null;
  const v = mm[1].split(/[\s,]+/).map(Number);
  if (v.length !== 6) return null;
  return { a: v[0], b: v[1], c: v[2], d: v[3], e: v[4], f: v[5] };
}

function applyMatrix(mat, x, y) {
  if (!mat) return { x, y };
  return {
    x: mat.a * x + mat.c * y + mat.e,
    y: mat.b * x + mat.d * y + mat.f,
  };
}

/** Bake SVG matrix into path so React/CSS never fight presentation transforms. */
function bakeTransformIntoPath(d, transform) {
  const mat = parseMatrix(transform);
  if (!mat) return d;

  return d.replace(
    /([MLCQmlcq])([^MLCQZmlcqz]*)/g,
    (segment, cmd, args) => {
      const nums = [...args.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map((x) => parseFloat(x[0]));
      if (!nums.length) return segment;
      const out = [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const p = applyMatrix(mat, nums[i], nums[i + 1]);
        out.push(Number(p.x.toFixed(3)), Number(p.y.toFixed(3)));
      }
      if (nums.length % 2 === 1) out.push(nums[nums.length - 1]);
      return `${cmd}${out.join(' ')}`;
    }
  );
}

function bboxFromPath(d, transform) {
  const baked = bakeTransformIntoPath(d, transform);
  const nums = [...baked.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)]
    .map((x) => parseFloat(x[0]))
    .filter((n) => Number.isFinite(n));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i];
    const y = nums[i + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    d: baked,
  };
}

const ARCH = [
  '18', '17', '16', '15', '14', '13', '12', '11',
  '21', '22', '23', '24', '25', '26', '27', '28',
  '38', '37', '36', '35', '34', '33', '32', '31',
  '41', '42', '43', '44', '45', '46', '47', '48',
];

const UPPER = ARCH.filter((c) => c.startsWith('1') || c.startsWith('2'));
const LOWER = ARCH.filter((c) => c.startsWith('3') || c.startsWith('4'));

const boxes = {};
for (const code of ARCH) {
  const tooth = teeth[code];
  if (!tooth) {
    console.error('Missing tooth', code);
    process.exit(1);
  }
  boxes[code] = bboxFromPath(tooth.d, tooth.transform);
}

function archCentroid(codes) {
  let sx = 0;
  let sy = 0;
  for (const code of codes) {
    sx += boxes[code].cx;
    sy += boxes[code].cy;
  }
  return { x: sx / codes.length, y: sy / codes.length };
}

const upperCenter = archCentroid(UPPER);
const lowerCenter = archCentroid(LOWER);

/** Push FDI label outside the tooth along the arch radial (away from arch center). */
function labelOutside(box, arch, isUpper) {
  let dx = box.cx - arch.x;
  let dy = box.cy - arch.y;
  // Bias like Godent: upper labels prefer above, lower prefer below (avoid inter-arch pile-up)
  if (isUpper) dy -= Math.abs(dx) * 0.55;
  else dy += Math.abs(dx) * 0.55;

  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;

  const halfW = Math.max((box.maxX - box.minX) / 2, 1);
  const halfH = Math.max((box.maxY - box.minY) / 2, 1);
  const edgeDist = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
  const pad = 48;

  return {
    x: Number((box.cx + dx * (edgeDist + pad)).toFixed(2)),
    y: Number((box.cy + dy * (edgeDist + pad)).toFixed(2)),
  };
}

const toothEntries = {};
for (const code of ARCH) {
  const box = boxes[code];
  const isUpper = code.startsWith('1') || code.startsWith('2');
  const label = labelOutside(box, isUpper ? upperCenter : lowerCenter, isUpper);
  toothEntries[code] = {
    d: box.d,
    transform: null,
    center: { x: Number(box.cx.toFixed(2)), y: Number(box.cy.toFixed(2)) },
    label,
  };
}

const outDir = path.resolve(__dirname, '../src/assets/odontograma');
fs.mkdirSync(outDir, { recursive: true });

// Content bounds + padding for labels / stroke
let contentMinX = Infinity;
let contentMinY = Infinity;
let contentMaxX = -Infinity;
let contentMaxY = -Infinity;
for (const code of ARCH) {
  const t = toothEntries[code];
  contentMinX = Math.min(contentMinX, t.center.x, t.label.x);
  contentMaxX = Math.max(contentMaxX, t.center.x, t.label.x);
  contentMinY = Math.min(contentMinY, t.center.y, t.label.y);
  contentMaxY = Math.max(contentMaxY, t.center.y, t.label.y);
  const box = bboxFromPath(teeth[code].d, teeth[code].transform);
  contentMinX = Math.min(contentMinX, box.minX);
  contentMaxX = Math.max(contentMaxX, box.maxX);
  contentMinY = Math.min(contentMinY, box.minY);
  contentMaxY = Math.max(contentMaxY, box.maxY);
}
const padX = 72;
const padY = 72;
const croppedViewBox = [
  Math.floor(contentMinX - padX),
  Math.floor(contentMinY - padY),
  Math.ceil(contentMaxX - contentMinX + padX * 2),
  Math.ceil(contentMaxY - contentMinY + padY * 2),
].join(' ');

// Clean SVG asset: baked absolute paths, no presentation transforms
const cleanParts = [
  `<svg width="100%" height="100%" viewBox="${croppedViewBox}" version="1.1" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="black" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">`,
];
for (const code of ARCH) {
  const tooth = toothEntries[code];
  cleanParts.push(
    `  <path id="tooth-${code}" data-tooth-code="${code}" class="tooth-outline" d="${tooth.d}" />`
  );
}
for (const d of maxSupPaths.filter((p) => p.length < 500)) {
  cleanParts.push(`  <path class="odontograma-arch-guide" d="${d}" stroke="#111" stroke-width="4" fill="none" />`);
}
if (baseSup) {
  cleanParts.push(`  <path class="odontograma-arch-outline" d="${baseSup[1]}" stroke="#111" stroke-width="4" fill="none" />`);
}
if (maxInf) {
  cleanParts.push(`  <path class="odontograma-arch-outline" d="${maxInf[1]}" stroke="#111" stroke-width="4" fill="none" />`);
}
cleanParts.push('</svg>\n');
fs.writeFileSync(path.join(outDir, 'odontograma-affinity.svg'), cleanParts.join('\n'));

const shapesPath = path.resolve(__dirname, '../src/components/odontogramaAffinityShapes.js');
const shapesSrc = `/* Auto-generated from Affinity odontograma.svg — do not hand-edit path data */
export const AFFINITY_VIEWBOX = '${croppedViewBox}';
export const AFFINITY_SOURCE_VIEWBOX = '${viewBox}';

export const AFFINITY_DECORATIONS = {
  maxilarSuperior: ${JSON.stringify(maxSupPaths, null, 2)},
  maxilarInferior: ${JSON.stringify(maxInf ? maxInf[1] : null)},
  baseSuperior: ${JSON.stringify(baseSup ? baseSup[1] : null)},
};

export const AFFINITY_TEETH = ${JSON.stringify(toothEntries, null, 2)};

export const AFFINITY_ARCH_ORDER = ${JSON.stringify(ARCH)};

export const buildAffinityToothCenters = () => {
  const centers = {};
  for (const code of AFFINITY_ARCH_ORDER) {
    centers[code] = AFFINITY_TEETH[code].center;
  }
  return centers;
};

export const buildAffinityToothLabels = () => {
  const labels = {};
  for (const code of AFFINITY_ARCH_ORDER) {
    labels[code] = AFFINITY_TEETH[code].label;
  }
  return labels;
};
`;

fs.writeFileSync(shapesPath, shapesSrc);

console.log('viewBox', viewBox, '→', croppedViewBox);
console.log('teeth', Object.keys(toothEntries).length);
console.log('wrote', shapesPath);
console.log('sample 11', toothEntries['11']);
console.log('sample 48', toothEntries['48']);
