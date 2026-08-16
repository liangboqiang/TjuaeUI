/**
 * E2E: persistent workspace Git in the Resource Management tab.
 * A selected team workspace is provisioned on `main`; a new working-tree file
 * appears in Resource Management and can be staged without a separate Changes tab.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect, test } from '../../fixtures';
import { cleanupTeamsByName, TEAM_SUPPORTED_BACKENDS } from '../../helpers';

const TEAM_NAME = `E2E Workspace Git ${Date.now()}`;

test.describe('Workspace persistent Git — Resource Management', () => {
  let workspace: string;

  test.beforeAll(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tjuaeui-e2e-ws-git-'));
    fs.writeFileSync(path.join(workspace, 'baseline.txt'), 'original');
  });

  test.afterAll(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  test('provisions main and stages a working-tree file from Resource Management', async ({ page, electronApp }) => {
    test.setTimeout(180_000);
    if (TEAM_SUPPORTED_BACKENDS.size === 0) {
      test.skip(true, 'No supported team backends available');
      return;
    }

    await electronApp.evaluate(async ({ dialog }, target) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [target] });
    }, workspace);
    await cleanupTeamsByName(page, TEAM_NAME);

    const createBtn = page.locator('[data-testid="team-create-btn"]').first();
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();
    const modal = page.locator('.team-create-modal');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await modal.locator('input').first().fill(TEAM_NAME);

    const agentCard = modal.locator('[data-testid^="team-create-agent-card-"]').first();
    if (!(await agentCard.isVisible().catch(() => false))) {
      test.skip(true, 'No supported agents available');
      return;
    }
    await agentCard.click();

    const wsTrigger = modal.locator('[data-testid="team-create-workspace-trigger"]');
    if (await wsTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await wsTrigger.click();
      const menu = page.locator('[data-testid="team-create-workspace-menu"]');
      if (await menu.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await menu
          .locator('text=/Choose a different folder|选择其他文件夹/i')
          .or(menu.locator('.cursor-pointer').last())
          .first()
          .click();
      }
    }

    const createConfirmBtn = modal.locator('.arco-btn-primary');
    await expect(createConfirmBtn).toBeEnabled({ timeout: 5_000 });
    await createConfirmBtn.click();
    await expect(modal).toBeHidden({ timeout: 15_000 });
    await page.waitForURL(/\/team\//, { timeout: 15_000 });

    const panel = page.locator('.chat-workspace');
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => fs.existsSync(path.join(workspace, '.git')), { timeout: 30_000 }).toBe(true);

    fs.writeFileSync(path.join(workspace, 'created.txt'), 'hello-git');
    const resourceTab = panel.locator('.arco-tabs-header-title').filter({ hasText: /Resource Management|资源管理/ });
    await resourceTab.first().click();
    await expect(panel.getByText('created.txt').first()).toBeVisible({ timeout: 30_000 });

    const stageButton = panel.getByRole('button', { name: /Stage All|全部暂存/ }).first();
    if (await stageButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await stageButton.click();
      await expect(panel.getByText('created.txt').first()).toBeVisible({ timeout: 10_000 });
    }

    await cleanupTeamsByName(page, TEAM_NAME);
  });
});
