import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from '@arco-design/web-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

vi.mock('@/renderer/hooks/context/ThemeContext', () => ({
  useThemeContext: () => ({ theme: 'light' }),
}));

vi.mock('@/renderer/components/chat/EmojiPicker', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@uiw/react-codemirror', () => ({
  default: () => <div data-testid='codemirror-stub' />,
}));

const testCustomAgentMock = vi.fn();
const testA2aAgentMock = vi.fn();
vi.mock('@/common/adapter/ipcBridge', () => ({
  acpConversation: {
    testCustomAgent: { invoke: (...args: unknown[]) => testCustomAgentMock(...args) },
    testA2aAgent: { invoke: (...args: unknown[]) => testA2aAgentMock(...args) },
  },
}));

import InlineAgentEditor from '@/renderer/pages/settings/AgentSettings/InlineAgentEditor';

const renderEditor = () =>
  render(
    <ConfigProvider>
      <InlineAgentEditor onSave={vi.fn()} onCancel={vi.fn()} />
    </ConfigProvider>
  );

const fillCommandAndTest = async (user: ReturnType<typeof userEvent.setup>, command: string) => {
  const commandInput = document.querySelectorAll('.arco-input')[1] as HTMLInputElement;
  await act(async () => {
    await user.type(commandInput, command);
  });
  const testBtn = screen.getByRole('button', { name: /testConnectionBtn/i });
  await act(async () => {
    await user.click(testBtn);
  });
};

describe('InlineAgentEditor managed runtime feedback', () => {
  beforeEach(() => {
    testCustomAgentMock.mockReset();
    testA2aAgentMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows fail_cli details returned by the backend', async () => {
    testCustomAgentMock.mockResolvedValue({
      step: 'fail_cli',
      error: 'managed node runtime unsupported on linux/x86',
    });
    const user = userEvent.setup();
    renderEditor();

    await fillCommandAndTest(user, 'npx @acme/agent');

    await waitFor(() => {
      expect(screen.getByText('settings.testConnectionFailCli')).toBeInTheDocument();
    });
    expect(screen.getByText(/managed node runtime unsupported/i)).toBeInTheDocument();
  });

  it('shows fail_acp details returned by the backend', async () => {
    testCustomAgentMock.mockResolvedValue({
      step: 'fail_acp',
      error: 'CLI exited before ACP initialize completed (status=1)',
    });
    const user = userEvent.setup();
    renderEditor();

    await fillCommandAndTest(user, 'npx @acme/agent');

    await waitFor(() => {
      expect(screen.getByText('settings.testConnectionFailAcp')).toBeInTheDocument();
    });
    expect(screen.getByText(/CLI exited before ACP initialize completed/i)).toBeInTheDocument();
  });

  it('switches to A2A discovery without requiring a local command', async () => {
    testA2aAgentMock.mockResolvedValue({
      name: 'Remote Planner',
      version: '1.0.0',
      endpoint: 'https://agent.example.com/.well-known/agent-card.json',
    });
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('settings.agentProtocolA2a'));
    await user.type(screen.getByPlaceholderText('https://agent.example.com'), 'https://agent.example.com');
    await user.click(screen.getByRole('button', { name: /testConnectionBtn/i }));

    await waitFor(() => {
      expect(testA2aAgentMock).toHaveBeenCalledWith({
        endpoint: 'https://agent.example.com',
        auth_type: undefined,
        auth_token: undefined,
        allow_insecure: false,
      });
      expect(screen.getByText('settings.testConnectionSuccessA2a')).toBeInTheDocument();
    });
  });
});
