import type { AssetDetail, AssetFile, AssetSummary } from '@/common/types/agent/assets';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Input } from '@arco-design/web-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RemoteMarketPage from '@/renderer/pages/settings/Assets/MarketPage';
import LocalAssetWorkbench from '@/renderer/pages/settings/Assets/LocalAssetPage/LocalAssetWorkbench';

const MarketPage = (_props: { withWrapper?: boolean }) => <LocalAssetWorkbench />;

const openAdvancedSource = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'settings.assetWorkbench.semantic.openSource' }));
  await screen.findByText('settings.assetWorkbench.views.source');
};

const mocks = vi.hoisted(() => ({
  detail: undefined as AssetDetail | undefined,
  list: vi.fn(),
  getDetail: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  diff: vi.fn(),
  resolve: vi.fn(),
  restore: vi.fn(),
  uninstall: vi.fn(),
  detach: vi.fn(),
  overlay: vi.fn(),
  configure: vi.fn(),
  validate: vi.fn(),
  tryRun: vi.fn(),
  activate: vi.fn(),
  deactivate: vi.fn(),
  marketList: vi.fn(),
  marketReadFile: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/renderer/pages/settings/Assets/LocalAssetPage/assetApi', () => ({
  assetApi: {
    list: { invoke: mocks.list },
    detail: { invoke: mocks.getDetail },
    readFile: { invoke: mocks.readFile },
    writeFile: { invoke: mocks.writeFile },
    diff: { invoke: mocks.diff },
    resolve: { invoke: mocks.resolve },
    restore: { invoke: mocks.restore },
    uninstall: { invoke: mocks.uninstall },
    detach: { invoke: mocks.detach },
    overlay: { invoke: mocks.overlay },
    configure: { invoke: mocks.configure },
    validate: { invoke: mocks.validate },
    tryRun: { invoke: mocks.tryRun },
    activate: { invoke: mocks.activate },
    deactivate: { invoke: mocks.deactivate },
  },
}));

vi.mock('@/renderer/pages/settings/Assets/MarketPage/marketApi', () => ({
  marketApi: {
    listAssets: { invoke: mocks.marketList },
    readFile: { invoke: mocks.marketReadFile },
  },
}));

