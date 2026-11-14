// Run against dist served on port 3000 with Playwright installed.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ colorScheme: 'dark' });
    await context.route('https://**', route => route.abort());
    const page = await context.newPage();
    await page.goto(process.env.TEST_BASE_URL || 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
    const theme = () => page.locator('html').getAttribute('data-theme');
    await page.waitForFunction(() => document.body.dataset.auth !== 'loading');
    assert.equal(await theme(), 'dark');
    assert.equal(await page.locator('.theme-control:visible').getAttribute('data-preference'), 'system');
    assert.equal(await page.locator('.theme-control:visible').textContent(), '');
    await page.locator('.theme-control:visible').click();
    assert.equal(await theme(), 'light');
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await theme(), 'light');
    await page.locator('.theme-control:visible').click();
    await page.emulateMedia({ colorScheme: 'light' });
    assert.equal(await theme(), 'dark');
    await page.locator('.theme-control:visible').click();
    assert.equal(await theme(), 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    const other = await context.newPage();
    await other.goto(process.env.TEST_BASE_URL || 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await other.waitForFunction(() => document.body.dataset.auth !== 'loading');
    await other.locator('.theme-control:visible').click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.setViewportSize({ width: 375, height: 812 });
    assert(await page.locator('.theme-control:visible').isVisible());
    const box = await page.locator('.theme-control:visible').boundingBox();
    assert(box.x >= 0 && box.x + box.width <= 375);
    await context.close();
    const blocked = await browser.newContext({ colorScheme: 'dark' });
    await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } }); });
    await blocked.route('https://**', route => route.abort());
    const privatePage = await blocked.newPage();
    await privatePage.goto(process.env.TEST_BASE_URL || 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
    assert.equal(await privatePage.locator('html').getAttribute('data-theme'), 'dark');
    await privatePage.locator('.theme-control').first().dispatchEvent('click');
    assert.equal(await privatePage.locator('html').getAttribute('data-theme'), 'light');
    await blocked.close();
    console.log('Theme browser checks passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
