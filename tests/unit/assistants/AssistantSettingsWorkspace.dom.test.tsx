import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listSkillCatalog: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: { listSkillCatalog: { invoke: mocks.listSkillCatalog } },
    dialog: { showOpen: { invoke: vi.fn() } },
  },
}));
vi.mock('@/renderer/hooks/agent/useManagedAgents', () => ({
  useManagedAgentRuntimeCatalog: () => [
    {
      id: 'codex',
      backend: 'codex',
      name: 'Codex',
      enabled: true,
      installed: true,
    },
  ],
}));
vi.mock('@/renderer/hooks/agent/useModelProviderList', () => ({
  useModelProviderList: () => ({ providers: [], getAvailableModels: () => [] }),
}));
vi.mock('@/renderer/hooks/mcp/catalog', () => ({
  ensureBackendMcpCatalog: async () => ({
    allServers: [
      { id: 'filesystem', name: 'Filesystem', enabled: true },
      { id: 'disabled-server', name: 'Disabled server', enabled: false },
    ],
  }),
}));
vi.mock('@/renderer/utils/model/agentRuntimeCatalog', () => ({
  buildAgentRuntimeModelInfo: () => ({ available_models: [{ id: 'gpt-5.6', label: 'GPT-5.6' }] }),
  buildAgentRuntimeModeState: () => ({ options: [{ value: 'admin', label: 'Admin mode' }] }),
  buildAgentRuntimeThoughtLevelOption: () => ({ options: [{ value: 'high', label: 'High thinking' }] }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'zh-CN' },
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

import type { AssistantCatalogDetail } from '@/common/types/platform/assistantCatalog';
import AssistantSettingsWorkspace from '@/renderer/pages/settings/AssistantSettings/AssistantSettingsWorkspace';

const detail: AssistantCatalogDetail = {
  item: {
    identity: { source: 'mine', namespace: '', slug: 'writer' },
    name: 'Writer',
    description: '写作助手',
    latestVersion: '1.0.0',
    categories: [],
    tags: [],
    editable: true,
    system: false,
    canDisable: true,
    canDelete: true,
    preferences: { followLatest: false, enabled: true, activationStatus: 'ready', sortOrder: 0 },
  },
  manifest: {
    format: 'tjuae-assistant',
    formatVersion: 1,
    id: 'writer',
    version: '1.0.0',
    name: 'Writer',
    nameI18n: {},
    description: '写作助手',
    descriptionI18n: {},
    categories: [],
    tags: [],
    defaults: {
      agent: 'codex',
      model: { mode: 'fixed', value: 'gpt-5.6' },
      permission: { mode: 'fixed', value: 'admin' },
      thoughtLevel: { mode: 'fixed', value: 'high' },
      skills: [{ source: 'mine', namespace: '', slug: 'writing' }],
      mcps: ['filesystem', 'disabled-server'],
    },
    requirements: [],
    recommendedPrompts: [],
    recommendedPromptsI18n: {},
    contentHash: 'hash',
  },
  readme: '# Writer',
  files: [],
  versions: [{ version: '1.0.0', revision: 'main', digest: 'hash' }],
};

describe('AssistantSettingsWorkspace', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listSkillCatalog.mockResolvedValue({
      items: [
        {
          identity: { source: 'mine', namespace: '', slug: 'writing' },
          name: 'Writing',
          description: '写作技能',
          latestVersion: '1.0.0',
        },
      ],
      total: 1,
    });
  });

  it('restores capability-backed defaults and keeps every configured MCP visible', async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <AssistantSettingsWorkspace detail={detail} busy={false} onSave={vi.fn()} />
      </SWRConfig>
    );

    fireEvent.click(screen.getByRole('button', { name: 'settings.assistantDefaultConfigSection' }));

    expect(await screen.findByText('GPT-5.6')).toBeInTheDocument();
    expect(screen.getByText('Admin mode')).toBeInTheDocument();
    expect(screen.getByText('High thinking')).toBeInTheDocument();
    expect(screen.getByText('Writing')).toBeInTheDocument();
    expect(screen.getByText('Filesystem')).toBeInTheDocument();
    expect(screen.getByText('Disabled server')).toBeInTheDocument();
    await waitFor(() => expect(mocks.listSkillCatalog).toHaveBeenCalledWith({ enabled: true, limit: 200 }));
  });
});
