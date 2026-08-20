import React from 'react';
import { Message } from '@arco-design/web-react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listCatalog: vi.fn(),
  importCatalog: vi.fn(),
  showOpen: vi.fn(),
  talkToButler: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    assistants: {
      listCatalog: { invoke: mocks.listCatalog },
      importCatalog: { invoke: mocks.importCatalog },
      createMine: { invoke: vi.fn() },
      updateCatalogPreferences: { invoke: vi.fn() },
      prepareActivation: { invoke: vi.fn() },
    },
    dialog: { showOpen: { invoke: mocks.showOpen } },
  },
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({}),
}));
vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/renderer/hooks/assistant/useTalkToButler', () => ({
  useTalkToButler: () => mocks.talkToButler,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const labels: Record<string, string> = {
        'settings.assistantCatalog.title': '助手',
        'settings.assistantCatalog.description': '统一助手目录',
        'settings.assistantCatalog.add': '添加助手',
        'settings.assistantCatalog.importAssistant': '导入助手',
        'settings.assistantCatalog.packageFile': '助手包',
        'settings.assistantCatalog.importSuccess': '助手已导入',
        'settings.assistantCatalog.searchPlaceholder': '搜索助手...',
        'settings.assistantCatalog.allSources': '全部来源',
        'settings.assistantCatalog.allStatuses': '全部状态',
        'settings.assistantCatalog.enabledOnly': '已启用',
        'settings.assistantCatalog.disabledOnly': '未启用',
        'settings.assistantCatalog.enabled': '启用',
        'settings.assistantCatalog.noDescription': '暂无说明',
        'settings.assistantCatalog.loadedCount': `已加载 ${String(options?.count ?? 0)} 个助手`,
        'settings.assistantCatalog.sources.mine': '我的助手',
        'settings.assistantCatalog.sources.tjuaeHub': 'TjuaeHub',
        'settings.assistantCatalog.activationStatus.ready': '就绪',
        'settings.talkToButler.addViaChat': '通过对话添加',
        'settings.talkToButler.addManually': '手动添加',
        'settings.talkToButler.prompt.createAssistant': '帮我创建一个新助手',
      };
      return labels[key] ?? key;
    },
  }),
}));

import AssistantSettings from '@/renderer/pages/settings/AssistantSettings';

const assistant = {
  identity: { source: 'mine' as const, namespace: '', slug: 'writer' },
  name: 'Writer',
  description: '写作助手',
  avatarUrl: '/api/assistant-assets/mine/~/writer?path=avatar.png',
  latestVersion: '1.0.0',
  categories: ['写作'],
  tags: [],
  editable: true,
  system: false,
  canDisable: true,
  canDelete: true,
  preferences: {
    selectedVersion: '1.0.0',
    followLatest: false,
    enabled: true,
    activationStatus: 'ready',
    sortOrder: 0,
  },
};

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <AssistantSettings />
    </SWRConfig>
  );

describe('AssistantCatalogPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Message, 'success').mockImplementation(() => undefined as never);
    mocks.listCatalog.mockImplementation(async ({ source }: { source: string }) => ({
      items: source === 'mine' ? [assistant] : [],
      total: source === 'mine' ? 1 : 0,
    }));
    mocks.showOpen.mockResolvedValue(['C:\\packages\\writer.zip']);
    mocks.importCatalog.mockResolvedValue({ item: assistant });
  });

  it('uses the shared search/add header and exposes import, manual, and chat creation', async () => {
    renderPage();

    expect(await screen.findByPlaceholderText('搜索助手...')).toBeInTheDocument();
    const addButton = screen.getByRole('button', { name: '添加助手' });
    fireEvent.click(addButton);
    expect(await screen.findByText('导入助手')).toBeInTheDocument();
    expect(screen.getByText('手动添加')).toBeInTheDocument();
    expect(screen.getByText('通过对话添加')).toBeInTheDocument();

    fireEvent.click(screen.getByText('导入助手'));
    await waitFor(() => expect(mocks.importCatalog).toHaveBeenCalledWith({ archivePath: 'C:\\packages\\writer.zip' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/settings/assistants/mine/~/writer');

    fireEvent.click(addButton);
    fireEvent.click(await screen.findByText('通过对话添加'));
    expect(mocks.talkToButler).toHaveBeenCalledWith({ prompt: '帮我创建一个新助手', files: undefined });
  });

  it('renders the assistant avatar in the catalog card and falls back only after an image error', async () => {
    renderPage();
    const card = await screen.findByRole('button', { name: /Writer/u });
    const image = card.querySelector('img');
    expect(image).not.toBeNull();
    fireEvent.error(image!);
    expect(card.querySelector('img')).toBeNull();
    expect(card).toHaveTextContent('W');
  });
});
