/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssetSummary } from '@/common/types/agent/assets';
import { useTalkToButler } from '@/renderer/hooks/assistant/useTalkToButler';

const listAssetsMock = vi.fn();
const activateAssetMock = vi.fn();
const navigateMock = vi.fn();
const successMock = vi.fn();

vi.mock('@/renderer/pages/settings/Assets/LocalAssetPage/assetApi', () => ({
  assetApi: {
    list: {
      invoke: (...args: unknown[]) => listAssetsMock(...args),
    },
    activate: {
      invoke: (...args: unknown[]) => activateAssetMock(...args),
    },
  },
}));

vi.mock('@/renderer/utils/navigation', () => ({
  globalNavigate: (...args: unknown[]) => navigateMock(...args),
}));

vi.mock('@arco-design/web-react', () => ({
  Message: {
    success: (...args: unknown[]) => successMock(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const assistantAsset = (id: string, overrides: Partial<AssetSummary> = {}): AssetSummary => ({
  id,
  kind: 'assistant',
  displayName: id,
  origin: 'hub',
  trust: 'official',
  scope: 'user',
  editability: 'overlay',
  definitionDigest: `digest-${id}`,
  runtimeState: 'inactive',
  allowedActions: [],
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe('useTalkToButler', () => {
  beforeEach(() => {
    listAssetsMock.mockReset();
    activateAssetMock.mockReset();
    navigateMock.mockReset();
    successMock.mockReset();
  });

  it('selects the active Butler by local asset identity without exposing its projection identity', async () => {
    listAssetsMock.mockResolvedValue([
      assistantAsset('builtin-tjuaeui-assistant', { runtimeState: 'active' }),
      assistantAsset('tjuaeui-assistant', {
        runtimeState: 'active',
        runtimeId: 'portable-butler',
      }),
    ]);

    const { result } = renderHook(() => useTalkToButler());
    await act(() => result.current({ prompt: 'Help', files: ['report.png'] }));

    expect(activateAssetMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/guid', {
      state: {
        selectedAssistantId: 'tjuaeui-assistant',
        prefillPrompt: 'Help',
        prefillFiles: ['report.png'],
      },
    });
  });

  it('uses the stable local asset id when an active Butler has no portable runtime id', async () => {
    listAssetsMock.mockResolvedValue([
      assistantAsset('tjuaeui-assistant', {
        runtimeState: 'active',
      }),
    ]);

    const { result } = renderHook(() => useTalkToButler());
    await act(() => result.current({ prompt: 'Help' }));

    expect(navigateMock).toHaveBeenCalledWith('/guid', {
      state: {
        selectedAssistantId: 'tjuaeui-assistant',
        prefillPrompt: 'Help',
        prefillFiles: undefined,
      },
    });
  });

  it('activates the local Butler asset through the Core lifecycle', async () => {
    listAssetsMock.mockResolvedValue([
      assistantAsset('tjuaeui-assistant', {
        allowedActions: ['activate'],
        definitionDigest: 'butler-definition-digest',
      }),
    ]);
    activateAssetMock.mockResolvedValue({
      runtimeBinding: {
        portableRuntimeId: 'portable-butler',
      },
    });

    const { result } = renderHook(() => useTalkToButler());
    await act(() => result.current({ prompt: 'Help' }));

    expect(activateAssetMock).toHaveBeenCalledWith({
      assetId: 'tjuaeui-assistant',
      idempotencyKey: expect.any(String),
      expectedDefinitionDigest: 'butler-definition-digest',
    });
    expect(successMock).toHaveBeenCalledWith('settings.talkToButler.enabledToast');
    expect(navigateMock).toHaveBeenCalledWith('/guid', {
      state: {
        selectedAssistantId: 'tjuaeui-assistant',
        prefillPrompt: 'Help',
        prefillFiles: undefined,
      },
    });
  });

  it('does not reinterpret a removed builtin-prefixed id as the Butler', async () => {
    listAssetsMock.mockResolvedValue([assistantAsset('builtin-tjuaeui-assistant', { allowedActions: ['activate'] })]);

    const { result } = renderHook(() => useTalkToButler());
    await act(() => result.current({ prompt: 'Help' }));

    expect(activateAssetMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/guid', {
      state: {
        selectedAssistantId: undefined,
        prefillPrompt: 'Help',
        prefillFiles: undefined,
      },
    });
  });

  it('keeps the prefilled navigation available when activation fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    listAssetsMock.mockResolvedValue([
      assistantAsset('tjuaeui-assistant', {
        allowedActions: ['activate'],
      }),
    ]);
    activateAssetMock.mockRejectedValue(new Error('activation failed'));

    const { result } = renderHook(() => useTalkToButler());
    await act(() => result.current({ prompt: 'Help' }));

    expect(consoleError).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/guid', {
      state: {
        selectedAssistantId: undefined,
        prefillPrompt: 'Help',
        prefillFiles: undefined,
      },
    });
    consoleError.mockRestore();
  });
});
