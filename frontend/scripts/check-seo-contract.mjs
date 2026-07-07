import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_SITE_ORIGIN, INDEXABLE_SITE_PATHS } from '../src/config/seoConstants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const sitemapPath = path.join(publicDir, 'sitemap.xml');
const robotsPath = path.join(publicDir, 'robots.txt');

const PRIVATE_ROUTE_SEGMENTS = new Set([
    'login',
    'dashboard',
    'pedidos',
    'admin',
    'clinicas',
    'productos',
    'almacen',
    'finanzas',
    'caja-gastos',
    'calendario',
    'mi-calendario',
    'catalogo',
    'cuenta',
    'equipo',
]);

const readText = (filePath) => fs.readFileSync(filePath, 'utf8');

const extractLocs = (sitemap) => [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

const getFirstPathSegment = (url) => {
    const { pathname } = new URL(url);
    return pathname.split('/').filter(Boolean)[0] || '';
};

const normalizeRobotsPath = (value) => value.trim().replace(/\*.*$/, '').replace(/\$$/, '');

const isBlockedByDisallow = (publicPath, disallowPath) => {
    if (!disallowPath) return false;
    if (disallowPath === '/') return true;
    return publicPath === disallowPath || publicPath.startsWith(`${disallowPath.replace(/\/+$/, '')}/`);
};

const run = () => {
    assert.equal(CANONICAL_SITE_ORIGIN, 'https://www.affinixlab.com');

    const sitemap = readText(sitemapPath);
    const robots = readText(robotsPath);
    const combined = `${sitemap}\n${robots}`;

    assert.equal(/localhost/i.test(combined), false, 'SEO files must not contain localhost URLs');

    const expectedUrls = INDEXABLE_SITE_PATHS.map((sitePath) => `${CANONICAL_SITE_ORIGIN}${sitePath}`);
    const actualUrls = extractLocs(sitemap);

    assert.deepEqual(actualUrls, expectedUrls, 'sitemap.xml must contain exactly the canonical public URL set');
    assert.equal(actualUrls.every((url) => url.startsWith(CANONICAL_SITE_ORIGIN)), true);
    assert.equal(
        actualUrls.some((url) => PRIVATE_ROUTE_SEGMENTS.has(getFirstPathSegment(url))),
        false,
        'sitemap.xml must not contain private application routes',
    );

    assert.equal(
        robots.includes(`Sitemap: ${CANONICAL_SITE_ORIGIN}/sitemap.xml`),
        true,
        'robots.txt must point to the canonical sitemap URL',
    );
    assert.equal(
        [...PRIVATE_ROUTE_SEGMENTS].some((segment) => new RegExp(`(^|\\n)\\s*(?:Allow|Disallow):\\s*/${segment}(?:$|[/?#\\s])`, 'i').test(robots)),
        false,
        'robots.txt must not advertise private application routes',
    );

    const disallowedPaths = robots
        .split('\n')
        .map((line) => line.match(/^\s*Disallow:\s*(.+?)\s*$/i)?.[1])
        .filter(Boolean)
        .map(normalizeRobotsPath);

    for (const publicPath of INDEXABLE_SITE_PATHS) {
        assert.equal(
            disallowedPaths.some((disallowPath) => isBlockedByDisallow(publicPath, disallowPath)),
            false,
            `robots.txt must not block public SEO path: ${publicPath}`,
        );
    }

    console.log('ok - seo indexing contract');
};

run();
