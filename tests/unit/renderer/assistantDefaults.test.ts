import { describe, expect, it } from 'vitest';
import { resolveGuidAssistantDefaults } from '@/renderer/pages/guid/utils/assistantDefaults';
import type { Assistant } from '@/common/types/agent/assistantTypes';

const buildAssistant = (overrides: Partial<Assistant> = {}): Assistant => ({
  id: 'mine:tjuae:writer',
  source: 'mine',
  name: 'Writer',
  name_i18n: {},
  description: 'desc',
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
  ...overrides,
});

describe('resolveGuidAssistantDefaults', () => {
  it('projects the already resolved activated runtime configuration', () => {
    const resolved = resolveGuidAssistantDefaults(
      buildAssistant({
        models: ['gemini-2.5-pro'],
        permission: 'yolo',
        thought_level: 'medium',
        enabled_skills: ['skill-a'],
        mcp_ids: ['mcp-a', 'mcp-b'],
      })
    );

    expect(resolved).toEqual({
      modelId: 'gemini-2.5-pro',
      permissionMode: 'yolo',
      thoughtLevel: 'medium',
      skillIds: ['skill-a'],
      mcpIds: ['mcp-a', 'mcp-b'],
    });
  });

  it('uses only the first model selected by the activation transaction', () => {
    expect(resolveGuidAssistantDefaults(buildAssistant({ models: ['model-a', 'model-b'] })).modelId).toBe('model-a');
  });

  it('returns deterministic empty values for a runtime without optional resources', () => {
    expect(resolveGuidAssistantDefaults(buildAssistant())).toEqual({
      modelId: undefined,
      permissionMode: undefined,
      thoughtLevel: undefined,
      skillIds: [],
      mcpIds: [],
    });
  });

  it('returns deterministic empty values without an assistant', () => {
    expect(resolveGuidAssistantDefaults(undefined)).toEqual({
      modelId: undefined,
      permissionMode: undefined,
      thoughtLevel: undefined,
      skillIds: [],
      mcpIds: [],
    });
  });
});