vi.mock('@/renderer/pages/settings/Assets/components/AssetCollaborationGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageHeader', () => ({
  default: ({ title, actions }: { title: React.ReactNode; actions?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));

vi.mock('@/renderer/components/Markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <pre>{children}</pre>,
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

const createDetail = (overrides: Partial<AssetDetail> = {}): AssetDetail => ({
  id: 'skill:demo',
  kind: 'skill',
  displayName: 'Demo Skill',
  description: 'Skill description',
  origin: 'local',
  trust: 'community',
  scope: 'user',
  editability: 'full',
  definitionDigest: 'sha256-definition',
  runtimeState: 'inactive',
  syncState: 'localModified',
  allowedActions: ['view', 'edit', 'publish', 'viewDiff'],
  createdAt: 1,
  updatedAt: 2,
  contentSource: 'local',
  sourceDigest: 'sha256-source',
  entryFile: 'README.md',
  files: [
    { path: 'README.md', digest: 'sha256-readme', size: 12, mediaType: 'text/markdown', text: true },
    { path: 'SKILL.md', digest: 'sha256-old', size: 20, mediaType: 'text/markdown', text: true },
  ],
  ...overrides,
});

const toSummary = (detail: AssetDetail): AssetSummary => {
  const {
    files: _files,
    entryFile: _entryFile,
    contentSource: _contentSource,
    sourceDigest: _sourceDigest,
    ...summary
  } = detail;
  return summary;
};

const localFile = (overrides: Partial<AssetFile> = {}): AssetFile => ({
  assetId: 'skill:demo',
  path: 'SKILL.md',
  digest: 'sha256-old',
  mediaType: 'text/markdown',
  content: '# Demo',
  contentSource: 'local',
  ...overrides,
});

describe('asset market workbench', () => {
  beforeEach(() => {
    globalThis.location.hash = '';
    mocks.detail = createDetail();
    mocks.list.mockReset();
    mocks.getDetail.mockReset();
    mocks.readFile.mockReset();
    mocks.writeFile.mockReset();
    mocks.diff.mockReset();
    mocks.resolve.mockReset();
    mocks.restore.mockReset();
    mocks.uninstall.mockReset();
    mocks.detach.mockReset();
    mocks.overlay.mockReset();
    mocks.configure.mockReset();
    mocks.validate.mockReset();
    mocks.tryRun.mockReset();
    mocks.activate.mockReset();
    mocks.deactivate.mockReset();
    mocks.marketList.mockReset();
    mocks.marketReadFile.mockReset();
    mocks.messageSuccess.mockReset();
    mocks.messageError.mockReset();
    mocks.validate.mockResolvedValue({
      assetId: 'assistant:demo',
      kind: 'assistant',
      runtimeState: 'inactive',
    });
    mocks.tryRun.mockResolvedValue({
      assetId: 'assistant:demo',
      kind: 'assistant',
      runtimeState: 'inactive',
    });

    mocks.list.mockImplementation(async () => [toSummary(mocks.detail!)]);
    mocks.getDetail.mockImplementation(async () => mocks.detail!);
    mocks.readFile.mockImplementation(async ({ source }: { source: 'local' | 'base' }) =>
      source === 'base'
        ? localFile({ digest: 'sha256-base', content: '# Baseline', contentSource: 'base' })
        : localFile({
            digest: mocks.writeFile.mock.calls.length > 0 ? 'sha256-new' : 'sha256-old',
            content: mocks.writeFile.mock.calls.length > 0 ? '# Edited' : '# Demo',
          })
    );
    mocks.writeFile.mockImplementation(async () =>
      createDetail({
        definitionDigest: 'sha256-updated',
        sourceDigest: 'sha256-updated',
        files: [
          { path: 'README.md', digest: 'sha256-readme', size: 12, mediaType: 'text/markdown', text: true },
          { path: 'SKILL.md', digest: 'sha256-new', size: 22, mediaType: 'text/markdown', text: true },
        ],
      })
    );
    mocks.diff.mockResolvedValue({
      assetId: 'skill:demo',
      syncState: 'localModified',
      localDigest: 'sha256-local-definition',
      baseDigest: 'sha256-base-definition',
      remoteDigest: 'sha256-remote-definition',
      files: [
        {
          path: 'SKILL.md',
          base: { path: 'SKILL.md', digest: 'sha256-base', size: 10, mediaType: 'text/markdown', text: true },
          local: { path: 'SKILL.md', digest: 'sha256-old', size: 10, mediaType: 'text/markdown', text: true },
          remote: { path: 'SKILL.md', digest: 'sha256-remote', size: 10, mediaType: 'text/markdown', text: true },
          baseDigest: 'sha256-base',
          localDigest: 'sha256-old',
          remoteDigest: 'sha256-remote',
          status: 'localModified',
          autoMergeable: true,
        },
      ],
    });
    mocks.resolve.mockResolvedValue({});
    mocks.restore.mockResolvedValue({});
    mocks.uninstall.mockResolvedValue({});
    mocks.detach.mockResolvedValue({});
    mocks.marketReadFile.mockResolvedValue(
      localFile({ digest: 'sha256-remote', content: '# Remote', contentSource: 'remote' })
    );
    mocks.marketList.mockResolvedValue({
      schemaVersion: 2,
      generatedAt: '',
      assets: [],
      packages: [],
      cache: { cachedAt: 0, sourceUrl: '', stale: false },
    });
  });

  it('opens SKILL.md by default and never exposes overlay data as a publish action', async () => {
    mocks.detail = createDetail({
      editability: 'overlay',
      allowedActions: ['view'],
    });

    render(<MarketPage withWrapper={false} />);

    await screen.findByText('# Demo');
    await openAdvancedSource();
    expect(mocks.readFile).toHaveBeenCalledWith({
      assetId: 'skill:demo',
      path: 'SKILL.md',
      source: 'local',
    });

    fireEvent.click(screen.getByText('settings.assetWorkbench.views.source'));
    expect(screen.queryByRole('textbox', { name: 'settings.assetWorkbench.sourceEditor' })).not.toBeInTheDocument();
    expect(screen.queryByText(/publish/i)).not.toBeInTheDocument();
  });

  it('opens the first real changed file in diff view only when Core allows viewDiff', async () => {
    render(<MarketPage withWrapper={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'settings.assetWorkbench.viewDiffAction' }));

    await waitFor(() => expect(mocks.diff).toHaveBeenCalledWith({ assetId: 'skill:demo' }));
    expect(
      await screen.findByText(
        (_content, node) =>
          node?.tagName === 'PRE' && Boolean(node.textContent?.includes('settings.assetWorkbench.baseline'))
      )
    ).toBeInTheDocument();
  });

  it('uses Core validation and try-run commands instead of redirecting to legacy surfaces', async () => {
    mocks.detail = createDetail({
      id: 'assistant:demo',
      kind: 'assistant',
      runtimeId: 'assistant-demo',
      allowedActions: ['view', 'validate', 'tryRun'],
    });

    render(<MarketPage withWrapper={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'settings.assetWorkbench.validateAction' }));
    await waitFor(() =>
      expect(mocks.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: 'assistant:demo',
          expectedDefinitionDigest: 'sha256-definition',
          idempotencyKey: expect.any(String),
        })
      )
    );
    expect(globalThis.location.hash).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'settings.assetWorkbench.tryRunAction' }));
    await waitFor(() =>
      expect(mocks.tryRun).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: 'assistant:demo',
          expectedDefinitionDigest: 'sha256-definition',
          idempotencyKey: expect.any(String),
        })
      )
    );
    expect(globalThis.location.hash).toBe('');
  });

  it('saves an editable Definition with the digest that was originally read', async () => {
    render(<MarketPage withWrapper={false} />);

    await screen.findByText('# Demo');
    await openAdvancedSource();
    fireEvent.click(screen.getByText('settings.assetWorkbench.views.source'));
    fireEvent.change(screen.getByRole('textbox', { name: 'settings.assetWorkbench.sourceEditor' }), {
      target: { value: '# Edited' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() =>
      expect(mocks.writeFile).toHaveBeenCalledWith({
        assetId: 'skill:demo',
        path: 'SKILL.md',
        content: '# Edited',
        expectedDigest: 'sha256-old',
      })
    );
    expect(mocks.messageSuccess).toHaveBeenCalledWith('settings.assetWorkbench.saveSuccess');
  });

  it('keeps the draft visible and reports an optimistic-lock conflict', async () => {
    mocks.writeFile.mockRejectedValue({
      name: 'BackendHttpError',
      status: 409,
      code: 'ASSET_CONCURRENT_MODIFICATION',
    });
    render(<MarketPage withWrapper={false} />);

    await screen.findByText('# Demo');
    await openAdvancedSource();
    fireEvent.click(screen.getByText('settings.assetWorkbench.views.source'));
    const editor = screen.getByRole('textbox', { name: 'settings.assetWorkbench.sourceEditor' });
    fireEvent.change(editor, { target: { value: '# My draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() =>
      expect(mocks.messageError).toHaveBeenCalledWith('settings.assetWorkbench.concurrentModification')
    );
    expect(editor).toHaveValue('# My draft');
  });

  it('loads the verified baseline source before showing baseline content', async () => {
    render(<MarketPage withWrapper={false} />);

    await screen.findByText('# Demo');
    await openAdvancedSource();
    fireEvent.click(screen.getByText('settings.assetWorkbench.views.base'));

    expect(await screen.findByText('# Baseline')).toBeInTheDocument();
    expect(mocks.diff).toHaveBeenCalledWith({ assetId: 'skill:demo' });
    expect(mocks.readFile).toHaveBeenCalledWith({
      assetId: 'skill:demo',
      path: 'SKILL.md',
      source: 'base',
    });
  });

  it('shows source-unavailable state without fabricating baseline content', async () => {
    mocks.readFile.mockImplementation(async ({ source }: { source: 'local' | 'base' }) => {
      if (source === 'base') {
        throw {
          name: 'BackendHttpError',
          status: 409,
          code: 'ASSET_SOURCE_UNAVAILABLE',
        };
      }
      return localFile();
    });
    render(<MarketPage withWrapper={false} />);

    await screen.findByText('# Demo');
    await openAdvancedSource();
    fireEvent.click(screen.getByText('settings.assetWorkbench.views.base'));

    expect(await screen.findByText('settings.assetWorkbench.sourceUnavailableDescription')).toBeInTheDocument();
    expect(screen.queryByText('# Baseline')).not.toBeInTheDocument();
  });

  it('reads the actual remote file and offers all six source views', async () => {
    mocks.detail = createDetail({
      upstream: {
        packageName: 'tjuaeasset-demo',
        remoteAssetId: 'org.tjuae.skill.demo',
        version: '2.0.0',
        sourceRevision: 'b'.repeat(40),
        remoteDigest: 'sha256-remote-definition',
        trackingMode: 'tracked',
      },
    });
    render(<MarketPage withWrapper={false} />);

    await screen.findByText('# Demo');
    await openAdvancedSource();
    expect(screen.getByText('settings.assetWorkbench.views.preview')).toBeInTheDocument();
    expect(screen.getByText('settings.assetWorkbench.views.source')).toBeInTheDocument();
    expect(screen.getByText('settings.assetWorkbench.views.local')).toBeInTheDocument();
    expect(screen.getByText('settings.assetWorkbench.views.base')).toBeInTheDocument();
    expect(screen.getByText('settings.assetWorkbench.views.remote')).toBeInTheDocument();
    expect(screen.getByText('settings.assetWorkbench.views.diff')).toBeInTheDocument();

    fireEvent.click(screen.getByText('settings.assetWorkbench.views.remote'));
    expect(await screen.findByText('# Remote')).toBeInTheDocument();
    expect(mocks.marketReadFile).toHaveBeenCalledWith({
      remoteAssetId: 'org.tjuae.skill.demo',
      path: 'SKILL.md',
    });
  });

  it('uses Core digests and requires the second destructive confirmation for remote replacement', async () => {
    mocks.detail = createDetail({
      syncState: 'conflict',
      allowedActions: ['view', 'edit', 'viewDiff', 'resolveConflict', 'detach'],
      upstream: {
        packageName: 'tjuaeasset-demo',
        remoteAssetId: 'org.tjuae.skill.demo',
        version: '2.0.0',
        sourceRevision: 'b'.repeat(40),
        remoteDigest: 'sha256-remote-definition',
        trackingMode: 'tracked',
      },
    });
    mocks.diff.mockResolvedValue({
      assetId: 'skill:demo',
      syncState: 'conflict',
      localDigest: 'sha256-local-definition',
      baseDigest: 'sha256-base-definition',
      remoteDigest: 'sha256-remote-definition',
      files: [
        {
          path: 'SKILL.md',
          baseDigest: 'sha256-base',
          localDigest: 'sha256-local',
          remoteDigest: 'sha256-remote',
          status: 'conflict',
          autoMergeable: false,
        },
      ],
    });
    render(<MarketPage withWrapper={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'settings.assetWorkbench.resolve.action' }));
    expect(await screen.findByText('settings.assetWorkbench.resolve.title')).toBeInTheDocument();
    fireEvent.click(screen.getByText('settings.assetWorkbench.resolve.strategies.useRemote.label'));
    fireEvent.click(screen.getByRole('button', { name: 'settings.assetWorkbench.resolve.continue' }));
    expect((await screen.findAllByText('settings.assetWorkbench.resolve.confirmRemoteTitle')).length).toBeGreaterThan(
      0
    );
    expect(mocks.resolve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'settings.assetWorkbench.resolve.confirmRemoteAction' }));

    await waitFor(() =>
      expect(mocks.resolve).toHaveBeenCalledWith({
        assetId: 'skill:demo',
        strategy: 'useRemote',
        expectedLocalDigest: 'sha256-local-definition',
        expectedBaseDigest: 'sha256-base-definition',
        expectedRemoteDigest: 'sha256-remote-definition',
        idempotencyKey: expect.any(String),
        confirmDestructive: true,
      })
    );
  });

  it('offers detach and uninstall only when Core allows them and confirms their different semantics', async () => {
    mocks.detail = createDetail({
      allowedActions: ['view', 'edit', 'detach', 'uninstall'],
      upstream: {
        packageName: 'tjuaeasset-demo',
        remoteAssetId: 'org.tjuae.skill.demo',
        version: '2.0.0',
        sourceRevision: 'b'.repeat(40),
        remoteDigest: 'sha256-remote-definition',
        trackingMode: 'tracked',
      },
    });
    render(<MarketPage withWrapper={false} />);

    const detachButtons = await screen.findAllByRole('button', {
      name: 'settings.assetWorkbench.resolve.strategies.detach.label',
    });
    fireEvent.click(detachButtons[0]!);
    expect(
      await screen.findByText('settings.assetWorkbench.resolve.strategies.detach.description')
    ).toBeInTheDocument();
    const detachConfirmButtons = screen.getAllByRole('button', {
      name: 'settings.assetWorkbench.resolve.strategies.detach.label',
    });
    fireEvent.click(detachConfirmButtons.at(-1)!);
    await waitFor(() => expect(mocks.detach).toHaveBeenCalledWith({ assetId: 'skill:demo' }));

    fireEvent.click(await screen.findByRole('button', { name: 'settings.assetWorkbench.uninstallAction' }));
    expect(await screen.findByText('settings.assetWorkbench.uninstallConfirmDescription')).toBeInTheDocument();
    const uninstallButtons = screen.getAllByRole('button', {
      name: 'settings.assetWorkbench.uninstallAction',
    });
    fireEvent.click(uninstallButtons.at(-1)!);
    await waitFor(() =>
      expect(mocks.uninstall).toHaveBeenCalledWith({
        assetId: 'skill:demo',
        idempotencyKey: expect.any(String),
      })
    );
  });

  it('uses the recovery id returned by useRemote and never fabricates a generic restore action', async () => {
    mocks.detail = createDetail({
      syncState: 'conflict',
      allowedActions: ['view', 'viewDiff', 'resolveConflict'],
      upstream: {
        packageName: 'tjuaeasset-demo',
        remoteAssetId: 'org.tjuae.skill.demo',
        version: '2.0.0',
        sourceRevision: 'b'.repeat(40),
        remoteDigest: 'sha256-remote-definition',
        trackingMode: 'tracked',
      },
    });
    mocks.resolve.mockResolvedValue({
      asset: toSummary(createDetail({ definitionDigest: 'sha256-after-remote' })),
      operation: {},
      strategy: 'useRemote',
      recoveryOperationId: 'recovery-operation-1',
      recoveryDigest: 'sha256-before-remote',
    });
    render(<MarketPage withWrapper={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'settings.assetWorkbench.resolve.action' }));
    fireEvent.click(await screen.findByText('settings.assetWorkbench.resolve.strategies.useRemote.label'));
    fireEvent.click(screen.getByRole('button', { name: 'settings.assetWorkbench.resolve.continue' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'settings.assetWorkbench.resolve.confirmRemoteAction',
      })
    );

    const restoreButton = await screen.findByRole('button', {
      name: 'settings.assetWorkbench.resolve.restoreAction',
    });
    fireEvent.click(restoreButton);
    await waitFor(() =>
      expect(mocks.restore).toHaveBeenCalledWith({
        assetId: 'skill:demo',
        recoveryOperationId: 'recovery-operation-1',
        expectedLocalDigest: 'sha256-after-remote',
        idempotencyKey: expect.any(String),
      })
    );
  });

  it('shows an honest remote empty state when the atomic market endpoint is unavailable', async () => {
    mocks.marketList.mockRejectedValue({
      name: 'BackendHttpError',
      status: 404,
      code: 'MARKET_NOT_READY',
    });

    render(<RemoteMarketPage withWrapper={false} />);

    expect(await screen.findByText('settings.assetWorkbench.remoteUnavailable')).toBeInTheDocument();
    expect(screen.queryByText('settings.assetWorkbench.sources.local')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.assetWorkbench.sources.remote')).not.toBeInTheDocument();
    expect(screen.queryByText('tjuaeasset-placeholder')).not.toBeInTheDocument();
  });
});
