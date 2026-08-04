import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const mocks = vi.hoisted(() => ({
  getConnection: vi.fn(),
  startAuthorization: vi.fn(),
  pollAuthorization: vi.fn(),
  disconnect: vi.fn(),
  prepare: vi.fn(),
  publish: vi.fn(),
  openExternal: vi.fn(),
  messageSuccess: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (values?.account) return `${key}:${String(values.account)}`;
      if (values?.count !== undefined) return `${key}:${String(values.count)}`;
      return key;
    },
  }),
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  hub: {
    getPublishConnection: { invoke: mocks.getConnection },
    startPublishAuthorization: { invoke: mocks.startAuthorization },
    pollPublishAuthorization: { invoke: mocks.pollAuthorization },
    disconnectPublishAccount: { invoke: mocks.disconnect },
    preparePublish: { invoke: mocks.prepare },
    publish: { invoke: mocks.publish },
  },
  shell: {
    openExternal: { invoke: mocks.openExternal },
  },
}));

vi.mock('@arco-design/web-react', async () => {
  const actual = await vi.importActual<typeof import('@arco-design/web-react')>('@arco-design/web-react');
  return {
    ...actual,
    Message: {
      ...actual.Message,
      success: mocks.messageSuccess,
    },
  };
});

import AssetPublishDialog from '@/renderer/pages/settings/Assets/LocalAssetPage/AssetPublishDialog';

const asset = {
  id: 'skill:local-demo',
  kind: 'skill' as const,
  displayName: 'Local Demo',
  description: 'A local skill',
  origin: 'local' as const,
  trust: 'community' as const,
  scope: 'user' as const,
  editability: 'full' as const,
  definitionDigest: 'sha256-local',
  runtimeState: 'inactive' as const,
  allowedActions: ['view', 'edit', 'publish'] as const,
  createdAt: 1,
  updatedAt: 1,
};

const preview = {
  package: {
    packageName: 'tjuaeasset-local-demo',
    manifest: {
      name: 'tjuaeasset-local-demo',
      version: '1.0.0',
      author: 'Demo Author',
      license: 'MIT',
    },
    files: [
      {
        path: 'SKILL.md',
        content: '# Demo',
        sha256: 'sha256-demo',
        size: 6,
      },
    ],
  },
  warningCodes: ['SENSITIVE_FIELDS_REMOVED'],
  blockedFields: ['overlay.credentials'],
};

const confirmLegalMetadata = () => {
  fireEvent.change(
    screen.getByRole('textbox', {
      name: 'settings.assetPublish.author',
    }),
    { target: { value: 'Demo Author' } }
  );
  fireEvent.change(
    screen.getByRole('textbox', {
      name: 'settings.assetPublish.license',
    }),
    { target: { value: 'MIT' } }
  );
  fireEvent.change(
    screen.getByRole('textbox', {
      name: 'settings.assetPublish.sourceRepository',
    }),
    { target: { value: 'https://github.com/example/local-demo' } }
  );
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: 'settings.assetPublish.metadataConfirmation',
    })
  );
};

