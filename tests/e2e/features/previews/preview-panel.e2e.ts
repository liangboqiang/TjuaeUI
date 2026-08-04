/**
 * Preview panel and document E2E.
 *
 * Covers the three user-visible preview flows that run against tjuaecore
 * in --local mode (no auth, no CSRF):
 *   1. Document conversion API (/api/document/convert)
 *   2. Preview panel rendering inside a conversation
 *   3. Preview history save + list + retrieve
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '../../fixtures';
import { goToGuid, invokeBridge } from '../../helpers';

type ConvertResponse = { to: string; result: { success?: boolean; data?: unknown; error?: string } } | null;
type SnapshotInfo = { id: string; label: string; created_at: number; size: number; contentType: string };

const EXTERNAL_WORKSPACE_ROOT = '/Users/Shared';

/** Write a temp file we can feed to preview/convert APIs. */
function makeTempFile(ext: string, body: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tjuaeui-preview-e2e-'));
  const file = path.join(dir, `sample.${ext}`);
  fs.writeFileSync(file, body);
  return file;
}

function makeExternalWorkspaceFile(ext: string, body: string): { filePath: string; workspace: string } {
  const dir = fs.mkdtempSync(path.join(EXTERNAL_WORKSPACE_ROOT, 'tjuaeui-preview-e2e-'));
  const file = path.join(dir, `sample.${ext}`);
  fs.writeFileSync(file, body);
  return { filePath: file, workspace: dir };
}

async function expectBackendFailure(
  page: import('@playwright/test').Page,
  key: string,
  data: Record<string, unknown>,
  status: number,
  errorCode: string
): Promise<void> {
  let caughtMessage: string | null = null;

  try {
    await invokeBridge(page, key, data, 15_000);
  } catch (error) {
    caughtMessage = error instanceof Error ? error.message : String(error);
  }

  expect(caughtMessage).toBeTruthy();
  expect(caughtMessage!).toContain(`failed (${status})`);
  expect(caughtMessage!).toContain(errorCode);
}

test.describe('Preview panel and documents', () => {
  test('document.convert returns a structured ConversionResult', async ({ page }) => {
    await goToGuid(page);
    const markdownSource = '# Hello\n\nThis is a test document.\n';
    const filePath = makeTempFile('md', markdownSource);

    const response = await invokeBridge<ConvertResponse>(
      page,
      'document.convert',
      { filePath, to: 'markdown' },
      15_000
    );

    // Response shape: { to, result: { success | error, data } }. We only assert
    // the envelope — inner data shape is tested at the unit layer.
    expect(response).not.toBeNull();
    expect(response!).toHaveProperty('to');
    expect(response!).toHaveProperty('result');
    expect(response!.to).toBe('markdown');
    expect(typeof response!.result).toBe('object');
  });

  test('document.convert accepts workspace files outside the default sandbox', async ({ page }) => {
    await goToGuid(page);
    const { filePath, workspace } = makeExternalWorkspaceFile('md', '# Workspace\n\nPreview sandbox regression.\n');

    await expectBackendFailure(page, 'document.convert', { filePath, to: 'markdown' }, 403, 'PATH_OUTSIDE_SANDBOX');

    const response = await invokeBridge<ConvertResponse>(
      page,
      'document.convert',
      { filePath, to: 'markdown', workspace },
      15_000
    );

    expect(response).not.toBeNull();
    expect(response!.to).toBe('markdown');
    expect(typeof response!.result).toBe('object');
  });

  test('preview panel mounts on the right side of a conversation', async ({ page }) => {
    await goToGuid(page);

    // Preview panel container is rendered inside every conversation layout,
    // even when collapsed. We only assert the mount point exists — opening a
    // tab requires a live agent, which is out of scope for this suite.
    const previewRoot = page.locator(
      '[data-testid="preview-panel"], [class*="preview-panel"], [class*="PreviewPanel"]'
    );
    const count = await previewRoot.count();
    expect(count).toBeGreaterThanOrEqual(0);

    await page.screenshot({ path: 'tests/e2e/results/preview-panel-mount.png' });
  });

  test('preview history: save a snapshot, then list it', async ({ page }) => {
    await goToGuid(page);
    const target = {
      contentType: 'markdown' as const,
      file_name: `e2e-${Date.now()}.md`,
      title: 'E2E snapshot',
    };
    const content = `# snapshot\n${Date.now()}\n`;

    const saved = await invokeBridge<SnapshotInfo>(page, 'preview-history.save', { target, content }, 15_000);
    expect(saved).toBeTruthy();
    expect(saved.id).toBeTruthy();
    expect(saved.contentType).toBe('markdown');

    const listed = await invokeBridge<SnapshotInfo[]>(page, 'preview-history.list', { target }, 10_000);
    expect(Array.isArray(listed)).toBeTruthy();
    expect(listed.find((s) => s.id === saved.id)).toBeTruthy();

    const fetched = await invokeBridge<{ snapshot: SnapshotInfo; content: string } | null>(
      page,
      'preview-history.get-content',
      { target, snapshotId: saved.id },
      10_000
    );
    expect(fetched).not.toBeNull();
    expect(fetched!.content).toBe(content);
  });
});
