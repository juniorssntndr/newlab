import { chromium } from 'file:///D:/Archivos personales/Codigo/NEWLAB/.agents/skills/playwright-skill/node_modules/playwright-core/index.mjs';

async function takeScreenshots() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();

    // 1. Iniciar sesión con admin@newlab.pe
    await page.goto('http://localhost:5250/login', { waitUntil: 'networkidle' });
    
    const adminBtn = await page.$('button:has-text("admin@newlab.pe")');
    if (adminBtn) {
        await adminBtn.click();
    } else {
        await page.fill('input[type="email"]', 'admin@newlab.pe');
        await page.fill('input[type="password"]', 'admin123');
    }
    await page.click('button[type="submit"]');

    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 8000 });

    // 2. Ir a la Ruleta Kiosko (/ruleta-evento)
    await page.goto('http://localhost:5250/ruleta-evento', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:/Users/Junn/.gemini/antigravity/brain/f7aab9bf-1d16-4735-b1a1-724ac05ecc28/scratch/ruleta_kiosko_v4.png' });
    console.log('Saved scratch/ruleta_kiosko_v4.png');

    // 3. Ir al módulo de Marketing
    await page.goto('http://localhost:5250/marketing', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.keyboard.press('Escape');
    const closeBtn = await page.$('.campaign-flyer-card button, .modal-close, button[aria-label="Cerrar"]');
    if (closeBtn) {
        await closeBtn.click().catch(() => {});
    }
    await page.waitForTimeout(500);

    const ruletaTab = await page.$('button:has-text("Ruleta")');
    if (ruletaTab) {
        await ruletaTab.click({ force: true });
        await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: 'C:/Users/Junn/.gemini/antigravity/brain/f7aab9bf-1d16-4735-b1a1-724ac05ecc28/scratch/ruleta_customizer_v4.png' });
    console.log('Saved scratch/ruleta_customizer_v4.png');

    await browser.close();
}

takeScreenshots().catch(console.error);
