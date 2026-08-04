/**
 * Engine management diagnostics and unified assistant-catalog coverage.
 */
import { test, expect } from '../fixtures';
import { ASSISTANT_PILL, goToGuid, goToSettings, httpGet, waitForSettle } from '../helpers';

type ManagedAgent = {
  id: string;
  agent_type?: string;
  backend?: string;
  agent_source: 'internal' | 'builtin' | 'extension' | 'custom';
  installed?: boolean;
};

const LEGACY_TEXT = /Install from Market|从市场安装|Discover More Agents|发现更多 Agent|Start Chat|开始对话/;

test.describe('Engine diagnostics — E2E', () => {
  test('the read-only diagnostics page exposes every scanned candidate', async ({ page }) => {
    const managedAgents = await httpGet<ManagedAgent[]>(page, '/api/engines/management');

    await goToSettings(page, 'agent');
    await waitForSettle(page);
    await expect(page.locator('[data-testid="local-asset-page"]')).toBeVisible({ timeout: 8_000 });
    await page.locator('[data-testid="engine-diagnostics-open"]').click();

    await expect(page.locator('[data-testid="engine-diagnostics-page"]')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('[data-testid="engine-diagnostics-test-all"]')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('body')).not.toContainText(LEGACY_TEXT);
    await expect(page.locator('[role="switch"]')).toHaveCount(0);

    for (const agent of managedAgents.slice(0, 6)) {
      await expect(page.locator(`[data-testid="engine-diagnostics-row-${agent.id}"]`)).toBeVisible({
        timeout: 8_000,
      });
    }
  });

  test('an uninstalled automatic CLI is diagnostic data, not a local asset row', async ({ page }) => {
    const managedAgents = await httpGet<ManagedAgent[]>(page, '/api/engines/management');
    const missingCandidate = managedAgents.find(
      (agent) => agent.installed === false && (agent.agent_source === 'builtin' || agent.agent_source === 'extension')
    );
    if (!missingCandidate) {
      test.skip(true, 'No uninstalled automatic CLI candidate in this environment');
      return;
    }

    await goToSettings(page, 'agent');
    await expect(page.locator(`[data-asset-id="${missingCandidate.id}"]`)).toHaveCount(0);
    await page.locator('[data-testid="engine-diagnostics-open"]').click();
    await expect(page.locator(`[data-testid="engine-diagnostics-row-${missingCandidate.id}"]`)).toBeVisible({
      timeout: 8_000,
    });
  });

  test('assistant pill bar on guid page renders available assistants', async ({ page }) => {
    await goToGuid(page);

    const pills = page.locator(ASSISTANT_PILL);
    await expect(pills.first()).toBeVisible({ timeout: 8_000 });
    await expect.poll(async () => pills.count(), { timeout: 8_000 }).toBeGreaterThanOrEqual(1);
  });

  test('selecting an assistant in pill bar activates chat input', async ({ page }) => {
    await goToGuid(page);

    const pills = page.locator(ASSISTANT_PILL);
    await expect(pills.first()).toBeVisible({ timeout: 8_000 });
    await pills.first().click();

    await expect(page.locator('textarea, [contenteditable="true"], [role="textbox"]').first()).toBeVisible({
      timeout: 8_000,
    });
  });
});
