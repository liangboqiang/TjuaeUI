/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TChatConversation, TConversationAssistantIdentity } from '@/common/config/storage';
import { usePresetAssistantInfo } from '@/renderer/hooks/agent/usePresetAssistantInfo';

const useSWRMock = vi.fn();
let currentLanguage = 'en-US';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: currentLanguage },
  }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    assistants: {
      list: { invoke: vi.fn() },
    },
  },
}));

vi.mock('@/renderer/utils/platform', () => ({
  resolveExtensionAssetUrl: (value: string | undefined) => value,
  resolveBackendAssetUrl: (value: string | undefined) => value,
}));

vi.mock('swr', () => ({
  __esModule: true,
  default: (...args: unknown[]) => useSWRMock(...args),
}));

describe('usePresetAssistantInfo', () => {
  beforeEach(() => {
    useSWRMock.mockReset();
    currentLanguage = 'en-US';
    useSWRMock.mockReturnValue({ data: undefined, isLoading: false });
  });

  it('uses the explicit conversation assistant snapshot as the sole identity source', () => {
    const conversation = makeConversation({
      assistant: {
        id: 'assistant-social',
        source: 'user',
        name: 'Social Job Publisher',
        avatar: '🦜',
        backend: 'gemini',
      },
      extra: {
        unrelated_id: 'ignored-assistant',
        unrelated_context: '# Ignored Assistant',
      },
    });

    const { result } = renderHook(() => usePresetAssistantInfo(conversation));

    expect(result.current).toEqual({
      info: {
        name: 'Social Job Publisher',
        logo: '🦜',
        isEmoji: true,
        backend: 'gemini',
        assistantId: 'assistant-social',
      },
      isLoading: false,
    });
    expect(useSWRMock).toHaveBeenCalledWith(null, expect.any(Function));
  });

  it('restores an unsafe local avatar by exact current assistant id', () => {
    currentLanguage = 'zh-CN';
    useSWRMock.mockImplementation((key: unknown) => {
      if (key === 'assistants.list') {
        return {
          data: [
            {
              id: 'assistant-local-avatar',
              source: 'user',
              name: 'Local Avatar',
              name_i18n: { 'zh-CN': '本地头像助手' },
              avatar: '/api/assistants/assistant-local-avatar/avatar',
              engine: { type: 'acp', ownership: 'custom', acp_backend: 'codex' },
            },
          ],
          isLoading: false,
        };
      }
      return { data: undefined, isLoading: false };
    });

    const conversation = makeConversation({
      assistant: {
        id: 'assistant-local-avatar',
        source: 'user',
        name: 'Local Avatar',
        avatar: 'C:\\Users\\demo\\.tjuaeui\\assistant-avatars\\avatar.jpg',
        backend: 'codex',
      },
    });

    const { result } = renderHook(() => usePresetAssistantInfo(conversation));

    expect(result.current.info).toEqual({
      name: '本地头像助手',
      logo: '/api/assistants/assistant-local-avatar/avatar',
      isEmoji: false,
      backend: 'codex',
      assistantId: 'assistant-local-avatar',
    });
  });

  it('does not match a catalog assistant through a removed id prefix', () => {
    useSWRMock.mockImplementation((key: unknown) => {
      if (key === 'assistants.list') {
        return {
          data: [
            {
              id: 'assistant-local-avatar',
              source: 'user',
              name: 'Wrong Prefix Match',
              name_i18n: {},
              avatar: '/api/assistants/assistant-local-avatar/avatar',
            },
          ],
          isLoading: false,
        };
      }
      return { data: undefined, isLoading: false };
    });

    const conversation = makeConversation({
      assistant: {
        id: 'builtin-assistant-local-avatar',
        source: 'generated',
        name: 'Generated Assistant',
        avatar: 'C:\\Users\\demo\\.tjuaeui\\assistant-avatars\\avatar.jpg',
        backend: 'codex',
      },
    });

    const { result } = renderHook(() => usePresetAssistantInfo(conversation));

    expect(result.current.info).toEqual({
      name: 'Generated Assistant',
      logo: '',
      isEmoji: false,
      isFallback: true,
      backend: 'codex',
      assistantId: 'builtin-assistant-local-avatar',
    });
  });

  it('returns no assistant when the current conversation has no assistant snapshot', () => {
    const conversation = makeConversation({
      extra: {
        unrelated_id: 'ignored-field',
        agent_name: 'Legacy Runtime',
      },
    });

    const { result } = renderHook(() => usePresetAssistantInfo(conversation));

    expect(result.current).toEqual({ info: null, isLoading: false });
  });

  it('uses the assistant fallback when the current snapshot has no avatar', () => {
    const conversation = makeConversation({
      assistant: {
        id: 'bare-codex',
        source: 'generated',
        name: 'Codex',
        avatar: '',
        backend: 'codex',
      },
    });

    const { result } = renderHook(() => usePresetAssistantInfo(conversation));

    expect(result.current.info).toEqual({
      name: 'Codex',
      logo: '',
      isEmoji: false,
      isFallback: true,
      backend: 'codex',
      assistantId: 'bare-codex',
    });
  });
});

function makeConversation({
  assistant,
  extra = {},
}: {
  assistant?: TConversationAssistantIdentity;
  extra?: Record<string, unknown>;
}): TChatConversation {
  return {
    id: 'conv-1',
    name: '测试',
    type: 'acp',
    extra: {
      backend: 'codex',
      ...extra,
    },
    assistant,
    status: 'finished',
    source: 'tjuaeui',
    created_at: 1,
    modified_at: 1,
  } as TChatConversation;
}
