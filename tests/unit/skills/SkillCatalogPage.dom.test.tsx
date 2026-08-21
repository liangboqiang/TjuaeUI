import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listSkillCatalog: vi.fn(),
  getSkillCatalogDetail: vi.fn(),
  getSkillCatalogFile: vi.fn(),
  compareSkillVersions: vi.fn(),
  updateSkillPreferences: vi.fn(),
  copySkillToMine: vi.fn(),
  importSkill: vi.fn(),
  updateSkillProfile: vi.fn(),
  showOpen: vi.fn(),
  talkToButler: vi.fn(),
  navigate: vi.fn(),
  params: {} as { source?: string; namespace?: string; skillName?: string },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      listSkillCatalog: { invoke: mocks.listSkillCatalog },
      getSkillCatalogDetail: { invoke: mocks.getSkillCatalogDetail },
      getSkillCatalogFile: { invoke: mocks.getSkillCatalogFile },
      compareSkillVersions: { invoke: mocks.compareSkillVersions },
      updateSkillPreferences: { invoke: mocks.updateSkillPreferences },
      copySkillToMine: { invoke: mocks.copySkillToMine },
      saveSkillCatalogFile: { invoke: vi.fn() },
      updateSkillProfile: { invoke: mocks.updateSkillProfile },
      publishSkillToTjuaeHub: { invoke: vi.fn() },
      exportSkill: { invoke: vi.fn() },
      importSkill: { invoke: mocks.importSkill },
      createSkill: { invoke: vi.fn() },
      deleteSkill: { invoke: vi.fn() },
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
vi.mock('@/renderer/pages/conversation/Preview/components/viewers/MarkdownViewer', () => ({
  default: ({ content }: { content: string }) => <article data-testid='rendered-readme'>{content}</article>,
}));
vi.mock('@/renderer/hooks/assistant/useTalkToButler', () => ({
  useTalkToButler: () => mocks.talkToButler,
}));
vi.mock('@arco-design/web-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@arco-design/web-react')>();
  return {
    ...actual,
    Message: { ...actual.Message, success: vi.fn(), error: vi.fn() },
  };
});
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const labels: Record<string, string> = {
        'settings.skillsHub.title': '技能',
        'settings.skillsHub.catalogDescription': '统一技能目录',
        'settings.skillsHub.spaces.mine': '我的技能',
        'settings.skillsHub.spaces.tjuaeHub': 'TjuaeHub',
        'settings.skillsHub.spaces.skillHub': 'SkillHub',
        'settings.skillsHub.spaces.clawHub': 'ClawHub',
        'settings.skillsHub.allSources': '全部来源',
        'settings.skillsHub.allStatuses': '全部状态',
        'settings.skillsHub.enabledOnly': '已启用',
        'settings.skillsHub.autoInjectOnly': '自动加入新助手',
        'settings.skillsHub.enabled': '启用',
        'settings.skillsHub.autoInject': '自动加入新助手',
        'settings.skillsHub.autoInjectHint': '只影响之后新建的助手',
        'settings.skillsHub.addSkill': '添加技能',
        'settings.skillsHub.importSkill': '导入技能',
        'settings.skillsHub.addManually': '手动添加',
        'settings.talkToButler.addViaChat': '通过对话添加',
        'settings.skillsHub.importZip': '导入技能包',
        'settings.skillsHub.skillCount': `共 ${String(options?.count ?? 0)} 个技能`,
        'settings.skillsHub.copyToMine': '复制到我的技能',
        'settings.skillsHub.tabs.overview': '概览',
        'settings.skillsHub.tabs.files': '文件',
        'settings.skillsHub.tabs.versions': '版本',
        'settings.skillsHub.versionCompare': '版本比较',
        'settings.skillsHub.version': '版本',
        'settings.skillsHub.export': '导出',
        'settings.skillsHub.readOnly': '只读',
        'settings.skillsHub.baseVersion': '基准版本',
        'settings.skillsHub.targetVersion': '目标版本',
        'settings.skillsHub.latestVersion': '最新',
        'settings.skillsHub.detailBackToList': '全部技能',
        'settings.skillsHub.copyTitle': '复制技能',
        'settings.skillsHub.copyDescription': '复制当前版本',
        'settings.skillsHub.copyPlaceholder': '新技能标识',
        'settings.skillsHub.copySuccess': '技能已复制',
        'settings.skillsHub.importSuccess': '技能已导入',
      };
      return labels[key] ?? key;
    },
  }),
}));

