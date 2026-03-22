const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Desktop viewport
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }});
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/');
  await page.goto('http://localhost:5173/');
  
  await page.waitForTimeout(3000);
  
  try {
      const productCard = await page.locator('.card:has-text("Corona Disilicato")').first();
      let orderButton = await productCard.locator('button:has-text("Solicitar")').first();
      
      if (!await orderButton.isVisible()) {
          orderButton = await page.locator('button:has-text("Solicitar")').first();
      }

      await orderButton.click();
      await page.waitForSelector('.order-modal-layout-v2', { state: 'visible', timeout: 5000 });
      await page.waitForTimeout(1000);

      await page.screenshot({ path: '/tmp/modal-desktop-debug.png' });
      console.log('Saved screenshot to /tmp/modal-desktop-debug.png');

      const metrics = await page.evaluate(() => {
          const getBox = sel => {
              const el = document.querySelector(sel);
              if (!el) return null;
              const rect = el.getBoundingClientRect();
              return { width: rect.width, height: rect.height };
          };
          return {
              bento: getBox('.order-modal-bento-v2'),
              form: getBox('.order-modal-fields-v2'),
              odonto: getBox('.order-modal-odonto-v2'),
              svg: getBox('.odontograma-svg')
          };
      });
      console.log(JSON.stringify(metrics, null, 2));

  } catch (e) {
      console.log('Error:', e.message);
      await page.screenshot({ path: '/tmp/modal-desktop-error.png' });
  }

  await browser.close();
})();
