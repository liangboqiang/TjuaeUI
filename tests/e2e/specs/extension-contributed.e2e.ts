/** Extension-contributed runtime agents remain engine resources; assistants are catalog-only. */
import { test, expect } from '../fixtures';
import { expectBodyContainsAny, getExtensionSnapshot, goToSettings, waitForSettle } from '../helpers';

test.describe('Extension-contributed runtime agents', () => {
  test('extension agents appear in agent settings', async ({ page }) => {
    await goToSettings(page, 'agent');
    await waitForSettle(page, 5_000);
    await expectBodyContainsAny(page, ['E2E CLI Agent', 'e2e-cli-agent', 'E2E HTTP Agent']);
  });

  test('extension snapshot exposes the contributed ACP adapters', async ({ page }) => {
    const snapshot = await getExtensionSnapshot(page);
    expect(snapshot.loadedExtensions.map((extension) => extension.name)).toContain('e2e-full-extension');
    expect(snapshot.acpAdapters.map((adapter) => adapter.id)).toEqual(
      expect.arrayContaining(['e2e-cli-agent', 'e2e-http-agent'])
    );
  });
});
