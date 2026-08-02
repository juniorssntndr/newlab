import fs from 'fs';
import {
  ARCH_ORDER,
  buildItemSelection,
  buildBridgeRange,
  isVeneerProduct,
  isMolarTooth,
  normalizeBridgePillars,
} from '../src/utils/odontograma.js';
import {
  AFFINITY_TEETH,
  buildAffinityToothCenters,
} from '../src/components/odontogramaAffinityShapes.js';

const svg = fs.readFileSync(
  new URL('../src/assets/odontograma/odontograma-affinity.svg', import.meta.url),
  'utf8'
);

const toothIds = [...svg.matchAll(/id="tooth-(\d{2})"/g)].map((m) => m[1]);
const dataAttrs = [...svg.matchAll(/data-tooth-code="(\d{2})"/g)].map((m) => m[1]);

const errors = [];
if (toothIds.length !== 32) errors.push(`svg tooth ids ${toothIds.length}`);
if (dataAttrs.length !== 32) errors.push(`data-attrs ${dataAttrs.length}`);
if (/Mesa-de-trabajo/.test(svg)) errors.push('artboard still present');
if (/serif:id/.test(svg)) errors.push('serif ids still present');

const centers = buildAffinityToothCenters();
if (!ARCH_ORDER.every((c) => centers[c] && AFFINITY_TEETH[c])) {
  errors.push('missing centers/paths');
}

let sel = buildItemSelection(['11'], false);
if (sel.piezas_dentales.join(',') !== '11' || sel.es_puente) errors.push('click 11 payload');

sel = buildItemSelection(['11', '12', '13'], false);
sel = buildItemSelection(sel.piezas_dentales.filter((t) => t !== '12'), false);
if (sel.piezas_dentales.join(',') !== '13,11') errors.push(`chip remove got ${sel.piezas_dentales.join(',')}`);

const range = buildBridgeRange('13', '16');
sel = buildItemSelection(range, true);
if (!sel.es_puente || sel.pilares_dentales.length < 2) errors.push('bridge payload');

const pillars = normalizeBridgePillars(sel.piezas_dentales, sel.pilares_dentales);
if (pillars.length < 2) errors.push('bridge pillars');

const veneerProduct = { nombre: 'Carilla de feldespato' };
const disabled = isVeneerProduct(veneerProduct) ? ARCH_ORDER.filter(isMolarTooth) : [];
if (!isVeneerProduct(veneerProduct) || disabled.length !== 12) {
  errors.push(`veneer disabled ${disabled.length}`);
}

if (errors.length) {
  console.error('FAIL', errors);
  process.exit(1);
}

console.log('OK affinity odontograma verification');
console.log({
  teeth: toothIds.length,
  bridge: `${sel.pieza_inicio}-${sel.pieza_fin}`,
  veneerDisabled: disabled.length,
});
