import { expect, test } from '../../../fixtures';
import { goToSettings, waitForSettle } from '../../../helpers';

async function chooseDeepOcean(page: import('@playwright/test').Page) {
  const selector = page.getByTestId('theme-cascader');
  await selector.click();

  const popup = page.locator('.arco-cascader-popup:visible');
  await popup.getByText(/Dark themes|深色主题/).hover();
  await popup.getByText(/Deep Ocean|深海/).click();
}

test.describe('Structured theme selector', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await goToSettings(page, 'display');
    await waitForSettle(page);
  });

  test('selects and persists a dark palette', async ({ page }) => {
    await chooseDeepOcean(page);
    await expect(page.locator('.arco-message-success').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme-id', 'dark-ocean');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (document.body.textContent?.length ?? 0) > 50, { timeout: 15_000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme-id', 'dark-ocean');
  });
});
