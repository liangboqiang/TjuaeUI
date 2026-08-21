import React from 'react';
import { Message } from '@arco-design/web-react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listCatalog: vi.fn(),
  importCatalog: vi.fn(),
  showOpen: vi.fn(),
  talkToButler: vi.fn(),
  navigate: vi.fn(),
  params: {} as { source?: string; namespace?: string; assistantName?: string },
  getCatalogDetail: vi.fn(),
  compareCatalogVersions: vi.fn(),
  copyToMine: vi.fn(),
  publishCatalog: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    assistants: {
      listCatalog: { invoke: mocks.listCatalog },
      importCatalog: { invoke: mocks.importCatalog },
      createMine: { invoke: vi.fn() },
      updateCatalogPreferences: { invoke: vi.fn() },
      prepareActivation: { invoke: vi.fn() },
      getCatalogDetail: { invoke: mocks.getCatalogDetail },
      compareCatalogVersions: { invoke: mocks.compareCatalogVersions },
      copyToMine: { invoke: mocks.copyToMine },
      exportCatalog: { invoke: vi.fn() },
      updateCatalogSettings: { invoke: vi.fn() },
      deleteCatalog: { invoke: vi.fn() },
      publishCatalog: { invoke: mocks.publishCatalog },
    },
    dialog: { showOpen: { invoke: mocks.showOpen } },
  },
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
}));
vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/renderer/hooks/assistant/useTalkToButler', () => ({
  useTalkToButler: () => mocks.talkToButler,
}));
vi.mock('@/renderer/pages/conversation/Preview/components/viewers/MarkdownViewer', () => ({
  default: ({ content }: { content: string }) => <article data-testid='rendered-readme'>{content}</article>,
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
        'settings.assistantCatalog.backToList': '全部助手',
        'settings.assistantCatalog.copyToMine': '复制到我的助手',
        'settings.assistantCatalog.copyTitle': '复制助手',
        'settings.assistantCatalog.copySuccess': '助手已复制',
        'settings.assistantCatalog.slugPlaceholder': '助手标识',
        'settings.assistantCatalog.export': '导出',
        'settings.assistantCatalog.publish': '发布新版本',
        'settings.assistantCatalog.publishTitle': '发布助手新版本',
        'settings.assistantCatalog.publishVersion': '版本号',
        'settings.assistantCatalog.publishNotes': '发布说明',
        'settings.assistantCatalog.publishPlaceholder': '说明本次更新',
        'settings.assistantCatalog.publishSuccess': '助手版本已发布',
        'settings.assistantCatalog.version': '版本',
        'settings.assistantCatalog.tabs.overview': '概述',
        'settings.assistantCatalog.tabs.settings': '设置',
        'settings.assistantCatalog.tabs.versions': '版本历史',
        'settings.assistantCatalog.tabs.compare': '版本比较',
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

const remoteAssistant = {
  ...assistant,
  identity: { source: 'tjuae-hub' as const, namespace: 'official', slug: 'writer' },
  editable: false,
  canDelete: false,
};

const remoteDetail = {
  item: remoteAssistant,
  manifest: {
    format: 'tjuae-assistant',
    formatVersion: 1,
    id: 'writer',
    version: '1.0.0',
    name: 'Writer',
    nameI18n: {},
    description: '写作助手',
    descriptionI18n: {},
    categories: ['写作'],
    defaults: {
      model: { mode: 'auto' },
      permission: { mode: 'auto' },
      thoughtLevel: { mode: 'auto' },
      skills: [],
      mcps: [],
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
    mocks.params = {};
    vi.spyOn(Message, 'success').mockImplementation(() => undefined as never);
    mocks.listCatalog.mockImplementation(async ({ source }: { source: string }) => ({
      items: source === 'mine' ? [assistant] : [],
      total: source === 'mine' ? 1 : 0,
    }));
    mocks.showOpen.mockResolvedValue(['C:\\packages\\writer.zip']);
    mocks.importCatalog.mockResolvedValue({ item: assistant });
    mocks.getCatalogDetail.mockResolvedValue(remoteDetail);
    mocks.copyToMine.mockResolvedValue({
      ...remoteDetail,
      item: { ...assistant, identity: { source: 'mine', namespace: '', slug: 'writer-copy' } },
      manifest: { ...remoteDetail.manifest, id: 'writer-copy' },
    });
    mocks.publishCatalog.mockResolvedValue({ commit: 'abc123' });
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

  it('closes the copy dialog and enters the new local assistant after a successful copy', async () => {
    mocks.params = { source: 'tjuae-hub', namespace: 'official', assistantName: 'writer' };
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '复制到我的助手' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText(/确定|OK/u));

    await waitFor(() =>
      expect(mocks.copyToMine).toHaveBeenCalledWith({
        source: 'tjuae-hub',
        namespace: 'official',
        slug: 'writer',
        version: '1.0.0',
        targetSlug: 'writer-copy',
      })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mocks.navigate).toHaveBeenCalledWith('/settings/assistants/mine/~/writer-copy');
  });

  it('publishes a saved local assistant as an explicit newer version with release notes', async () => {
    mocks.params = { source: 'mine', namespace: '~', assistantName: 'writer' };
    mocks.getCatalogDetail.mockResolvedValue({ ...remoteDetail, item: assistant });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '发布新版本' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByDisplayValue('1.0.1')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText('说明本次更新'), { target: { value: '补齐固定配置' } });
    fireEvent.click(within(dialog).getByText(/确定|OK/u));

    await waitFor(() =>
      expect(mocks.publishCatalog).toHaveBeenCalledWith({
        source: 'mine',
        namespace: '',
        slug: 'writer',
        version: '1.0.1',
        message: '补齐固定配置',
      })
    );
  });
});
