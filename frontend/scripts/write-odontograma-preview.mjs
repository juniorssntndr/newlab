import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AFFINITY_VIEWBOX,
  AFFINITY_TEETH,
  AFFINITY_ARCH_ORDER,
  AFFINITY_DECORATIONS,
} from '../src/components/odontogramaAffinityShapes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const guides = (AFFINITY_DECORATIONS.maxilarSuperior || [])
  .filter((d) => d.length < 500)
  .map((d) => `<path class="guide" d="${d}" />`)
  .join('\n');

const outlines = [
  AFFINITY_DECORATIONS.baseSuperior,
  AFFINITY_DECORATIONS.maxilarInferior,
]
  .filter(Boolean)
  .map((d) => `<path class="outline" d="${d}" />`)
  .join('\n');

const teeth = AFFINITY_ARCH_ORDER.map((code) => {
  const t = AFFINITY_TEETH[code];
  return `<g data-tooth="${code}">
  <path class="tooth" d="${t.d}" />
  <text class="fdi" x="${t.label.x}" y="${t.label.y}" text-anchor="middle" dominant-baseline="middle">${code}</text>
</g>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Odontograma Affinity preview</title>
  <style>
    :root {
      --color-text: #0A1B33;
      --color-text-secondary: #475569;
      --color-text-tertiary: #94A3B8;
      --color-surface: #FFFFFF;
      --color-bg: #E6ECF2;
      --color-primary: #007BFF;
    }
    body { margin: 0; background: var(--color-bg); font-family: Inter, Segoe UI, system-ui, sans-serif; }
    .wrap { max-width: 520px; margin: 24px auto; padding: 16px; }
    svg { width: 100%; height: auto; display: block; background: transparent; }
    .tooth { fill: var(--color-surface); stroke: var(--color-text-secondary); stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
    .guide, .outline { fill: none; stroke: var(--color-text-secondary); stroke-width: 4; opacity: 0.92; stroke-linecap: round; stroke-linejoin: round; }
    .fdi { fill: var(--color-text-secondary); font-size: 44px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrap">
    <svg viewBox="${AFFINITY_VIEWBOX}" xmlns="http://www.w3.org/2000/svg">
      ${guides}
      ${outlines}
      ${teeth}
    </svg>
  </div>
</body>
</html>
`;

const out = path.resolve(__dirname, '../public/odontograma-preview.html');
fs.writeFileSync(out, html);
console.log('wrote', out);
