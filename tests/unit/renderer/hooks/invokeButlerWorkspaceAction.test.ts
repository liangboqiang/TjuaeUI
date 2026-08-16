// @vitest-environment jsdom

import { invokeButlerWorkspaceAction } from '@/renderer/hooks/assistant/invokeButlerWorkspaceAction';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type StreamMessage = {
  conversation_id: string;
  type: string;
  data?: string;
  replace?: boolean;
};

const bridge = vi.hoisted(() => {
  const state: { handler?: (message: StreamMessage) => void } = {};
  return {
    state,
    list: vi.fn(),
    setState: vi.fn(),
    create: vi.fn(),
    ensureRuntime: vi.fn(),
    sendMessage: vi.fn(),
    remove: vi.fn(),
    on: vi.fn((handler: (message: StreamMessage) => void) => {
      state.handler = handler;
      return vi.fn();
    }),
  };
});

vi.mock('@/common', () => ({
  ipcBridge: {
    assistants: {
      list: { invoke: bridge.list },
      setState: { invoke: bridge.setState },
    },
    conversation: {
      create: { invoke: bridge.create },
      ensureRuntime: { invoke: bridge.ensureRuntime },
      sendMessage: { invoke: bridge.sendMessage },
      remove: { invoke: bridge.remove },
      responseStream: { on: bridge.on },
    },
  },
}));

describe('invokeButlerWorkspaceAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bridge.state.handler = undefined;
    bridge.list.mockResolvedValue([{ id: 'builtin-tjuaeui-assistant', enabled: false }]);
    bridge.setState.mockResolvedValue(true);
    bridge.create.mockResolvedValue({ id: 'system-action-conversation' });
    bridge.ensureRuntime.mockResolvedValue(true);
    bridge.remove.mockResolvedValue(true);
    bridge.sendMessage.mockImplementation(async () => {
      bridge.state.handler?.({
        conversation_id: 'system-action-conversation',
        type: 'content',
        data: '<COMMIT_MESSAGE>完善 Git 工作台</COMMIT_MESSAGE>',
      });
      bridge.state.handler?.({ conversation_id: 'system-action-conversation', type: 'finish' });
      return true;
    });
  });

  it('uses the built-in Butler in a hidden workspace conversation and removes it afterwards', async () => {
    const result = await invokeButlerWorkspaceAction('C:\\workspace', '生成提交说明');

    expect(result).toBe('<COMMIT_MESSAGE>完善 Git 工作台</COMMIT_MESSAGE>');
    expect(bridge.setState).toHaveBeenCalledWith({ id: 'builtin-tjuaeui-assistant', enabled: true });
    expect(bridge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        assistant: { id: 'builtin-tjuaeui-assistant' },
        extra: expect.objectContaining({
          workspace: 'C:\\workspace',
          custom_workspace: true,
          system_action: true,
        }),
      })
    );
    expect(bridge.ensureRuntime).toHaveBeenCalledWith({ conversation_id: 'system-action-conversation' });
    expect(bridge.sendMessage).toHaveBeenCalledWith({
      conversation_id: 'system-action-conversation',
      input: '生成提交说明',
    });
    expect(bridge.remove).toHaveBeenCalledWith({ id: 'system-action-conversation' });
  });
});
