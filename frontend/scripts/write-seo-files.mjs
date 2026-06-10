import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');

const origin = String(process.env.VITE_SITE_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');

const paths = [
    '/',
    '/coronas-cad-cam-arequipa',
    '/zirconia-dental-arequipa',
    '/disilicato-emax-arequipa',
    '/guias-quirurgicas-dentales-arequipa',
    '/protesis-sobre-implantes-arequipa',
    '/impresion-3d-dental-arequipa',
    '/flujo-digital',
    '/para-clinicas',
    '/contacto',
    '/politica-de-privacidad',
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
    .map(
        (p) => `  <url>
    <loc>${origin}${p}</loc>
    <changefreq>weekly</changefreq>
    <priority>${p === '/' ? '1.0' : '0.8'}</priority>
  </url>`,
    )
    .join('\n')}
</urlset>
`;

const robots = `User-agent: *
Allow: /

# Rutas del portal y backoffice (no destinadas a indexación comercial)
Disallow: /login
Disallow: /dashboard
Disallow: /clinicas
Disallow: /productos
Disallow: /almacen
Disallow: /pedidos
Disallow: /finanzas
Disallow: /caja-gastos
Disallow: /calendario
Disallow: /mi-calendario
Disallow: /catalogo
Disallow: /cuenta
Disallow: /equipo

Sitemap: ${origin}/sitemap.xml
`;

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap.trim() + '\n', 'utf8');
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots.trim() + '\n', 'utf8');

// eslint-disable-next-line no-console
console.log(`[write-seo-files] Wrote sitemap.xml and robots.txt using origin: ${origin}`);
