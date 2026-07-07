import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANONICAL_SITE_ORIGIN, INDEXABLE_SITE_PATHS } from '../src/config/seoConstants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');

const origin = CANONICAL_SITE_ORIGIN.replace(/\/+$/, '');
const paths = INDEXABLE_SITE_PATHS;

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

Sitemap: ${origin}/sitemap.xml
`;

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap.trim() + '\n', 'utf8');
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots.trim() + '\n', 'utf8');

// eslint-disable-next-line no-console
console.log(`[write-seo-files] Wrote sitemap.xml and robots.txt using origin: ${origin}`);
