/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { resolveGuidAssistantDefaults } from '@/renderer/pages/guid/utils/assistantDefaults';
import type { AssistantDetail } from '@/common/types/agent/assistantTypes';

const buildDetail = (
  overrides: Partial<AssistantDetail['defaults']> = {},
  preferences?: Partial<AssistantDetail['preferences']>
): AssistantDetail =>
  ({
    id: 'assistant-1',
    source: 'user',
    profile: {
      name: 'Writer',
      name_i18n: {},
      description: 'desc',
      description_i18n: {},
      avatar: '🤖',
    },
    state: {
      enabled: true,
      sort_order: 1,
    },
    engine: {
      id: 'engine-1',
      descriptor: {
        type: 'tjuaecli',
        ownership: 'internal',
      },
    },
    rules: {
      content: '',
      storage_mode: 'user_file',
    },
    prompts: {
      recommended: [],
      recommended_i18n: {},
    },
    defaults: {
      model: { mode: 'auto' },
      permission: { mode: 'auto' },
      thought_level: { mode: 'auto' },
      skills: { mode: 'fixed', value: [] },
      mcps: { mode: 'auto', value: [] },
      ...overrides,
    },
    capabilities: {
      default_skill_ids: [],
      custom_skill_names: [],
    },
    preferences: {
      last_model_id: undefined,
      last_permission_value: undefined,
      last_thought_level_value: undefined,
      last_skill_ids: [],
      last_mcp_ids: [],
      ...preferences,
    },
    engine_status: 'online',
    team_selectable: true,
    deletable: true,
  }) satisfies AssistantDetail;

describe('resolveGuidAssistantDefaults', () => {
  it('returns fixed defaults directly', () => {
    const resolved = resolveGuidAssistantDefaults(
      buildDetail({
        model: { mode: 'fixed', value: 'gemini-2.5-pro' },
        permission: { mode: 'fixed', value: 'yolo' },
        thought_level: { mode: 'fixed', value: 'medium' },
        mcps: { mode: 'fixed', value: ['mcp-a', 'mcp-b'] },
      })
    );

    expect(resolved).toEqual({
      modelId: 'gemini-2.5-pro',
      permissionMode: 'yolo',
      thoughtLevel: 'medium',
      skillIds: [],
      mcpIds: ['mcp-a', 'mcp-b'],
    });
  });

  it('falls back to remembered values for auto defaults', () => {
    const resolved = resolveGuidAssistantDefaults(
      buildDetail(
        {
          model: { mode: 'auto' },
          permission: { mode: 'auto' },
          skills: { mode: 'auto', value: [] },
          mcps: { mode: 'auto', value: [] },
        },
        {
          last_model_id: 'claude-sonnet-4',
          last_permission_value: 'plan',
          last_thought_level_value: 'high',
          last_skill_ids: ['skill-a'],
          last_mcp_ids: ['mcp-1'],
        }
      )
    );

    expect(resolved).toEqual({
      modelId: 'claude-sonnet-4',
      permissionMode: 'plan',
      thoughtLevel: 'high',
      skillIds: ['skill-a'],
      mcpIds: ['mcp-1'],
    });
  });

  it('uses fixed generated assistant skill defaults instead of remembered skills', () => {
    const detail = {
      ...buildDetail(
        {
          skills: { mode: 'fixed', value: [] },
        },
        {
          last_skill_ids: ['custom-skill'],
        }
      ),
      source: 'generated',
    } satisfies AssistantDetail;

    const resolved = resolveGuidAssistantDefaults(detail);

    expect(resolved).toEqual({
      modelId: undefined,
      permissionMode: undefined,
      thoughtLevel: undefined,
      skillIds: [],
      mcpIds: [],
    });
  });

  it('returns empty values when auto defaults have no remembered values yet', () => {
    const resolved = resolveGuidAssistantDefaults(buildDetail());

    expect(resolved).toEqual({
      modelId: undefined,
      permissionMode: undefined,
      thoughtLevel: undefined,
      skillIds: [],
      mcpIds: [],
    });
  });

  it('returns fixed skill defaults from assistant detail instead of list payload fields', () => {
    const resolved = resolveGuidAssistantDefaults(
      buildDetail({
        skills: { mode: 'fixed', value: ['skill-fixed'] },
      })
    );

    expect(resolved).toEqual({
      modelId: undefined,
      permissionMode: undefined,
      thoughtLevel: undefined,
      skillIds: ['skill-fixed'],
      mcpIds: [],
    });
  });
});