describe('Core 本地资产发布', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getConnection.mockResolvedValue({
      state: 'connected',
      account: 'octocat',
    });
    mocks.startAuthorization.mockResolvedValue({
      state: 'authorizationPending',
      userCode: 'ABCD-EFGH',
      verificationUri: 'https://github.com/login/device',
      pollAfterMs: 60_000,
    });
    mocks.pollAuthorization.mockResolvedValue({
      state: 'connected',
      account: 'octocat',
    });
    mocks.disconnect.mockResolvedValue({ state: 'disconnected' });
    mocks.prepare.mockResolvedValue({
      status: 'notPushed',
      package: preview.package,
      proposedBranchName: 'tjuae-publish-tjuaeasset-local-demo-preview',
      baseBranch: 'main',
      repository: 'https://github.com/liangboqiang/TjuaeHub',
      manualContributionUrl: 'https://github.com/liangboqiang/TjuaeHub/fork',
      requiresUserAction: true,
      warningCodes: preview.warningCodes,
      blockedFields: preview.blockedFields,
    });
    mocks.publish.mockResolvedValue({
      status: 'published',
      operationId: 'publish-operation',
      branchName: 'tjuae-publish-tjuaeasset-local-demo-abcd',
      pullRequestUrl: 'https://github.com/liangboqiang/TjuaeHub/pull/42',
      repository: 'https://github.com/liangboqiang/TjuaeHub',
    });
    mocks.openExternal.mockResolvedValue(undefined);
  });

  it('通过 Device Flow 显示一次性代码，并在 Core 确认后进入已连接状态', async () => {
    mocks.getConnection.mockResolvedValueOnce({ state: 'disconnected' });
    render(<AssetPublishDialog asset={asset} />);

    fireEvent.click(screen.getByText('settings.assetPublish.action'));
    expect(await screen.findByText('settings.assetPublish.disconnected')).toBeInTheDocument();
    fireEvent.click(screen.getByText('settings.assetPublish.connect'));

    expect(await screen.findByText('ABCD-EFGH')).toBeInTheDocument();
    fireEvent.click(screen.getByText('settings.assetPublish.openGitHub'));
    await waitFor(() => expect(mocks.openExternal).toHaveBeenCalledWith('https://github.com/login/device'));
    fireEvent.click(screen.getByText('settings.assetPublish.checkAuthorization'));
    expect(await screen.findByText('settings.assetPublish.connectedAs:octocat')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('access_token');
  });

  it('缺少 GitHub App 安装时提供受控安装入口并支持原地复检', async () => {
    mocks.getConnection.mockResolvedValueOnce({
      state: 'insufficientPermissions',
      account: 'octocat',
      reasonCode: 'GITHUB_APP_INSTALLATION_REQUIRED',
      installationUri: 'https://github.com/apps/tjuae-publisher/installations/new',
    });
    render(<AssetPublishDialog asset={asset} />);

    fireEvent.click(screen.getByText('settings.assetPublish.action'));
    expect(await screen.findByText('settings.assetPublish.installationRequired')).toBeInTheDocument();
    fireEvent.click(screen.getByText('settings.assetPublish.installGitHubApp'));
    await waitFor(() =>
      expect(mocks.openExternal).toHaveBeenCalledWith('https://github.com/apps/tjuae-publisher/installations/new')
    );
    fireEvent.click(screen.getByText('settings.assetPublish.checkInstallation'));
    expect(await screen.findByText('settings.assetPublish.connectedAs:octocat')).toBeInTheDocument();
    expect(mocks.startAuthorization).not.toHaveBeenCalled();
  });

  it('先生成 Core 安全预览，再支持手动 PR 或 REST 发布', async () => {
    render(<AssetPublishDialog asset={asset} />);
    fireEvent.click(screen.getByText('settings.assetPublish.action'));
    expect(await screen.findByText('settings.assetPublish.connectedAs:octocat')).toBeInTheDocument();

    const publishButton = screen.getByText('settings.assetPublish.publish').closest('button');
    expect(publishButton).toBeDisabled();
    confirmLegalMetadata();
    fireEvent.click(screen.getByText('settings.assetPublish.preview'));
    expect(await screen.findByText('SKILL.md')).toBeInTheDocument();
    expect(screen.getByText('settings.assetPublish.warningSensitiveFieldsRemoved')).toBeInTheDocument();

    fireEvent.click(screen.getByText('settings.assetPublish.manualPr'));
    await waitFor(() => expect(mocks.prepare).toHaveBeenCalledTimes(1));
    expect(mocks.openExternal).toHaveBeenCalledWith('https://github.com/liangboqiang/TjuaeHub/fork');

    fireEvent.click(screen.getByText('settings.assetPublish.publish'));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(1));
    expect(mocks.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        assetKind: 'skill',
        assetId: 'skill:local-demo',
        packageName: 'tjuaeasset-local-demo',
        version: '1.0.0',
        author: 'Demo Author',
        license: 'MIT',
        sourceRepository: 'https://github.com/example/local-demo',
        metadataConfirmed: true,
        idempotencyKey: expect.any(String),
      })
    );
    expect(mocks.openExternal).toHaveBeenCalledWith('https://github.com/liangboqiang/TjuaeHub/pull/42');
  });

  it('发布失败重试沿用同一幂等键', async () => {
    mocks.publish.mockRejectedValueOnce(new Error('temporary network failure')).mockResolvedValueOnce({
      status: 'published',
      operationId: 'publish-operation',
      branchName: 'tjuae-publish-tjuaeasset-local-demo-abcd',
      pullRequestUrl: 'https://github.com/liangboqiang/TjuaeHub/pull/42',
      repository: 'https://github.com/liangboqiang/TjuaeHub',
    });
    render(<AssetPublishDialog asset={asset} />);
    fireEvent.click(screen.getByText('settings.assetPublish.action'));
    await screen.findByText('settings.assetPublish.connectedAs:octocat');
    confirmLegalMetadata();
    fireEvent.click(screen.getByText('settings.assetPublish.preview'));
    await screen.findByText('SKILL.md');

    fireEvent.click(screen.getByText('settings.assetPublish.publish'));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('settings.assetPublish.publish'));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(2));

    expect(mocks.publish.mock.calls[0][0].idempotencyKey).toBe(mocks.publish.mock.calls[1][0].idempotencyKey);
  });

  it('未配置 GitHub App 时仍保留安全预览和手动 PR，自动发布保持禁用', async () => {
    mocks.getConnection.mockResolvedValueOnce({ state: 'notConfigured' });
    render(<AssetPublishDialog asset={asset} />);
    fireEvent.click(screen.getByText('settings.assetPublish.action'));
    expect(await screen.findByText('settings.assetPublish.notConfiguredTitle')).toBeInTheDocument();
    confirmLegalMetadata();
    fireEvent.click(screen.getByText('settings.assetPublish.preview'));
    await screen.findByText('SKILL.md');
    expect(screen.getByText('settings.assetPublish.publish').closest('button')).toBeDisabled();
    fireEvent.click(screen.getByText('settings.assetPublish.manualPr'));
    await waitFor(() => expect(mocks.prepare).toHaveBeenCalledTimes(1));
  });

  it('作者、许可证和明确确认缺一项时拒绝生成发布预览', async () => {
    render(<AssetPublishDialog asset={asset} />);
    fireEvent.click(screen.getByText('settings.assetPublish.action'));
    await screen.findByText('settings.assetPublish.connectedAs:octocat');

    expect(
      screen.getByRole('textbox', {
        name: 'settings.assetPublish.author',
      })
    ).toHaveValue('');
    expect(
      screen.getByRole('textbox', {
        name: 'settings.assetPublish.license',
      })
    ).toHaveValue('');
    expect(
      screen.getByRole('checkbox', {
        name: 'settings.assetPublish.metadataConfirmation',
      })
    ).not.toBeChecked();

    fireEvent.click(screen.getByText('settings.assetPublish.preview'));
    await waitFor(() => expect(mocks.prepare).not.toHaveBeenCalled());
    expect(screen.getByText('settings.assetPublish.authorRequired')).toBeInTheDocument();
    expect(screen.getByText('settings.assetPublish.licenseRequired')).toBeInTheDocument();
    expect(screen.getByText('settings.assetPublish.metadataConfirmationRequired')).toBeInTheDocument();
  });

  it('在前端使用与 Hub schema 一致的包名、作者和许可证长度上限', async () => {
    render(<AssetPublishDialog asset={asset} />);
    fireEvent.click(screen.getByText('settings.assetPublish.action'));
    await screen.findByText('settings.assetPublish.connectedAs:octocat');

    expect(
      screen.getByRole('textbox', {
        name: 'settings.assetPublish.packageName',
      })
    ).toHaveAttribute('maxlength', '96');
    expect(
      screen.getByRole('textbox', {
        name: 'settings.assetPublish.author',
      })
    ).toHaveAttribute('maxlength', '128');
    expect(
      screen.getByRole('textbox', {
        name: 'settings.assetPublish.license',
      })
    ).toHaveAttribute('maxlength', '128');
  });
});
