/**
 * Genera favicons e iconos desde los isotipos oficiales (assets/branding).
 * - iso-light.png → ISO claro (azules): iconos principales por defecto (.ico, .png, apple-touch, svg) para visualizarse correctamente en fondos claros (ej. resultados de Google).
 * - iso-dark.png → ISO oscuro (blanco + azul): únicamente para favicon-dark en pestañas de modo oscuro.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const isoDarkPath = path.join(root, 'src/assets/branding/iso-dark.png');
const isoLightPath = path.join(root, 'src/assets/branding/iso-light.png');
const publicDir = path.join(root, 'public');
/** Fondo para encajar en canvas cuadrado (misma base que el arte oficial). */
const bgBlack = { r: 0, g: 0, b: 0, alpha: 1 };

async function squarePngBuffer(srcPath, size) {
    return sharp(srcPath).resize(size, size, { fit: 'contain', background: bgBlack }).png().toBuffer();
}

async function squarePngFile(srcPath, size, outName) {
    const outPath = path.join(publicDir, outName);
    await sharp(srcPath).resize(size, size, { fit: 'contain', background: bgBlack }).png().toFile(outPath);
    return outPath;
}

async function writeSvgFromPng32() {
    const pngPath = path.join(publicDir, 'icon-32x32.png');
    const buf = fs.readFileSync(pngPath);
    const b64 = buf.toString('base64');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="32" height="32" viewBox="0 0 32 32" role="img" aria-label="AFINIX Dental Lab">
  <image width="32" height="32" href="data:image/png;base64,${b64}" />
</svg>
`;
    fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svg.trim() + '\n', 'utf8');
}

async function main() {
    if (!fs.existsSync(isoDarkPath)) {
        throw new Error(`Missing isotype: ${isoDarkPath}`);
    }
    if (!fs.existsSync(isoLightPath)) {
        throw new Error(`Missing isotype: ${isoLightPath}`);
    }
    fs.mkdirSync(publicDir, { recursive: true });

    // Los iconos principales y por defecto se generan desde el ISO claro (iso-light.png)
    // para que se vean correctamente en fondos claros (como los resultados de búsqueda de Google y pestañas).
    await squarePngFile(isoLightPath, 32, 'icon-32x32.png');
    await squarePngFile(isoLightPath, 192, 'icon-192x192.png');
    await squarePngFile(isoLightPath, 180, 'apple-touch-icon.png');

    await squarePngFile(isoDarkPath, 48, 'favicon-dark.png');
    await squarePngFile(isoLightPath, 48, 'favicon-light.png');

    const buf48 = await squarePngBuffer(isoLightPath, 48);
    const buf32 = await squarePngBuffer(isoLightPath, 32);
    const icoBuffer = await pngToIco([buf48, buf32]);
    fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);

    await writeSvgFromPng32();

    // eslint-disable-next-line no-console
    console.log(
        '[generate-favicons] icon-32x32, icon-192x192, apple-touch-icon, favicon.ico, favicon.svg, favicon-light/dark (from official ISO PNGs)',
    );
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
});
