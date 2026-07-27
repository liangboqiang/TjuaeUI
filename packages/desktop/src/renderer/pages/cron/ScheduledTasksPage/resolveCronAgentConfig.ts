/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ICronAgentConfigWrite } from '@/common/adapter/ipcBridge';
import { isTjuaeCliAssistant, type Assistant } from '@/common/types/agent/assistantTypes';
import { resolveAssistantName } from '@renderer/utils/model/assistantDisplay';

type SelectedTjuaeCliProvider = {
  id?: string;
  name?: string;
};

type ResolveCronAgentConfigInput = {
  agentValue: string;
  presetAssistants: Assistant[];
  selectedTjuaeCliProvider?: SelectedTjuaeCliProvider;
  model_id?: string;
  config_options?: Record<string, string>;
  workspace?: string;
  localeKey?: string;
  getMode: (assistant: Assistant) => string | undefined;
  tjuaecliModelRequiredMessage: string;
};

type ResolveCronAgentConfigResult = {
  agent_config: ICronAgentConfigWrite | undefined;
};

export function resolveCronAgentConfig(input: ResolveCronAgentConfigInput): ResolveCronAgentConfigResult {
  const {
    agentValue,
    presetAssistants,
    selectedTjuaeCliProvider,
    model_id,
    config_options,
    workspace,
    localeKey = 'en-US',
    getMode,
    tjuaecliModelRequiredMessage,
  } = input;

  const colonIdx = agentValue.indexOf(':');
  const prefixedId = colonIdx >= 0 ? agentValue.substring(colonIdx + 1) : agentValue;
  const assistantSelection = presetAssistants.find((item) => item.id === prefixedId || item.id === agentValue);
  if (!assistantSelection) {
    throw new Error('assistant_id is required');
  }

  let agent_config: ICronAgentConfigWrite | undefined;

  const assistant = assistantSelection;
  const assistantName = resolveAssistantName(assistant, localeKey, assistant.name);
  const mode = getMode(assistant);

  if (isTjuaeCliAssistant(assistant)) {
    if (!selectedTjuaeCliProvider?.id || !model_id) {
      throw new Error(tjuaecliModelRequiredMessage);
    }
    agent_config = {
      name: assistantName,
      assistant_id: assistant.id,
      mode,
      model_id,
      model: {
        provider_id: selectedTjuaeCliProvider.id,
        model: model_id,
        use_model: model_id,
      },
      workspace,
    };
  } else {
    agent_config = {
      name: assistantName,
      assistant_id: assistant.id,
      mode,
      model_id,
      config_options,
      workspace,
    };
  }

  return { agent_config };
}
