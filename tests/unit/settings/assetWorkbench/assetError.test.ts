import { localizeAssetError } from '@/renderer/pages/settings/Assets/components/assetError';
import { describe, expect, it } from 'vitest';

const translate = ((key: string) => key) as never;

describe('asset error localization', () => {
  it('maps stable Core codes instead of exposing the backend message', () => {
    const localized = localizeAssetError(
      translate,
      {
        name: 'BackendHttpError',
        status: 409,
        code: 'ASSET_CONCURRENT_MODIFICATION',
        backendMessage: 'an untranslated backend message',
      },
      'settings.assetWorkbench.operationFailed'
    );

    expect(localized).toBe('settings.assetWorkbench.concurrentModification');
    expect(localized).not.toContain('untranslated');
  });

  it('uses a localized operation fallback for unknown and native errors', () => {
    expect(
      localizeAssetError(translate, new Error('request timed out'), 'settings.assetWorkbench.operationFailed')
    ).toBe('settings.assetWorkbench.operationFailed');
  });
});
