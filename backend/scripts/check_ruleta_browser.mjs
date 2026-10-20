import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('../../node_modules/jsonwebtoken');
const { chromium } = require('../../.agents/skills/playwright-skill/node_modules/playwright');

async function testRuleta() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleLogs = [];
    const pageErrors = [];

    page.on('console', msg => {
        consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
        pageErrors.push(err.message + '\n' + err.stack);
    });

    // Generate JWT token for admin
    const token = jwt.sign(
        { id: 1, email: 'afinixdentallab@gmail.com', tipo: 'admin', nombre: 'AFINIX Admin' },
        'newlab-dental-secret-key-2026',
        { expiresIn: '1h' }
    );

    await page.goto('http://localhost:5250/login');
    await page.evaluate((t) => {
        localStorage.setItem('nl_token', t);
        localStorage.setItem('afinix_user', JSON.stringify({
            id: 1,
            email: 'afinixdentallab@gmail.com',
            tipo: 'admin',
            nombre: 'AFINIX Admin'
        }));
    }, token);

    await page.goto('http://localhost:5250/marketing');
    await page.waitForTimeout(2000);

    // Click on tab Ruleta
    const ruletaTabButton = page.locator('button:has-text("Ruleta")');
    if (await ruletaTabButton.count() > 0) {
        console.log('Clicking Ruleta tab...');
        await ruletaTabButton.first().click();
        await page.waitForTimeout(2500);
    } else {
        console.log('Ruleta tab button not found directly!');
    }

    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    console.log('Page Errors:', pageErrors);
    console.log('Console Warning/Error logs:', consoleLogs.filter(l => l.type === 'error' || l.type === 'warning'));

    // Check if canvas is rendered
    const canvases = await page.locator('canvas').count();
    console.log('Canvases found:', canvases);

    // Get visible text around ruleta
    const bodyText = await page.innerText('body');
    console.log('Has "Sectores de la Ruleta":', bodyText.includes('Sectores de la Ruleta'));
    console.log('Has "Configurar Sectores":', bodyText.includes('Configurar Sectores'));
    console.log('Has "Vista Previa en Vivo":', bodyText.includes('Vista Previa en Vivo'));
    console.log('Has "pts":', bodyText.includes('pts'));

    // Take screenshot
    await page.screenshot({ path: 'C:/Users/Junn/.gemini/antigravity/brain/f7aab9bf-1d16-4735-b1a1-724ac05ecc28/scratch/ruleta_screenshot.png', fullPage: true });
    console.log('Screenshot saved to scratch/ruleta_screenshot.png');

    await browser.close();
}

testRuleta().catch(console.error);
