const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch({ headless: false });

  const viewports = [
    { name: '390x844', width: 390, height: 844 },
    { name: '768x1024', width: 768, height: 1024 },
    { name: '1440x900', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    console.log(`\n📐 Testing ${vp.name} (${vp.width}x${vp.height})`);
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    try {
      await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 15000 });
    } catch (e) {
      try {
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
      } catch (e2) {
        console.log(`  ❌ Failed: ${e2.message}`);
        await page.close();
        continue;
      }
    }

    // Horizontal scroll check
    const hasHScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    // Check CTA text
    const ctaText = await page.evaluate(() => {
      const el = document.querySelector('.affinix-login-link');
      return el ? el.textContent.trim() : 'NOT FOUND';
    });

    // Check topbar exists
    const topbarExists = await page.evaluate(() => {
      return !!document.querySelector('.affinix-topbar');
    });

    // Check footer channels
    const footerChanCount = await page.evaluate(() => {
      return document.querySelectorAll('.affinix-footer-chan').length;
    });

    // Test anchors - check scrollY
    const anchorOffsets = {};
    for (const anchor of ['#servicios', '#flujo', '#nosotros']) {
      try {
        await page.goto(`${TARGET_URL}${anchor}`, { waitUntil: 'domcontentloaded', timeout: 6000 });
        await page.waitForTimeout(300);
        anchorOffsets[anchor] = await page.evaluate(() => window.scrollY);
      } catch (e) {
        anchorOffsets[anchor] = 'failed';
      }
    }

    // Go back and screenshot
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 8000 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `/tmp/affinix-redesign-${vp.name}.png`,
      fullPage: false,
    });

    console.log(`  📸 Screenshot: /tmp/affinix-redesign-${vp.name}.png`);
    console.log(`  ↔️ Horizontal scroll: ${hasHScroll ? 'YES ❌' : 'NO ✅'}`);
    console.log(`  🔘 CTA text: "${ctaText}" ${ctaText.includes('portal') ? '✅' : '❌'}`);
    console.log(`  📊 Topbar visible: ${topbarExists ? 'YES ✅' : 'NO'}`);
    console.log(`  📞 Footer channels: ${footerChanCount} items`);
    console.log(`  📍 Anchors scrollY: #servicios=${anchorOffsets['#servicios']}, #flujo=${anchorOffsets['#flujo']}, #nosotros=${anchorOffsets['#nosotros']}`);

    await page.close();
  }

  console.log('\n✅ All viewports tested');
  await browser.close();
})();