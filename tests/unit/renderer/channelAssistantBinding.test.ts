import type { Assistant } from '@/common/types/agent/assistantTypes';
import {
  buildChannelAssistantBinding,
  getDefaultChannelAssistant,
  resolveChannelAssistantId,
  resolveChannelAssistantSelection,
} from '@/renderer/components/settings/SettingsModal/contents/channels/assistantBinding';
import { describe, expect, it } from 'vitest';

function assistant(overrides: Partial<Assistant> & Pick<Assistant, 'id' | 'name'> & { runtimeKey: string }): Assistant {
  const isTjuaeCli = overrides.runtimeKey === 'tjuaecli';
  return {
    id: overrides.id,
    source: overrides.source ?? 'mine',
    name: overrides.name,
    name_i18n: {},
    description: overrides.description,
    description_i18n: {},
    avatar: overrides.avatar,
    enabled: overrides.enabled ?? true,
    sort_order: overrides.sort_order ?? 1000,
    agent_id: `agent-${overrides.runtimeKey}`,
    agent: isTjuaeCli
      ? { type: 'tjuaecli', source: 'internal' }
      : { type: 'acp', source: 'builtin', acp_backend: overrides.runtimeKey },
    enabled_skills: [],
    context_i18n: {},
    prompts: [],
    prompts_i18n: {},
    models: [],
    agent_status: 'online',
    team_selectable: true,
    deletable: true,
    ...overrides,
  };
}

describe('channel assistant binding helpers', () => {
  const assistants = [
    assistant({ id: 'tjuaeui-butler', name: 'TjuaeUI 管家', source: 'tjuae-hub', runtimeKey: 'tjuaecli' }),
    assistant({ id: 'hub-claude', name: 'Claude', source: 'tjuae-hub', runtimeKey: 'claude' }),
    assistant({ id: 'mine-writer', name: 'Writer', source: 'mine', runtimeKey: 'claude' }),
  ];

  it('prefers the activated TjuaeUI butler as the default selection', () => {
    expect(getDefaultChannelAssistant(assistants)?.id).toBe('tjuaeui-butler');
  });

  it('resolves explicit assistant ids from new channel bindings', () => {
    expect(resolveChannelAssistantId({ assistant_id: 'mine-writer' }, assistants)).toBe('mine-writer');
  });

  it('falls back to the default assistant only when no binding was saved', () => {
    expect(resolveChannelAssistantId(undefined, assistants)).toBe('tjuaeui-butler');
  });

  it('marks unresolved saved bindings instead of silently selecting a default assistant', () => {
    expect(resolveChannelAssistantSelection({ custom_agent_id: 'bare-claude' }, assistants)).toEqual({
      assistantId: undefined,
      hasBrokenSavedAssistant: true,
    });
    expect(resolveChannelAssistantSelection({ backend: 'claude' }, assistants)).toEqual({
      assistantId: undefined,
      hasBrokenSavedAssistant: true,
    });
    expect(resolveChannelAssistantSelection({ agent_type: 'claude' }, assistants)).toEqual({
      assistantId: undefined,
      hasBrokenSavedAssistant: true,
    });
    expect(resolveChannelAssistantSelection({ backend: 'missing-backend' }, assistants)).toEqual({
      assistantId: undefined,
      hasBrokenSavedAssistant: true,
    });
    expect(resolveChannelAssistantSelection({ assistant_id: 'missing-assistant' }, assistants)).toEqual({
      assistantId: undefined,
      hasBrokenSavedAssistant: true,
    });
  });

  it('serializes only assistant identity for new channel bindings', () => {
    expect(buildChannelAssistantBinding(assistants[1])).toEqual({ assistant_id: 'hub-claude' });
  });
});
