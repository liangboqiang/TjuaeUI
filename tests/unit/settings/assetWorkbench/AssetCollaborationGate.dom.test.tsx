import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Outlet } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  getProtocol: vi.fn(),
}));

vi.mock('@/renderer/pages/settings/Assets/components/assetProtocol', () => ({
  assetProtocolApi: { get: { invoke: mocks.getProtocol } },
  validateAssetCollaborationProtocol: (
    protocol: { protocolVersion: string; buildIdentifier: string; capabilities: string[] },
    expectedBuildIdentifier: string
  ) => {
    const requiredCapabilities = [
      'localAssetCatalogV1',
      'remoteMarketV2',
      'hubPullRequestPublishV1',
      'runtimeAssetReceiptV1',
      'typedAssetRuntimeV1',
    ];
    if (protocol.protocolVersion !== '1.0.0') {
      return { compatible: false, reason: 'versionMismatch' };
    }
    if (protocol.buildIdentifier !== expectedBuildIdentifier) {
      return {
        compatible: false,
        reason: 'buildMismatch',
        expectedBuildIdentifier,
        actualBuildIdentifier: protocol.buildIdentifier,
      };
    }
    return requiredCapabilities.every((capability) => protocol.capabilities.includes(capability))
      ? { compatible: true }
      : { compatible: false, reason: 'capabilityMissing' };
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'settings.assetProtocol.incompatibleTitle': '必须重新构建 TjuaeCore',
          'settings.assetProtocol.incompatibleDescription': '当前 TjuaeCore 不支持所需的资产协作能力。',
          'settings.assetProtocol.buildMismatchTitle': 'TjuaeCore 版本不匹配',
          'settings.assetProtocol.buildMismatchDescription': '当前运行的 TjuaeCore 构建与界面不匹配。',
          'settings.assetProtocol.checking': '正在检查 TjuaeCore 资产协作协议…',
          'common.retry': '重试',
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

vi.mock('@renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({ status: 'authenticated' }),
}));

vi.mock('@renderer/pages/settings/SkillsSettings/SkillsSettings', () => ({
  default: () => '技能资产页面',
}));

import AssetCollaborationGate from '@/renderer/pages/settings/Assets/components/AssetCollaborationGate';
import PanelRoute from '@/renderer/components/layout/Router';

const completeCapabilities = [
  'localAssetCatalogV1',
  'remoteMarketV2',
  'hubPullRequestPublishV1',
  'runtimeAssetReceiptV1',
  'typedAssetRuntimeV1',
];

const TestLayout = () => <Outlet />;

describe('AssetCollaborationGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('__TJUAE_CORE_BUILD_IDENTIFIER__', '0.2.0');
    window.location.hash = '#/';
  });

  it('does not render the legacy publishing surface when the protocol endpoint is missing', async () => {
    mocks.getProtocol.mockRejectedValueOnce(new Error('404'));
    render(
      <AssetCollaborationGate>
        <div>legacy GitHub publishing surface</div>
      </AssetCollaborationGate>
    );

    expect(await screen.findByText('必须重新构建 TjuaeCore')).toBeInTheDocument();
    expect(screen.queryByText('legacy GitHub publishing surface')).not.toBeInTheDocument();
  });

  it('renders asset features only after the matching protocol is confirmed', async () => {
    mocks.getProtocol.mockResolvedValueOnce({
      protocolVersion: '1.0.0',
      buildIdentifier: '0.2.0',
      capabilities: completeCapabilities,
    });
    render(
      <AssetCollaborationGate>
        <div>asset workbench</div>
      </AssetCollaborationGate>
    );

    expect(await screen.findByText('asset workbench')).toBeInTheDocument();
  });

  it('shows a Chinese fail-fast error when Core omits a required capability', async () => {
    mocks.getProtocol.mockResolvedValueOnce({
      protocolVersion: '1.0.0',
      buildIdentifier: '0.2.0',
      capabilities: completeCapabilities.slice(0, -1),
    });
    render(
      <AssetCollaborationGate>
        <div>asset workbench</div>
      </AssetCollaborationGate>
    );

    expect(await screen.findByText('必须重新构建 TjuaeCore')).toBeInTheDocument();
    expect(screen.queryByText('asset workbench')).not.toBeInTheDocument();
  });

  it('shows a build-specific error and blocks assets when a stale Core responds', async () => {
    mocks.getProtocol.mockResolvedValueOnce({
      protocolVersion: '1.0.0',
      buildIdentifier: '0.1.0',
      capabilities: completeCapabilities,
    });
    render(
      <AssetCollaborationGate>
        <div>asset workbench</div>
      </AssetCollaborationGate>
    );

    expect(await screen.findByText('TjuaeCore 版本不匹配')).toBeInTheDocument();
    expect(screen.queryByText('asset workbench')).not.toBeInTheDocument();
  });

  it('guards the skills catalog at the settings route boundary before the page can call assetApi', async () => {
    mocks.getProtocol.mockRejectedValueOnce(new Error('404'));
    window.location.hash = '#/settings/skills';

    render(<PanelRoute layout={<TestLayout />} />);

    expect(await screen.findByText('必须重新构建 TjuaeCore')).toBeInTheDocument();
    expect(screen.queryByText('技能资产页面')).not.toBeInTheDocument();
  });
});
