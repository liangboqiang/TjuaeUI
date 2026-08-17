import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listAvailableSkills: vi.fn(),
  listMarketSkills: vi.fn(),
  installMarketSkill: vi.fn(),
  updateMarketSkill: vi.fn(),
  compareMarketSkill: vi.fn(),
  publishMarketSkill: vi.fn(),
  updateSkillPreferences: vi.fn(),
  copySkill: vi.fn(),
  createSkill: vi.fn(),
  cloneSkill: vi.fn(),
  importSkill: vi.fn(),
  deleteSkill: vi.fn(),
  showOpen: vi.fn(),
  showItemInFolder: vi.fn(),
  openExternal: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      listAvailableSkills: { invoke: mocks.listAvailableSkills },
      listMarketSkills: { invoke: mocks.listMarketSkills },
      installMarketSkill: { invoke: mocks.installMarketSkill },
      updateMarketSkill: { invoke: mocks.updateMarketSkill },
      compareMarketSkill: { invoke: mocks.compareMarketSkill },
      publishMarketSkill: { invoke: mocks.publishMarketSkill },
      updateSkillPreferences: { invoke: mocks.updateSkillPreferences },
      copySkill: { invoke: mocks.copySkill },
      createSkill: { invoke: mocks.createSkill },
      cloneSkill: { invoke: mocks.cloneSkill },
      importSkill: { invoke: mocks.importSkill },
      deleteSkill: { invoke: mocks.deleteSkill },
    },
    dialog: { showOpen: { invoke: mocks.showOpen } },
    shell: {
      showItemInFolder: { invoke: mocks.showItemInFolder },
      openExternal: { invoke: mocks.openExternal },
    },
  },
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/renderer/hooks/context/LayoutContext', () => ({ useLayoutContext: () => ({ isMobile: false }) }));
vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
        'settings.skillsHub.mySkills': '我的技能',
        'settings.skillsHub.market': '市场',
        'settings.skillsHub.install': '安装',
        'settings.skillsHub.open': '打开',
        'settings.skillsHub.addSkill': '添加技能',
        'settings.skillsHub.importFolder': '导入文件夹',
        'settings.skillsHub.sourceLocal': '本地',
        'settings.skillsHub.remoteMarket': '远程市场',
        'settings.skillsHub.gitStatus.clean': '干净',
      };
      const value = labels[key] ?? (typeof options?.defaultValue === 'string' ? options.defaultValue : key);
      return value.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(options?.[name] ?? ''));
    },
  }),
}));

import SkillsHubSettings from '@/renderer/pages/settings/SkillsSettings/SkillsHubSettings';

const localSkill = {
  id: 'cron-copy',
  slug: 'cron-copy',
  name: 'cron 副本',
  description: '个人定时任务技能',
  version: '1.0.0',
  path: 'C:/skills/cron-copy',
  source: { kind: 'local' as const },
  categories: ['自动化'],
  preferences: { enabled: true, autoInject: false },
  gitStatus: 'clean' as const,
};

const marketSkill = {
  id: 'cron',
  slug: 'cron',
  name: 'cron',
  description: '官方定时任务技能',
  version: '1.1.0',
  path: 'skills/cron',
  digest: 'b'.repeat(64),
  categories: ['自动化'],
  market: {
    id: 'tjuae-hub',
    name: 'TjuaeHub',
    repository: 'https://github.com/liangboqiang/TjuaeHub.git',
    revision: 'a'.repeat(40),
  },
  installed: false,
  installedVersion: undefined,
  syncState: 'notInstalled',
};

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SkillsHubSettings withWrapper={false} />
    </SWRConfig>
  );

describe('SkillsHubSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listAvailableSkills.mockResolvedValue([localSkill]);
    mocks.listMarketSkills.mockResolvedValue([marketSkill]);
    mocks.installMarketSkill.mockResolvedValue(undefined);
  });

  it('renders installed skills as versioned cards and opens the shared workbench', async () => {
    renderPage();

    const card = await screen.findByTestId('skill-card-cron-copy');
    expect(card).toHaveTextContent('cron 副本');
    expect(card).toHaveTextContent('v1.0.0');
    expect(card).toHaveTextContent('本地');
    expect(card).toHaveTextContent('干净');

    fireEvent.click(card);
    expect(mocks.navigate).toHaveBeenCalledWith('/settings/skills/detail/cron-copy');
  });

  it('shows TjuaeHub through the market index and installs a remote skill', async () => {
    renderPage();
    await screen.findByTestId('skill-card-cron-copy');

    fireEvent.click(screen.getByText('市场'));
    const remoteCard = await screen.findByTestId('market-skill-card-cron');
    expect(remoteCard).toHaveTextContent('v1.1.0');
    expect(remoteCard).toHaveTextContent('远程市场');

    fireEvent.click(screen.getByRole('button', { name: '安装' }));
    await waitFor(() => expect(mocks.installMarketSkill).toHaveBeenCalledWith({ marketId: 'tjuae-hub', slug: 'cron' }));
  });

  it('imports one canonical skill directory through the single import API', async () => {
    mocks.showOpen.mockResolvedValue(['C:/incoming/my-skill']);
    mocks.importSkill.mockResolvedValue(undefined);
    renderPage();
    await screen.findByTestId('skill-card-cron-copy');

    fireEvent.click(screen.getByRole('button', { name: '添加技能' }));
    fireEvent.click(await screen.findByText('导入文件夹'));
    await waitFor(() => expect(mocks.importSkill).toHaveBeenCalledWith({ skill_path: 'C:/incoming/my-skill' }));
  });
});
