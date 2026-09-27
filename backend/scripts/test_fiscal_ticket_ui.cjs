const { chromium } = require('D:/Archivos personales/Codigo/NEWLAB/.agents/skills/playwright-skill/node_modules/playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const page = await context.newPage();

    // 1. Login como admin
    await page.goto('http://localhost:5250/login');
    await page.waitForSelector('.demo-cred');
    await page.click('.demo-cred');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1200);

    // 2. Ir a Resumen y reimprimir movimiento 13
    await page.goto('http://localhost:5250/caja-gastos?tab=resumen', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Click en el botón de reimprimir comprobante
    const printBtn = await page.waitForSelector('button[title*="Reimprimir"]', { timeout: 5000 });
    await printBtn.click();
    await page.waitForTimeout(1000);

    // Screenshot del modal de comprobante fiscal actualizado
    const shotModal = path.join('C:', 'Users', 'Junn', '.gemini', 'antigravity', 'brain', '2bd1d5fc-8083-4ed8-82a1-addf82f5b220', 'comprobante_fiscal_arequipa_audit.png');
    await page.screenshot({ path: shotModal });

    // 3. Ir a Registro para comprobar el aviso SUNAT de RUC 20
    await page.goto('http://localhost:5250/caja-gastos?tab=registro', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // Seleccionar primer pedido y cambiar a Boleta para ver el aviso de RUC 20 si aplica
    const firstOrder = await page.waitForSelector('.pedidos-order-card', { timeout: 5000 });
    await firstOrder.click();
    await page.waitForTimeout(800);

    const boletaBtn = await page.waitForSelector('button[title*="Boleta"]', { timeout: 5000 });
    await boletaBtn.click();
    await page.waitForTimeout(800);

    const shotAviso = path.join('C:', 'Users', 'Junn', '.gemini', 'antigravity', 'brain', '2bd1d5fc-8083-4ed8-82a1-addf82f5b220', 'aviso_sunat_ruc20_audit.png');
    await page.screenshot({ path: shotAviso });

    await browser.close();
    console.log('Fiscal audit screenshots completed successfully.');
})();
