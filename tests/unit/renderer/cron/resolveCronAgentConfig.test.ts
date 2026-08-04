/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { Assistant, AssistantEngineDescriptor } from '@/common/types/agent/assistantTypes';
import { resolveCronAgentConfig } from '@/renderer/pages/cron/ScheduledTasksPage/resolveCronAgentConfig';

describe('resolveCronAgentConfig', () => {
  it('stores provider id for preset tjuaecli assistants instead of literal tjuaecli backend', () => {
    const result = resolveCronAgentConfig({
      agentValue: 'assistant-1',
      presetAssistants: [
        assistant({
          id: 'assistant-1',
          name: '文件规划助手',
          engine_id: 'agent-tjuaecli',
          engine: engine('tjuaecli'),
        }),
      ],
      selectedTjuaeCliProvider: {
        id: 'provider-gemini',
        name: 'Gemini',
      },
      model_id: 'gemini-3.1-pro-preview',
      workspace: '/tmp/project',
      getMode: () => 'yolo',
      tjuaecliModelRequiredMessage: 'provider required',
    });

    expect(result).toEqual({
      agent_config: {
        name: '文件规划助手',
        assistant_id: 'assistant-1',
        mode: 'yolo',
        model_id: 'gemini-3.1-pro-preview',
        model: {
          provider_id: 'provider-gemini',
          model: 'gemini-3.1-pro-preview',
          use_model: 'gemini-3.1-pro-preview',
        },
        config_options: undefined,
        workspace: '/tmp/project',
      },
    });
  });

  it('keeps preset acp assistants on their backend slug', () => {
    const result = resolveCronAgentConfig({
      agentValue: 'assistant-2',
      presetAssistants: [
        assistant({
          id: 'assistant-2',
          name: 'Codex 助手',
          engine_id: 'agent-codex',
          engine: engine('acp', 'codex'),
        }),
      ],
      config_options: { reasoning_effort: 'high' },
      getMode: (selectedAssistant) => (selectedAssistant.engine_id === 'agent-codex' ? 'full-access' : 'yolo'),
      tjuaecliModelRequiredMessage: 'provider required',
    });

    expect(result).toEqual({
      agent_config: {
        name: 'Codex 助手',
        assistant_id: 'assistant-2',
        mode: 'full-access',
        config_options: { reasoning_effort: 'high' },
        model_id: undefined,
        workspace: undefined,
      },
    });
  });

  it('stores localized assistant names when a locale key is provided', () => {
    const result = resolveCronAgentConfig({
      agentValue: 'assistant-2',
      presetAssistants: [
        assistant({
          id: 'assistant-2',
          name: 'Codex',
          name_i18n: { 'zh-CN': '代码助手' },
          engine_id: 'agent-codex',
          engine: engine('acp', 'codex'),
        }),
      ],
      localeKey: 'zh-CN',
      getMode: () => 'full-access',
      tjuaecliModelRequiredMessage: 'provider required',
    });

    expect(result.agent_config?.name).toBe('代码助手');
  });

  it('omits backend for non-tjuaecli assistants and lets the backend derive runtime identity', () => {
    const result = resolveCronAgentConfig({
      agentValue: 'assistant-4',
      presetAssistants: [
        assistant({
          id: 'assistant-4',
          name: 'Claude 助手',
          engine_id: 'agent-claude',
          engine: engine('acp', 'claude'),
        }),
      ],
      getMode: () => 'default',
      tjuaecliModelRequiredMessage: 'provider required',
    });

    expect(result).toEqual({
      agent_config: {
        name: 'Claude 助手',
        assistant_id: 'assistant-4',
        mode: 'default',
        model_id: undefined,
        config_options: undefined,
        workspace: undefined,
      },
    });
    expect(result.agent_config).not.toHaveProperty('backend');
  });

  it('does not write legacy custom_agent_id for new preset cron jobs', () => {
    const result = resolveCronAgentConfig({
      agentValue: 'assistant-3',
      presetAssistants: [
        assistant({
          id: 'assistant-3',
          name: '社媒发布助手',
          engine_id: 'agent-claude',
          engine: engine('acp', 'claude'),
        }),
      ],
      getMode: () => 'default',
      tjuaecliModelRequiredMessage: 'provider required',
    });

    expect(result.agent_config).toBeDefined();
    expect(result.agent_config).not.toHaveProperty('custom_agent_id');
    expect(result.agent_config).not.toHaveProperty('preset_agent_type');
    expect(result.agent_config).not.toHaveProperty('is_preset');
  });

  it('throws when the selected assistant cannot be resolved', () => {
    expect(() =>
      resolveCronAgentConfig({
        agentValue: 'missing-assistant',
        presetAssistants: [],
        getMode: () => 'default',
        tjuaecliModelRequiredMessage: 'provider required',
      })
    ).toThrowError('assistant_id is required');
  });
});

function assistant(overrides: Partial<Assistant> & Pick<Assistant, 'id' | 'name' | 'engine_id'>): Assistant {
  return {
    id: overrides.id,
    source: 'user',
    name: overrides.name,
    name_i18n: {},
    description_i18n: {},
    enabled: true,
    sort_order: 0,
    engine_id: overrides.engine_id,
    enabled_skills: [],
    custom_skill_names: [],
    context_i18n: {},
    prompts: [],
    prompts_i18n: {},
    models: [],
    engine_status: 'online',
    team_selectable: true,
    deletable: true,
    ...overrides,
  };
}

function engine(type: string, backend?: string): AssistantEngineDescriptor {
  return {
    type,
    ownership: type === 'tjuaecli' ? 'internal' : 'builtin',
    acp_backend: backend,
  };
}
