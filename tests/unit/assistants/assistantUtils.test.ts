import { describe, expect, it, vi } from 'vitest';

import type { Assistant } from '@/common/types/agent/assistantTypes';
import {
  assistantSettingsPath,
  isEmoji,
  reorderAssistantList,
  resolveAvatarImageSrc,
} from '@/renderer/pages/settings/AssistantSettings/assistantUtils';

vi.mock('@/renderer/utils/platform', () => ({
  resolveExtensionAssetUrl: vi.fn((url: string) => {
    if (url.startsWith('ext://')) return `resolved-${url}`;
    if (url.startsWith('/api/assistant-assets/')) return `http://127.0.0.1:13400${url}`;
    return null;
  }),
}));

function assistant(id: string): Assistant {
  return {
    id,
    source: 'mine',
    name: id,
    name_i18n: {},
    description_i18n: {},
    enabled: true,
    sort_order: 0,
    agent_id: 'tjuaecli',
    enabled_skills: [],
    context_i18n: {},
    prompts: [],
    prompts_i18n: {},
    models: [],
    mcp_ids: [],
    agent_status: 'online',
    team_selectable: true,
    deletable: true,
  };
}

describe('assistantUtils', () => {
  it('maps stable assistant runtime identities to their canonical settings detail route', () => {
    expect(assistantSettingsPath('mine::tjuaeui-assistant')).toBe('/settings/assistants/mine/~/tjuaeui-assistant');
    expect(assistantSettingsPath('tjuae-hub:official:cowork')).toBe('/settings/assistants/tjuae-hub/official/cowork');
    expect(assistantSettingsPath('legacy-assistant-id')).toBe('/settings/assistants');
  });

  it('distinguishes emoji avatars from ordinary strings', () => {
    expect(isEmoji('😀')).toBe(true);
    expect(isEmoji('👨‍👩‍👦')).toBe(true);
    expect(isEmoji('assistant')).toBe(false);
    expect(isEmoji('')).toBe(false);
  });

  it('resolves public catalog asset routes without exposing local paths', () => {
    expect(resolveAvatarImageSrc('/api/assistant-assets/mine/demo/avatar')).toBe(
      'http://127.0.0.1:13400/api/assistant-assets/mine/demo/avatar'
    );
    expect(resolveAvatarImageSrc('ext://catalog/icon.svg')).toBe('resolved-ext://catalog/icon.svg');
    expect(resolveAvatarImageSrc('C:\\private\\avatar.png')).toBeUndefined();
  });

  it('reorders the shared runtime projection without mutating the input', () => {
    const input = [assistant('a'), assistant('b'), assistant('c')];
    const reordered = reorderAssistantList(input, 'c', 'a');

    expect(reordered.map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(input.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(reorderAssistantList(input, 'missing', 'a')).toBe(input);
  });
});
