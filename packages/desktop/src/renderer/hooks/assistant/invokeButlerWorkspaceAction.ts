import { ipcBridge } from '@/common';
import type { Assistant } from '@/common/types/agent/assistantTypes';

const BUTLER_ASSISTANT_ID = 'tjuaeui-assistant';
const ACTION_TIMEOUT_MS = 120_000;

const findButler = (assistants: Assistant[]): Assistant | undefined =>
  assistants.find((assistant) => assistant.id.replace(/^builtin-/, '') === BUTLER_ASSISTANT_ID);

const waitForButlerResponse = async (conversationId: string, prompt: string): Promise<string> => {
  let content = '';
  let unsubscribe: (() => void) | undefined;
  let timeoutId: number | undefined;

  const response = new Promise<string>((resolve, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('BUTLER_ACTION_TIMEOUT')), ACTION_TIMEOUT_MS);
    unsubscribe = ipcBridge.conversation.responseStream.on((message) => {
      if (message.conversation_id !== conversationId) return;
      if (message.type === 'content' && typeof message.data === 'string') {
        content = message.replace ? message.data : content + message.data;
        return;
      }
      if (message.type === 'error') {
        reject(new Error('BUTLER_ACTION_FAILED'));
        return;
      }
      if (message.type === 'finish') {
        const result = content.trim();
        if (!result) reject(new Error('BUTLER_ACTION_EMPTY'));
        else resolve(result);
      }
    });
  });

  try {
    await ipcBridge.conversation.sendMessage.invoke({ conversation_id: conversationId, input: prompt });
    return await response;
  } finally {
    unsubscribe?.();
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
};

/** Execute a one-shot, hidden workspace task with the built-in TjuaeUI Butler. */
export const invokeButlerWorkspaceAction = async (workspace: string, prompt: string): Promise<string> => {
  const assistants = await ipcBridge.assistants.list.invoke();
  const butler = findButler(assistants);
  if (!butler) throw new Error('BUTLER_NOT_AVAILABLE');
  if (butler.enabled === false) {
    await ipcBridge.assistants.setState.invoke({ id: butler.id, enabled: true });
  }

  const conversation = await ipcBridge.conversation.create.invoke({
    assistant: { id: butler.id },
    name: 'TjuaeUI Butler · Workspace action',
    extra: {
      workspace,
      custom_workspace: true,
      system_action: true,
    },
  });

  try {
    await ipcBridge.conversation.ensureRuntime.invoke({ conversation_id: conversation.id });
    return await waitForButlerResponse(conversation.id, prompt);
  } finally {
    await ipcBridge.conversation.remove.invoke({ id: conversation.id }).catch(() => false);
  }
};
