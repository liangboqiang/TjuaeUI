import { beforeEach, describe, expect, it, vi } from 'vitest';

const listSelectableMock = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    assistants: {
      listSelectable: {
        invoke: (...args: unknown[]) => listSelectableMock(...args),
      },
    },
  },
}));

import { resolveDefaultTeamAgentModel } from '@/renderer/pages/team/components/teamCreateModelResolver';

describe('resolveDefaultTeamAgentModel', () => {
  beforeEach(() => {
    listSelectableMock.mockReset();
  });

  it('uses the first model resolved by the activated assistant runtime', async () => {
    listSelectableMock.mockResolvedValue([
      {
        id: 'mine:tjuae:assistant-fixed',
        models: ['claude-sonnet-4-5-20250514'],
        agent: { type: 'acp', source: 'builtin', acp_backend: 'claude' },
      },
    ]);

    await expect(resolveDefaultTeamAgentModel({ assistant_id: 'mine:tjuae:assistant-fixed' })).resolves.toBe(
      'claude-sonnet-4-5-20250514'
    );
  });

  it('uses the assistant runtime backend when no explicit model is resolved', async () => {
    listSelectableMock.mockResolvedValue([
      {
        id: 'mine:tjuae:assistant-gemini',
        models: [],
        agent: { type: 'acp', source: 'builtin', acp_backend: 'gemini' },
      },
    ]);

    await expect(resolveDefaultTeamAgentModel({ assistant_id: 'mine:tjuae:assistant-gemini' })).resolves.toBe('auto');
  });

  it('uses the TjuaeCLI backend default for an activated TjuaeCLI assistant', async () => {
    listSelectableMock.mockResolvedValue([
      {
        id: 'tjuae-hub:tjuae:tjuaeui-assistant',
        models: [],
        agent: { type: 'tjuaecli', source: 'internal', acp_backend: 'tjuaecli' },
      },
    ]);

    await expect(resolveDefaultTeamAgentModel({ assistant_id: 'tjuae-hub:tjuae:tjuaeui-assistant' })).resolves.toBe(
      'default'
    );
  });

  it('uses the provided backend when the activated runtime lookup fails', async () => {
    listSelectableMock.mockRejectedValue(new Error('lookup failed'));

    await expect(
      resolveDefaultTeamAgentModel({
        assistant_id: 'mine:tjuae:assistant-gemini',
        assistant_backend: 'gemini',
      })
    ).resolves.toBe('auto');
  });
});
