import { expect, test } from '../../../fixtures';
import { goToSettings } from '../../../helpers/navigation';

test.describe('本地资产库与远程市场', () => {
  test('市场只展示远程资产，并提供四种核心资产分类', async ({ page }) => {
    await goToSettings(page, 'market');

    const market = page.getByTestId('remote-market');
    await expect(market).toBeVisible();
    await expect(page.getByTestId('market-kind-assistant')).toBeVisible();
    await expect(page.getByTestId('market-kind-engineAdapter')).toBeVisible();
    await expect(page.getByTestId('market-kind-skill')).toBeVisible();
    await expect(page.getByTestId('market-kind-mcp')).toBeVisible();
    await expect(page.getByTestId('market-filters')).toBeVisible();

    // Market is a read-only remote library. Local editing is reached only
    // after installation and must never be embedded as a second Market tab.
    await expect(page.locator('[data-testid="local-asset-workbench"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="btn-open-import-history"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="btn-add-skill"]')).toHaveCount(0);
  });

  for (const route of ['assistants', 'engine', 'skills', 'tools']) {
    test(`${route} 设置只展示 Core 本地资产工作台`, async ({ page }) => {
      await goToSettings(page, route);

      await expect(page.getByTestId('local-asset-page')).toBeVisible();
      await expect(page.getByTestId('local-asset-workbench')).toBeVisible();
      await expect(page.locator('[data-testid="settings-tab-official"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="btn-open-import-history"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="external-skills-section"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="remote-market"]')).toHaveCount(0);
    });
  }
});
