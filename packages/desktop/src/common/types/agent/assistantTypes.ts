// 会话、团队、定时任务和频道共享的已激活助手选择模型。

import type { AssistantRuntimeOption } from '../platform/assistantCatalog';

export type AssistantSource = 'mine' | 'tjuae-hub';
export type AssistantAgentStatus = 'missing' | 'online' | 'offline' | 'unchecked';
export type AssistantAgentSource = 'internal' | 'builtin' | 'extension' | 'custom';

export type AssistantAgent = {
  type: string;
  source: AssistantAgentSource;
  acp_backend?: string;
};

export function assistantRuntimeKey(assistant?: Pick<Assistant, 'agent'> | null): string {
  return assistant?.agent?.acp_backend || assistant?.agent?.type || '';
}

export function isTjuaeCliAssistant(assistant?: Pick<Assistant, 'agent'> | null): boolean {
  return assistant?.agent?.type === 'tjuaecli';
}

export interface Assistant {
  id: string;
  source: AssistantSource;
  name: string;
  name_i18n: Record<string, string>;
  description?: string;
  description_i18n: Record<string, string>;
  avatar?: string;
  enabled: boolean;
  sort_order: number;
  agent_id: string;
  agent?: AssistantAgent;
  enabled_skills: string[];
  context?: string;
  context_i18n: Record<string, string>;
  prompts: string[];
  prompts_i18n: Record<string, string[]>;
  models: string[];
  permission?: string;
  thought_level?: string;
  mcp_ids: string[];
  last_used_at?: number;
  agent_status: AssistantAgentStatus;
  agent_status_message?: string;
  team_selectable: boolean;
  team_block_reason?: string;
  deletable: boolean;
}

/**
 * 将唯一的已激活目录运行时视图投影为各业务选择器共用的紧凑展示模型。
 * 这里不补造未激活助手，也不读取旧助手接口。
 */
export function toAssistantSelectionItem(option: AssistantRuntimeOption): Assistant {
  return {
    id: option.id,
    source: option.identity.source,
    name: option.name,
    name_i18n: option.nameI18n,
    description: option.description,
    description_i18n: option.descriptionI18n,
    avatar: option.avatarUrl,
    enabled: true,
    sort_order: option.sortOrder,
    agent_id: option.agentId,
    agent: option.agent
      ? {
          type: option.agent.agentType,
          source: option.agent.source,
          acp_backend: option.agent.backend,
        }
      : undefined,
    enabled_skills: option.skillIds,
    context_i18n: {},
    prompts: option.recommendedPrompts,
    prompts_i18n: option.recommendedPromptsI18n,
    models: option.modelIds,
    permission: option.permission,
    thought_level: option.thoughtLevel,
    mcp_ids: option.mcpIds,
    last_used_at: option.lastUsedAt,
    agent_status: option.agentStatus,
    team_selectable: option.teamSelectable,
    deletable: option.identity.source === 'mine',
  };
}
