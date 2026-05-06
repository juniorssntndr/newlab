const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch({ headless: false });

  const viewports = [
    { name: '390x844', width: 390, height: 844 },
    { name: '768x1024', width: 768, height: 1024 },
    { name: '1366x768', width: 1366, height: 768 },
    { name: '1440x900', width: 1440, height: 900 },
    { name: '1920x1080', width: 1920, height: 1080 },
  ];

  for (const vp of viewports) {
    console.log(`\n📐 Testing ${vp.name} (${vp.width}x${vp.height})`);
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    try {
      await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 15000 });
    } catch (e) {
      console.log(`  ⚠️ Timeout waiting for networkidle, continuing anyway`);
      try {
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
      } catch (e2) {
        console.log(`  ❌ Failed to load page: ${e2.message}`);
        await page.close();
        continue;
      }
    }

    // Check for horizontal scroll
    const hasHScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    // Get scroll position before clicking anchors
    const scrollPositions = {};

    // Test anchor #servicios
    try {
      await page.goto(`${TARGET_URL}#servicios`, { waitUntil: 'domcontentloaded', timeout: 8000 });
      await page.waitForTimeout(500);
      scrollPositions['servicios'] = await page.evaluate(() => window.scrollY);
    } catch (e) {
      scrollPositions['servicios'] = 'failed';
    }

    // Test anchor #flujo
    try {
      await page.goto(`${TARGET_URL}#flujo`, { waitUntil: 'domcontentloaded', timeout: 8000 });
      await page.waitForTimeout(500);
      scrollPositions['flujo'] = await page.evaluate(() => window.scrollY);
    } catch (e) {
      scrollPositions['flujo'] = 'failed';
    }

    // Test anchor #nosotros
    try {
      await page.goto(`${TARGET_URL}#nosotros`, { waitUntil: 'domcontentloaded', timeout: 8000 });
      await page.waitForTimeout(500);
      scrollPositions['nosotros'] = await page.evaluate(() => window.scrollY);
    } catch (e) {
      scrollPositions['nosotros'] = 'failed';
    }

    // Go back to top for screenshot
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 8000 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `/tmp/affinix-landing-${vp.name}.png`,
      fullPage: false,
    });

    console.log(`  📸 Screenshot: /tmp/affinix-landing-${vp.name}.png`);
    console.log(`  ↔️ Horizontal scroll: ${hasHScroll ? 'YES ❌' : 'NO ✅'}`);
    console.log(`  📍 Anchor offsets (scrollY): #servicios=${scrollPositions['servicios']}, #flujo=${scrollPositions['flujo']}, #nosotros=${scrollPositions['nosotros']}`);

    await page.close();
  }

  console.log('\n✅ All viewports tested');
  await browser.close();
})();