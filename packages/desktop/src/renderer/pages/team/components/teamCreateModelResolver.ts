import { ipcBridge } from '@/common';
import { assistantRuntimeKey, type Assistant } from '@/common/types/agent/assistantTypes';

/**
 * Resolve the `model` value a team agent should send to `POST /api/teams`.
 *
 * Backend `service.rs` consumes `input.model` verbatim with no default, so an
 * empty or backend-name-only value (e.g. "gemini") ends up persisted as
 * `use_model: null`. Downstream, GeminiSendBox / TjuaeCliSendBox gate the
 * textarea on `current_model?.useModel` and render disabled. See mnemo #297.
 *
 * This resolver reads assistant-owned defaults first and then falls back to
 * backend-safe defaults when the selected assistant has no explicit model.
 *
 * For ACP backends (claude, codex, acp) the model is resolved from the
 * agent's handshake data or cached model info so the backend receives a
 * valid model ID (e.g. "claude-sonnet-4-5-20250514") instead of the bare
 * backend name.
 */
export async function resolveDefaultTeamAgentModel(params: {
  assistant_id?: string;
  assistant_backend?: string;
}): Promise<string> {
  const { assistant_id, assistant_backend } = params;

  const assistant = await resolveAssistant(assistant_id);
  if (assistant) {
    const assistantModel = assistant.models[0];
    if (assistantModel) {
      return assistantModel;
    }

    return resolveBackendDefaultModel(assistantRuntimeKey(assistant));
  }

  return resolveBackendDefaultModel(assistant_backend);
}

async function resolveAssistant(assistant_id?: string): Promise<Assistant | undefined> {
  if (!assistant_id) return undefined;

  try {
    const assistants = await ipcBridge.assistants.listSelectable.invoke();
    return assistants.find((assistant) => assistant.id === assistant_id);
  } catch {
    return undefined;
  }
}

function resolveBackendDefaultModel(assistant_backend?: string): Promise<string> {
  if (assistant_backend === 'gemini') {
    return resolveGeminiDefaultModel();
  }

  if (assistant_backend === 'tjuaecli') {
    return resolveTjuaeCliDefaultModel();
  }

  return resolveAcpDefaultModel(assistant_backend ?? 'acp');
}

async function resolveAcpDefaultModel(_assistant_backend: string): Promise<string> {
  return 'default';
}

async function resolveGeminiDefaultModel(): Promise<string> {
  // The legacy 'gemini.defaultModel' config key has been removed after the
  // Gemini → ACP consolidation. Always fall back to the 'auto' alias.
  return 'auto';
}

async function resolveTjuaeCliDefaultModel(): Promise<string> {
  return 'default';
}
