/**
 * Display Settings Persistence E2E Tests
 *
 * Verifies that display settings survive a page reload — i.e. they are
 * persisted to the store, not just held in component state.
 */

import { test, expect } from '../../../fixtures';
import { goToSettings, waitForSettle } from '../../../helpers';

const PERCENT_RE = /^\d{2,3}%$/;

function fontSizeControlLocator(page: import('@playwright/test').Page) {
  return page.locator('.font-scale-slider').locator('..');
}

function percentLabel(page: import('@playwright/test').Page) {
  return fontSizeControlLocator(page).locator('..').locator('span').filter({ hasText: PERCENT_RE });
}

function plusButton(page: import('@playwright/test').Page) {
  return fontSizeControlLocator(page).locator('button:has-text("+")');
}

function resetButton(page: import('@playwright/test').Page) {
  return fontSizeControlLocator(page)
    .locator('..')
    .locator('..')
    .locator('button')
    .filter({ hasNotText: /^[+-]$/ })
    .last();
}

async function currentPercent(page: import('@playwright/test').Page): Promise<number> {
  const text = await percentLabel(page).textContent();
  return parseInt(text!.replace('%', ''), 10);
}

async function reloadAndGoToDisplay(page: import('@playwright/test').Page): Promise<void> {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (document.body.textContent?.length ?? 0) > 50, { timeout: 15_000 });
  await goToSettings(page, 'display');
  await waitForSettle(page);
}

test.describe('Display settings persistence across reload', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await goToSettings(page, 'display');
    await waitForSettle(page);
  });

  test('zoom scale persists after reload', async ({ page }) => {
    const label = percentLabel(page);
    await expect(label).toBeVisible({ timeout: 5_000 });

    const baseline = await currentPercent(page);

    const plus = plusButton(page);
    if (await plus.isDisabled()) {
      test.skip(true, 'zoom already at max — cannot increase');
      return;
    }
    await plus.click();
    await waitForSettle(page, 1_000);

    const afterClick = await currentPercent(page);
    expect(afterClick).toBeGreaterThan(baseline);

    await reloadAndGoToDisplay(page);

    const afterReload = await currentPercent(page);
    expect(afterReload).toBe(afterClick);

    // Restore via reset button
    const reset = resetButton(page);
    await expect(reset).toBeVisible({ timeout: 5_000 });
    if (await reset.isEnabled()) {
      await reset.click();
      await waitForSettle(page, 1_000);
    }
  });
});
