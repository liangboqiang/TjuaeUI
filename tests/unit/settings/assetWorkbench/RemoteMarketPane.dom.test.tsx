import type { AssetFile, AssetKind, MarketAsset, MarketIndex, MarketPackage } from '@/common/types/agent/assets';
import MarketPage from '@/renderer/pages/settings/Assets/MarketPage';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Input } from '@arco-design/web-react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  index: undefined as MarketIndex | undefined,
  listAssets: vi.fn(),
  refresh: vi.fn(),
  readFile: vi.fn(),
  install: vi.fn(),
  sync: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/renderer/pages/settings/Assets/MarketPage/marketApi', () => ({
  marketApi: {
    listAssets: { invoke: mocks.listAssets },
    refresh: { invoke: mocks.refresh },
    readFile: { invoke: mocks.readFile },
    install: { invoke: mocks.install },
    sync: { invoke: mocks.sync },
  },
}));

vi.mock('@/renderer/pages/settings/Assets/components/AssetCollaborationGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageHeader', () => ({
  default: ({ title, description }: { title: React.ReactNode; description?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/renderer/components/Markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <pre data-testid='markdown-preview'>{children}</pre>,
}));

vi.mock('@/renderer/components/base', () => ({
  TjuaeSearchInput: ({
    value,
    onChange,
    inputProps,
  }: {
    value: string;
    onChange: (value: string) => void;
    inputProps?: { 'aria-label'?: string };
  }) => <Input value={value} onChange={onChange} aria-label={inputProps?.['aria-label']} />,
}));

vi.mock('@arco-design/web-react', async () => {
  const actual = await vi.importActual<typeof import('@arco-design/web-react')>('@arco-design/web-react');
  return {
    ...actual,
    Message: {
      ...actual.Message,
      success: mocks.messageSuccess,
      error: mocks.messageError,
    },
  };
});

const createAsset = (id: string, overrides: Partial<MarketAsset> = {}): MarketAsset => ({
  id,
  kind: 'assistant',
  runtimeId: id.replaceAll(':', '-'),
  dependencies: [],
  displayName: id,
  description: `${id} description`,
  version: '1.0.0',
  definitionDigest: `sha256-${id}-definition`,
  entryFile: 'README.md',
  packageName: `tjuaeasset-${id.replaceAll(':', '-')}`,
  author: 'Tjuae',
  license: 'Apache-2.0',
  trust: 'community',
  status: 'active',
  compatibility: { compatible: true, tjuae: '^1.0.0' },
  sourceRevision: '0123456789abcdef0123456789abcdef01234567',
  files: [{ path: 'README.md', digest: `sha256-${id}-readme`, size: 128, mediaType: 'text/markdown' }],
  tags: [],
  presenceState: 'notInstalled',
  allowedActions: ['view', 'install'],
  ...overrides,
});

const createPackage = (asset: MarketAsset): MarketPackage => ({
  name: asset.packageName,
  version: asset.version,
  reviewStatus: 'approved',
  atomic: true,
  assetIds: [asset.id],
  dependencies: {},
  tarball: `${asset.packageName}.zip`,
  integrity: 'sha256-package',
  archiveIntegrity: 'sha256-archive',
  unpackedSize: 256,
  repository: 'https://github.com/liangboqiang/TjuaeHub',
  sourcePath: `assets/${asset.packageName}`,
  manifestPath: `assets/${asset.packageName}/asset-package.json`,
  sourceRevision: asset.sourceRevision,
});

const createIndex = (assets: MarketAsset[]): MarketIndex => ({
  schemaVersion: 2,
  generatedAt: '2026-08-02T00:00:00.000Z',
  assets,
  packages: assets.map(createPackage),
  cache: {
    distributionRevision: 'd123456789abcdef0123456789abcdef01234567',
    cachedAt: 1,
    sourceUrl: 'https://example.invalid/index.json',
    stale: false,
  },
});

describe('remote-only asset market', () => {
  beforeEach(() => {
    const initial = createAsset('assistant:starter', {
      displayName: 'Starter assistant',
      trust: 'official',
    });
    mocks.index = createIndex([initial]);
    mocks.listAssets.mockReset();
    mocks.refresh.mockReset();
    mocks.readFile.mockReset();
    mocks.install.mockReset();
    mocks.sync.mockReset();
    mocks.messageSuccess.mockReset();
    mocks.messageError.mockReset();
    mocks.listAssets.mockImplementation(async () => mocks.index!);
    mocks.refresh.mockResolvedValue(mocks.index.cache);
    mocks.readFile.mockImplementation(
      async ({ remoteAssetId, path }: { remoteAssetId: string; path: string }): Promise<AssetFile> => ({
        assetId: remoteAssetId,
        path,
        digest: `sha256-${path}`,
        mediaType: path.toLowerCase().endsWith('.md') ? 'text/markdown' : 'text/plain',
        content: path.endsWith('SKILL.md') ? '# Skill entry' : '# Remote definition',
        contentSource: 'remote',
      })
    );
    mocks.install.mockResolvedValue({ operationId: 'install-1', assetId: initial.id, state: 'succeeded' });
    mocks.sync.mockResolvedValue({ operationId: 'sync-1', assetId: initial.id, state: 'succeeded' });
    window.location.hash = '';
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof window.requestAnimationFrame;
  });

  it('renders only the Hub remote market and exposes all four asset categories', async () => {
    render(<MarketPage withWrapper={false} />);

    expect(await screen.findByTestId('remote-market')).toBeInTheDocument();
    expect(screen.queryByText('settings.assetWorkbench.sources.local')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.assetWorkbench.sources.remote')).not.toBeInTheDocument();
    for (const kind of ['assistant', 'engineAdapter', 'skill', 'mcp'] satisfies AssetKind[]) {
      expect(screen.getByText(`settings.assetWorkbench.kinds.${kind}`)).toBeInTheDocument();
    }
  });

  it('filters by trust, installation, and tracked sync state without inventing remote-only state', async () => {
    const assets = [
      createAsset('assistant:official-new', {
        displayName: 'Official new',
        trust: 'official',
      }),
      createAsset('assistant:verified-installed', {
        displayName: 'Verified installed',
        trust: 'verified',
        presenceState: 'installed',
        syncState: 'remoteUpdated',
        allowedActions: ['view', 'sync'],
        local: {
          localAssetId: 'assistant:verified-installed-local',
          localDigest: 'sha256-local',
          baseDigest: 'sha256-base',
        },
      }),
      createAsset('assistant:community-installed', {
        displayName: 'Community installed',
        trust: 'community',
        presenceState: 'installed',
        syncState: 'synced',
        allowedActions: ['view'],
        local: {
          localAssetId: 'assistant:community-installed-local',
          localDigest: 'sha256-local',
          baseDigest: 'sha256-base',
        },
      }),
    ];
    mocks.index = createIndex(assets);
    render(<MarketPage withWrapper={false} />);

    await screen.findByText('Official new');
    const trustFilter = screen.getByRole('combobox', {
      name: 'settings.assetWorkbench.filters.trust',
    });
    fireEvent.click(trustFilter);
    fireEvent.click(
      await screen.findByRole('option', {
        name: 'settings.assetWorkbench.trust.verified',
      })
    );
    expect(screen.getAllByText('Verified installed')).toHaveLength(2);
    expect(screen.queryByText('Official new')).not.toBeInTheDocument();

    const syncFilter = screen.getByRole('combobox', {
      name: 'settings.assetWorkbench.filters.sync',
    });
    fireEvent.click(syncFilter);
    fireEvent.click(
      await screen.findByRole('option', {
        name: 'settings.assetWorkbench.syncStates.remoteUpdated',
      })
    );
    expect(
      screen.getByRole('combobox', {
        name: 'settings.assetWorkbench.filters.installation',
      })
    ).toHaveTextContent('settings.assetWorkbench.presenceStates.installed');
    expect(
      within(screen.getByRole('listbox', { name: 'settings.assetWorkbench.remoteAssetList' })).getByText(
        'settings.assetWorkbench.syncStates.remoteUpdated'
      )
    ).toBeInTheDocument();
    expect(await screen.findByTestId('asset-semantic-detail')).toBeInTheDocument();
  });

  it('opens SKILL.md by default and shows verified advanced metadata in a collapsible section', async () => {
    const skill = createAsset('skill:design', {
      kind: 'skill',
      runtimeId: 'design',
      displayName: 'Design skill',
      packageName: 'tjuaeasset-design',
      entryFile: 'README.md',
      definitionDigest: 'sha256-definition-digest',
      sourceRevision: 'fedcba9876543210fedcba9876543210fedcba98',
      dependencies: ['skill:foundation'],
      compatibility: { compatible: true, tjuae: '>=1.2.0 <2' },
      files: [
        { path: 'README.md', digest: 'sha256-readme', size: 64, mediaType: 'text/markdown' },
        { path: 'skills/design/SKILL.md', digest: 'sha256-skill', size: 128, mediaType: 'text/markdown' },
      ],
    });
    const index = createIndex([skill]);
    index.packages[0]!.dependencies = { 'tjuaeasset-foundation': '^2.0.0' };
    mocks.index = index;
    render(<MarketPage withWrapper={false} />);

    expect(await screen.findByText('# Skill entry')).toBeInTheDocument();
    expect(mocks.readFile).toHaveBeenCalledWith({
      remoteAssetId: 'skill:design',
      path: 'skills/design/SKILL.md',
    });

    const advanced = screen.getByTestId('market-advanced-info') as HTMLDetailsElement;
    expect(advanced.open).toBe(false);
    fireEvent.click(within(advanced).getByText('settings.assetWorkbench.advancedInfo'));
    expect(advanced.open).toBe(true);
    expect(within(advanced).getByText('tjuaeasset-design')).toBeInTheDocument();
    expect(within(advanced).getByText('fedcba9876543210fedcba9876543210fedcba98')).toBeInTheDocument();
    expect(within(advanced).getByText('sha256-definition-digest')).toBeInTheDocument();
    expect(within(advanced).getByText('skill:foundation')).toBeInTheDocument();
    expect(within(advanced).getByText('tjuaeasset-foundation ^2.0.0')).toBeInTheDocument();
    expect(within(advanced).getByText('>=1.2.0 <2')).toBeInTheDocument();
    expect(within(advanced).getByText('Apache-2.0')).toBeInTheDocument();
    expect(within(advanced).getByText('settings.assetWorkbench.reviewStatuses.approved')).toBeInTheDocument();
  });

  it('shows lifecycle governance and never offers installation for a revoked asset', async () => {
    const revoked = createAsset('skill:revoked', {
      kind: 'skill',
      displayName: 'Revoked skill',
      status: 'revoked',
      allowedActions: ['view'],
    });
    mocks.index = createIndex([revoked]);
    render(<MarketPage withWrapper={false} />);

    expect(await screen.findByText('settings.assetWorkbench.lifecycleWarnings.revoked')).toBeInTheDocument();
    expect(screen.getAllByText('settings.assetWorkbench.assetStatuses.revoked').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'settings.assetWorkbench.installToLocal' })).not.toBeInTheDocument();
  });

  it('installs an uninstalled asset, but opens or synchronizes only an installed local copy', async () => {
    render(<MarketPage withWrapper={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'settings.assetWorkbench.installToLocal' }));
    await waitFor(() =>
      expect(mocks.install).toHaveBeenCalledWith({
        remoteAssetId: 'assistant:starter',
        idempotencyKey: expect.stringMatching(/^market-/),
      })
    );
    expect(screen.queryByRole('button', { name: 'settings.assetWorkbench.openLocalCopy' })).not.toBeInTheDocument();

    const installed = createAsset('assistant:installed', {
      runtimeId: 'installed-runtime',
      displayName: 'Installed assistant',
      presenceState: 'installed',
      syncState: 'remoteUpdated',
      allowedActions: ['view', 'sync'],
      local: {
        localAssetId: 'assistant:installed-local',
        localDigest: 'sha256-local',
        baseDigest: 'sha256-base',
      },
    });
    mocks.index = createIndex([installed]);
    fireEvent.click(screen.getByRole('button', { name: 'common.refresh' }));

    fireEvent.click(await screen.findByRole('button', { name: 'settings.assetWorkbench.openLocalCopy' }));
    expect(window.location.hash).toBe('#/settings/assistants/assets/assistant%3Ainstalled-local');

    fireEvent.click(screen.getByRole('button', { name: 'settings.assetWorkbench.syncLocalCopy' }));
    await waitFor(() =>
      expect(mocks.sync).toHaveBeenCalledWith({
        remoteAssetId: 'assistant:installed',
        idempotencyKey: expect.stringMatching(/^market-/),
      })
    );
    expect(screen.queryByRole('textbox', { name: 'settings.assetWorkbench.sourceEditor' })).not.toBeInTheDocument();
  });

  it('supports roving keyboard selection and exposes semantic list, filters, and file controls', async () => {
    mocks.index = createIndex([
      createAsset('assistant:first', { displayName: 'First assistant' }),
      createAsset('assistant:second', { displayName: 'Second assistant' }),
    ]);
    render(<MarketPage withWrapper={false} />);

    const listbox = await screen.findByRole('listbox', {
      name: 'settings.assetWorkbench.remoteAssetList',
    });
    const options = within(listbox).getAllByRole('option');
    await waitFor(() => expect(options[0]).toHaveAttribute('aria-selected', 'true'));
    expect(options[0]).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('group', { name: 'settings.assetWorkbench.filters.label' })).toBeInTheDocument();

    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    await waitFor(() => expect(options[1]).toHaveAttribute('aria-selected', 'true'));
    expect(options[1]).toHaveFocus();
    fireEvent.click(await screen.findByRole('button', { name: 'settings.assetWorkbench.semantic.openSource' }));
    expect(await screen.findByRole('button', { name: 'README.md' })).toHaveAttribute('aria-current', 'true');
  });

  it('uses theme tokens and a single-column narrow layout that expands at responsive breakpoints', async () => {
    render(<MarketPage withWrapper={false} />);

    const market = await screen.findByTestId('remote-market');
    expect(market).toHaveAttribute('data-theme-aware', 'true');
    expect(market).toHaveClass('bg-1', 'text-t-primary', 'border-border-2');

    const workspace = await screen.findByTestId('market-workspace');
    expect(workspace.className).toContain('grid-cols-1');
    expect(workspace.className).toContain('lg:grid-cols-[300px_minmax(0,1fr)]');
    expect(await screen.findByTestId('market-detail')).toBeInTheDocument();
  });
});
