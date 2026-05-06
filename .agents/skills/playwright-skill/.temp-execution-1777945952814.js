const { chromium } = require('playwright');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:5173/';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });

  const logs = [];
  page.on('console', (message) => logs.push(`${message.type()}: ${message.text()}`));

  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.locator('.affinix-workflow').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  const initial = await page.evaluate(() => {
    const section = document.querySelector('.affinix-workflow');
    const grid = document.querySelector('.affinix-workflow-grid');
    const progress = document.querySelector('.affinix-workflow-progress');
    const firstIcon = document.querySelector('.affinix-workflow-step-icon');
    const firstButton = document.querySelector('.affinix-workflow-step-icon-button');
    const firstCard = document.querySelector('.affinix-workflow-card');
    const fill = document.querySelector('.affinix-workflow-progress-fill');
    const progressRect = progress?.getBoundingClientRect();
    const rect = firstIcon?.getBoundingClientRect();
    const centerX = rect ? rect.left + rect.width / 2 : 0;
    const centerY = rect ? rect.top + rect.height / 2 : 0;
    const topElement = document.elementFromPoint(centerX, centerY);

    return {
      path: window.location.pathname,
      sectionTop: section?.getBoundingClientRect().top,
      gridZIndex: grid ? getComputedStyle(grid).zIndex : null,
      progressZIndex: progress ? getComputedStyle(progress).zIndex : null,
      cardZIndex: firstCard ? getComputedStyle(firstCard).zIndex : null,
      buttonZIndex: firstButton ? getComputedStyle(firstButton).zIndex : null,
      iconZIndex: firstIcon ? getComputedStyle(firstIcon).zIndex : null,
      iconBackground: firstIcon ? getComputedStyle(firstIcon).backgroundColor : null,
      fillTransform: fill ? getComputedStyle(fill).transform : null,
      iconCenterX: rect ? rect.left + rect.width / 2 : null,
      progressCenterX: progressRect ? progressRect.left + progressRect.width / 2 : null,
      topElementClass: topElement?.className || topElement?.tagName,
    };
  });

  await page.screenshot({ path: 'C:/Users/Junn/AppData/Local/Temp/opencode/affinix-workflow-mobile-initial.png', fullPage: false });

  await page.mouse.wheel(0, 720);
  await page.waitForTimeout(800);

  const afterScroll = await page.evaluate(() => {
    const fill = document.querySelector('.affinix-workflow-progress-fill');
    const activeCard = document.querySelector('.affinix-workflow-card.is-active');
    const activeIcon = activeCard?.querySelector('.affinix-workflow-step-icon');
    return {
      fillTransform: fill ? getComputedStyle(fill).transform : null,
      activeStep: activeCard?.getAttribute('data-step') || activeCard?.textContent?.trim().slice(0, 40),
      activeIconBackground: activeIcon ? getComputedStyle(activeIcon).backgroundColor : null,
    };
  });

  await page.screenshot({ path: 'C:/Users/Junn/AppData/Local/Temp/opencode/affinix-workflow-mobile-scrolled.png', fullPage: false });

  console.log(JSON.stringify({ initial, afterScroll, consoleLogs: logs.slice(-10) }, null, 2));

  await browser.close();
})();
