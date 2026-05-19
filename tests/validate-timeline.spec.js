// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:9802';

const DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const BLACKLIST = [
  'Diversity Graduation Requirement',
  'Discovery Channel',
  '48 states',
  'Creating America',
  'Cruise Ship Scholar',
  'Knowledge Construction and Popular Culture',
  'Major Studio Consulting',
  'Intercultural Humor',
  'Civic Engagement as Multicultural',
];

async function openTimeline(page) {
  await page.goto(BASE_URL);
  if (await page.getByPlaceholder('Preview password').count()) {
    await page.getByPlaceholder('Preview password').fill('Carlos1234');
    await Promise.all([
      page.waitForURL('**/timeline', { timeout: 10000 }).catch(() => null),
      page.getByRole('button', { name: 'Enter' }).click(),
    ]);
  }
  await page.waitForSelector('#narrative-timeline', { timeout: 15000 });
}

test.describe('Dr. Cortés Interactive timeline', () => {
  test('loads the current scrollytelling experience', async ({ page }) => {
    await openTimeline(page);
    await expect(page).toHaveTitle(/Seven Decades of Bridge-Building/);
    await expect(page.locator('.lang-btn')).toHaveCount(3);
    await expect(page.locator('#ask')).toBeVisible();
    await expect(page.locator('#tts-audio')).toBeAttached();
  });

  test('renders all decade sections and 86 timeline entries', async ({ page }) => {
    await openTimeline(page);
    const headers = await page.locator('.decade-header h2').allTextContents();
    expect(headers).toEqual(DECADES);
    await expect(page.locator('.timeline-entry')).toHaveCount(86);
  });

  test('supports Spanish and Portuguese translation controls', async ({ page }) => {
    await openTimeline(page);
    await page.locator('button[data-lang="es"]').click();
    await expect(page.locator('[data-i18n="scroll_explore"]')).toHaveText('Desplázate para explorar');
    await page.locator('button[data-lang="pt"]').click();
    await expect(page.locator('[data-i18n="scroll_explore"]')).toHaveText('Role para explorar');
  });

  test('initializes scroll narration', async ({ page }) => {
    await openTimeline(page);
    await expect(page.locator('.narrator-indicator')).toBeAttached();
    const initialized = await page.evaluate(() => Boolean(window.narrator?.enabled));
    expect(initialized).toBe(true);
  });

  test('does not show removed or placeholder content', async ({ page }) => {
    await openTimeline(page);
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('null');
    expect(body).not.toContain('TODO');
    expect(body).not.toContain('PLACEHOLDER');
    expect(body).not.toContain('TBD');
    for (const term of BLACKLIST) {
      expect(body).not.toContain(term);
    }
  });

  test('responsive layout avoids horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openTimeline(page);
    const overflow = await page.evaluate(() => document.body.scrollWidth - document.body.clientWidth);
    expect(overflow).toBeLessThanOrEqual(5);
  });
});
