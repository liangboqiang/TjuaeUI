/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

// Mirror of tjuaeui-api-types/src/assistant.rs.
// Any shape change on either side requires a same-PR update on the other.

export type AssistantSource = 'generated' | 'user';
export type AssistantEngineStatus = 'missing' | 'online' | 'offline' | 'unchecked';
export type AssistantEngineOwnership = 'internal' | 'builtin' | 'extension' | 'custom';

export type AssistantEngineDescriptor = {
  type: string;
  ownership: AssistantEngineOwnership;
  acp_backend?: string;
};

export function assistantRuntimeKey(assistant?: Pick<Assistant, 'engine'> | null): string {
  return assistant?.engine?.acp_backend || assistant?.engine?.type || '';
}

export function isTjuaeCliAssistant(assistant?: Pick<Assistant, 'engine'> | null): boolean {
  return assistant?.engine?.type === 'tjuaecli';
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
  engine_id: string;
  engine?: AssistantEngineDescriptor;
  enabled_skills: string[];
  custom_skill_names: string[];
  context?: string;
  context_i18n: Record<string, string>;
  prompts: string[];
  prompts_i18n: Record<string, string[]>;
  models: string[];
  last_used_at?: number;
  engine_status: AssistantEngineStatus;
  engine_status_message?: string;
  team_selectable: boolean;
  team_block_reason?: string;
  deletable: boolean;
}

export interface AssistantProfile {
  name: string;
  name_i18n: Record<string, string>;
  description?: string;
  description_i18n: Record<string, string>;
  avatar?: string;
}

export interface AssistantState {
  enabled: boolean;
  sort_order: number;
  last_used_at?: number;
}

export interface AssistantEngine {
  id: string;
  descriptor?: AssistantEngineDescriptor;
}

export interface AssistantRules {
  content: string;
  storage_mode: string;
}

export interface AssistantPrompts {
  recommended: string[];
  recommended_i18n: Record<string, string[]>;
}

export interface AssistantDefaultScalar {
  mode: string;
  value?: string;
}

export interface AssistantDefaultList {
  mode: string;
  value: string[];
}

export interface AssistantDefaults {
  model: AssistantDefaultScalar;
  permission: AssistantDefaultScalar;
  thought_level: AssistantDefaultScalar;
  skills: AssistantDefaultList;
  mcps: AssistantDefaultList;
}

export interface AssistantDefaultsRequest {
  model?: AssistantDefaultScalar;
  permission?: AssistantDefaultScalar;
  thought_level?: AssistantDefaultScalar;
  skills?: AssistantDefaultList;
  mcps?: AssistantDefaultList;
}

export interface AssistantCapabilities {
  default_skill_ids: string[];
  custom_skill_names: string[];
}

export interface AssistantPreferences {
  last_model_id?: string;
  last_permission_value?: string;
  last_thought_level_value?: string;
  last_skill_ids: string[];
  last_mcp_ids: string[];
}

export interface AssistantDetail {
  id: string;
  source: AssistantSource;
  engine_status: AssistantEngineStatus;
  engine_status_message?: string;
  team_selectable: boolean;
  team_block_reason?: string;
  deletable: boolean;
  profile: AssistantProfile;
  state: AssistantState;
  engine: AssistantEngine;
  rules: AssistantRules;
  prompts: AssistantPrompts;
  defaults: AssistantDefaults;
  capabilities: AssistantCapabilities;
  preferences: AssistantPreferences;
}

export interface CreateAssistantRequest {
  id?: string;
  name: string;
  description?: string;
  avatar?: string;
  engine_id?: string;
  enabled_skills?: string[];
  custom_skill_names?: string[];
  prompts?: string[];
  models?: string[];
  name_i18n?: Record<string, string>;
  description_i18n?: Record<string, string>;
  prompts_i18n?: Record<string, string[]>;
  recommended_prompts?: string[];
  recommended_prompts_i18n?: Record<string, string[]>;
  defaults?: AssistantDefaultsRequest;
}

export type UpdateAssistantRequest = Partial<Omit<CreateAssistantRequest, 'id'>> & {
  id: string;
};

export interface SetAssistantStateRequest {
  id: string;
  enabled?: boolean;
  sort_order?: number;
  last_used_at?: number;
}
