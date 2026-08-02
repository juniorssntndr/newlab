import { AFFINITY_TEETH, AFFINITY_ARCH_ORDER } from '../src/components/odontogramaAffinityShapes.js';

function approxBBox(d) {
  const nums = [...d.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map((x) => parseFloat(x[0]));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]);
    maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]);
    maxY = Math.max(maxY, nums[i + 1]);
  }
  return { minX, minY, maxX, maxY };
}

const inside = [];
const samples = {};
for (const code of AFFINITY_ARCH_ORDER) {
  const t = AFFINITY_TEETH[code];
  const b = approxBBox(t.d);
  const { x, y } = t.label;
  const isInside = x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
  if (isInside) inside.push(code);
  if (['11', '18', '28', '31', '41', '48'].includes(code)) {
    samples[code] = { label: t.label, box: b, outside: !isInside };
  }
}

if (inside.length) {
  console.error('FAIL labels inside teeth:', inside.join(','));
  process.exit(1);
}

console.log('OK all 32 FDI labels outside tooth bbox');
console.log(JSON.stringify(samples, null, 2));
