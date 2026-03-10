const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true }); // headless for faster inspection
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }});
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/');
  await page.goto('http://localhost:5173/');
  
  // Wait a bit for potential redirects or renders
  await page.waitForTimeout(3000);
  console.log('Current URL:', page.url());

  // Try to find an input item or something that triggers the modal, like "Coronas" or "Solicitar"
  // The user clicked on "Corona Disilicato"
  try {
      // Find the card containing Corona Disilicato
      const productCard = await page.locator('.card:has-text("Corona Disilicato")').first();
      // Or just any "Solicitar" button if not found
      let orderButton = await productCard.locator('button:has-text("Solicitar")').first();
      
      if (!await orderButton.isVisible()) {
          console.log("Could not find specific product, clicking the first Solicitar button...");
          orderButton = await page.locator('button:has-text("Solicitar")').first();
      }

      await orderButton.click();
      console.log('Clicked "Solicitar" button. Waiting for modal...');
      
      await page.waitForSelector('.order-modal-layout-v2', { state: 'visible', timeout: 5000 });
      await page.waitForTimeout(1000); // let animations settle

      await page.screenshot({ path: '/tmp/modal-mobile-debug.png', fullPage: true });
      console.log('Saved screenshot to /tmp/modal-mobile-debug.png');

      // Extract geometry
      const metrics = await page.evaluate(() => {
          const getBox = sel => {
              const el = document.querySelector(sel);
              if (!el) return null;
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              return {
                  y: rect.y,
                  height: rect.height,
                  order: style.order,
                  position: style.position,
                  marginTop: style.marginTop,
                  transform: style.transform,
                  overflowY: style.overflowY
              };
          };
          return {
              form: getBox('.order-modal-fields-v2'),
              odonto: getBox('.order-modal-odonto-v2'),
              svg: getBox('.odontograma-svg'),
              bento: getBox('.order-modal-bento-v2'),
              modalBody: getBox('.modal-body')
          };
      });

      console.log(JSON.stringify(metrics, null, 2));

  } catch (e) {
      console.log('Error during interaction:', e.message);
      await page.screenshot({ path: '/tmp/modal-mobile-error.png', fullPage: true });
  }

  await browser.close();
})();