import SkillsHubSettings from '@/renderer/pages/settings/SkillsSettings/SkillsHubSettings';

const remoteSkill = {
  identity: { source: 'skillhub' as const, namespace: 'alice', slug: 'cron' },
  name: 'cron',
  description: '定时任务技能',
  latestVersion: '2.0.0',
  categories: ['自动化'],
  tags: ['schedule'],
  author: 'Alice',
  preferences: {
    selectedVersion: '2.0.0',
    followLatest: false,
    enabled: true,
    autoInject: false,
  },
  editable: false,
  canCopyToMine: true,
  canPublishToTjuaeHub: false,
};

const detail = {
  skill: remoteSkill,
  selectedVersion: '2.0.0',
  readme: '# 定时任务',
  files: [{ path: 'SKILL.md', size: 128 }],
  versions: [{ version: '2.0.0' }, { version: '1.0.0' }],
};

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SkillsHubSettings />
    </SWRConfig>
  );

describe('SkillCatalogPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params = {};
    mocks.listSkillCatalog.mockResolvedValue({ items: [remoteSkill], total: 1 });
    mocks.getSkillCatalogDetail.mockResolvedValue(detail);
    mocks.getSkillCatalogFile.mockResolvedValue({
      path: 'SKILL.md',
      content: '# 定时任务',
      size: 128,
      editable: false,
    });
    mocks.compareSkillVersions.mockResolvedValue({
      identity: remoteSkill.identity,
      baseVersion: '1.0.0',
      targetVersion: '2.0.0',
      files: [
        {
          path: 'SKILL.md',
          status: 'modified',
          binary: false,
          baseContent: '# 旧版',
          targetContent: '# 新版',
        },
      ],
    });
    mocks.updateSkillPreferences.mockResolvedValue({
      selectedVersion: '2.0.0',
      followLatest: false,
      enabled: true,
      autoInject: true,
    });
    mocks.copySkillToMine.mockResolvedValue({
      identity: { source: 'mine', namespace: '', slug: 'cron-copy' },
      version: '2.0.0',
    });
    mocks.importSkill.mockResolvedValue({
      identity: { source: 'mine', namespace: '', slug: 'imported-skill' },
      version: '1.0.0',
    });
    mocks.showOpen.mockResolvedValue(['C:\\packages\\imported-skill.zip']);
  });

  it('shows every source in one card directory and opens the canonical identity route', async () => {
    renderPage();
    const card = await screen.findByRole('button', { name: /cron/u });
    expect(screen.getByText('全部来源')).toBeInTheDocument();
    expect(screen.getAllByText('SkillHub').length).toBeGreaterThan(0);
    fireEvent.click(card);
    expect(mocks.navigate).toHaveBeenCalledWith('/settings/skills/skillhub/alice/cron');
  });

  it('keeps import, manual creation, and chat creation under the only add-skill button', async () => {
    renderPage();

    const addButton = await screen.findByRole('button', { name: '添加技能' });
    expect(screen.queryByRole('button', { name: '导入技能' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '刷新' })).not.toBeInTheDocument();

    fireEvent.click(addButton);

    expect(await screen.findByText('导入技能')).toBeInTheDocument();
    expect(screen.getByText('手动添加')).toBeInTheDocument();
    const chatEntry = screen.getByText('通过对话添加');
    fireEvent.click(chatEntry);

    expect(mocks.talkToButler).toHaveBeenCalledWith({ prompt: 'settings.talkToButler.prompt.addSkill' });
  });

  it('navigates immediately after importing a valid skill package', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '添加技能' }));
    fireEvent.click(await screen.findByText('导入技能'));

    await waitFor(() =>
      expect(mocks.importSkill).toHaveBeenCalledWith({ archivePath: 'C:\\packages\\imported-skill.zip' })
    );
    expect(mocks.navigate).toHaveBeenCalledWith('/settings/skills/mine/~/imported-skill');
  });

  it('closes the copy dialog and navigates after the copy itself succeeds', async () => {
    mocks.params = { source: 'skillhub', namespace: 'alice', skillName: 'cron' };
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '复制到我的技能' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText(/确定|OK/u));

    await waitFor(() =>
      expect(mocks.copySkillToMine).toHaveBeenCalledWith({
        source: 'skillhub',
        namespace: 'alice',
        slug: 'cron',
        version: '2.0.0',
        targetSlug: 'cron-copy',
      })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mocks.navigate).toHaveBeenCalledWith('/settings/skills/mine/~/cron-copy');
  });

  it('updates enablement directly on a remote card without copying or installing it', async () => {
    renderPage();
    const switches = await screen.findAllByRole('switch');
    fireEvent.click(switches[0]);
    await waitFor(() =>
      expect(mocks.updateSkillPreferences).toHaveBeenCalledWith({
        source: 'skillhub',
        namespace: 'alice',
        slug: 'cron',
        selectedVersion: '2.0.0',
        followLatest: false,
        enabled: false,
        autoInject: false,
      })
    );
  });

  it('uses the same light detail for files and versions without mounting a Workbench', async () => {
    mocks.params = { source: 'skillhub', namespace: 'alice', skillName: 'cron' };
    renderPage();
    expect(await screen.findByTestId('rendered-readme')).toHaveTextContent('# 定时任务');
    expect(screen.queryByTestId('shared-chat-workbench')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /文件\s*·\s*1/u })).toBeInTheDocument();
    expect(screen.getByText('版本比较')).toBeInTheDocument();
  });

  it('browses nested files as a compact folder tree instead of flattening full paths', async () => {
    mocks.params = { source: 'skillhub', namespace: 'alice', skillName: 'cron' };
    mocks.getSkillCatalogDetail.mockResolvedValue({
      ...detail,
      files: [
        ...detail.files,
        { path: 'references/guide.md', size: 16 },
        { path: 'references/examples/demo.json', size: 24 },
      ],
    });
    renderPage();

    fireEvent.click(await screen.findByRole('tab', { name: /文件\s*·\s*3/u }));
    expect(screen.getByText('references')).toBeInTheDocument();
    expect(screen.getByText('examples')).toBeInTheDocument();
    expect(screen.getByText('guide.md')).toBeInTheDocument();
    expect(screen.queryByText('references/guide.md')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('guide.md'));
    await waitFor(() =>
      expect(mocks.getSkillCatalogFile).toHaveBeenCalledWith({
        source: 'skillhub',
        namespace: 'alice',
        slug: 'cron',
        path: 'references/guide.md',
        version: '2.0.0',
      })
    );
  });

  it('enables the exact version currently being viewed instead of silently using the latest version', async () => {
    mocks.params = { source: 'skillhub', namespace: 'alice', skillName: 'cron' };
    mocks.getSkillCatalogDetail.mockResolvedValue({
      ...detail,
      selectedVersion: '1.0.0',
      skill: {
        ...remoteSkill,
        preferences: {
          selectedVersion: '2.0.0',
          followLatest: true,
          enabled: false,
          autoInject: false,
        },
      },
    });
    renderPage();

    fireEvent.click((await screen.findAllByRole('switch'))[0]);

    await waitFor(() =>
      expect(mocks.updateSkillPreferences).toHaveBeenCalledWith({
        source: 'skillhub',
        namespace: 'alice',
        slug: 'cron',
        selectedVersion: '1.0.0',
        followLatest: false,
        enabled: true,
        autoInject: false,
      })
    );
  });

  it('keeps version browsing read-only until the user explicitly changes enablement', async () => {
    mocks.params = { source: 'skillhub', namespace: 'alice', skillName: 'cron' };
    renderPage();

    fireEvent.click(await screen.findByRole('tab', { name: '版本' }));
    fireEvent.click(await screen.findByRole('button', { name: 'v1.0.0' }));

    await waitFor(() =>
      expect(mocks.getSkillCatalogDetail).toHaveBeenCalledWith({
        source: 'skillhub',
        namespace: 'alice',
        slug: 'cron',
        version: '1.0.0',
      })
    );
    expect(mocks.updateSkillPreferences).not.toHaveBeenCalled();
  });

  it('compares only versions beneath the current source namespace and slug', async () => {
    mocks.params = { source: 'skillhub', namespace: 'alice', skillName: 'cron' };
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: '版本比较' }));
    await waitFor(() =>
      expect(mocks.compareSkillVersions).toHaveBeenCalledWith({
        source: 'skillhub',
        namespace: 'alice',
        slug: 'cron',
        base: '1.0.0',
        target: '2.0.0',
      })
    );
    const removed = await screen.findByText('# 旧版');
    const added = screen.getByText('# 新版');
    expect(removed.closest('span')?.className).toContain('diffLine_removed');
    expect(added.closest('span')?.className).toContain('diffLine_added');
  });
});
