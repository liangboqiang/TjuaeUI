import type { Assistant } from '@/common/types/agent/assistantTypes';

export type ResolvedGuidAssistantDefaults = {
  modelId?: string;
  permissionMode?: string;
  thoughtLevel?: string;
  skillIds: string[];
  mcpIds: string[];
};

export const resolveGuidAssistantDefaults = (
  assistant: Assistant | null | undefined
): ResolvedGuidAssistantDefaults => {
  if (!assistant) {
    return {
      modelId: undefined,
      permissionMode: undefined,
      thoughtLevel: undefined,
      skillIds: [],
      mcpIds: [],
    };
  }

  return {
    modelId: assistant.models[0] || undefined,
    permissionMode: assistant.permission || undefined,
    thoughtLevel: assistant.thought_level || undefined,
    skillIds: assistant.enabled_skills,
    mcpIds: assistant.mcp_ids,
  };
};
