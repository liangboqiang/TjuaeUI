/** Assistant Settings boundary tests that do not depend on removed skill-path flows. */
import { test, expect } from '../../fixtures';
import { goToAssistantSettings, takeScreenshot } from '../../helpers';

test.describe('Assistant Settings Edge Cases', () => {
  test.setTimeout(90_000);

  test('highlight animation cleanup on unmount', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
    });

    await page.evaluate(() => {
      window.location.hash = '/settings/assistants?highlight=builtin-agent';
    });
    await page.waitForTimeout(1_000);
    await page.evaluate(() => {
      window.location.hash = '/settings/general';
    });
    await page.waitForTimeout(3_000);

    expect(errors.some((error) => /memory|timer|cleanup/iu.test(error))).toBe(false);
  });

  test('search renders one consistent empty state', async ({ page }) => {
    await goToAssistantSettings(page);
    await page.locator('[data-testid="btn-search-toggle"]').click();
    const searchInput = page.locator('[data-testid="input-search-assistant"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('zzz_nonexistent_query_12345');
    await expect(page.locator('text=/No assistants match|没有匹配/i')).toBeVisible({ timeout: 3_000 });
    await takeScreenshot(page, 'assistants/search-empty-state.png');
  });
});
