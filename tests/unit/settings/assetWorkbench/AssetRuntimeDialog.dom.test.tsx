import type {
  AssetDetail,
  AssetOverlayResponse,
  EngineAdapterDefinition,
  McpDefinition,
} from '@/common/types/agent/assets';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  overlay: vi.fn(),
  readFile: vi.fn(),
  configure: vi.fn(),
  onSaved: vi.fn(),
  onClose: vi.fn(),
  messageSuccess: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/renderer/pages/settings/Assets/LocalAssetPage/assetApi', () => ({
  assetApi: {
    overlay: { invoke: mocks.overlay },
    readFile: { invoke: mocks.readFile },
    configure: { invoke: mocks.configure },
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

import AssetRuntimeDialog from '@/renderer/pages/settings/Assets/LocalAssetPage/AssetRuntimeDialog';

const asset: AssetDetail = {
  id: 'engine:demo',
  kind: 'engineAdapter',
  displayName: 'Demo Engine',
  origin: 'hub',
  trust: 'verified',
  scope: 'user',
  editability: 'overlay',
  definitionDigest: 'sha256-definition',
  runtimeState: 'inactive',
  allowedActions: ['view', 'configure', 'validate', 'tryRun', 'activate'],
  runtimeId: 'demo-engine',
  createdAt: 1,
  updatedAt: 2,
  files: [],
  entryFile: 'engine-adapter.json',
  contentSource: 'local',
  sourceDigest: 'sha256-definition',
};

const definition: EngineAdapterDefinition = {
  $schema: 'https://example.invalid/engine-adapter-definition.v1.schema.json',
  schemaVersion: 1,
  kind: 'engineAdapter',
  id: 'engine:demo',
  runtimeId: 'demo-engine',
  displayName: 'Demo Engine',
  protocol: {
    type: 'acp',
    transport: 'stdio',
  },
  runtime: {
    commandName: 'demo-engine',
  },
  configurationSchema: {
    fields: [
      {
        key: 'profile',
        label: 'Profile',
        valueType: 'string',
        required: true,
        secret: false,
        binding: { target: 'environment', name: 'TJUE_PROFILE' },
      },
      {
        key: 'retries',
        label: 'Retries',
        valueType: 'number',
        required: true,
        secret: false,
        binding: { target: 'environment', name: 'TJUE_RETRIES' },
      },
      {
        key: 'streaming',
        label: 'Streaming',
        valueType: 'boolean',
        required: true,
        secret: false,
        binding: { target: 'environment', name: 'TJUE_STREAMING' },
      },
      {
        key: 'apiKey',
        label: 'API key',
        valueType: 'string',
        required: false,
        secret: true,
        binding: { target: 'environment', name: 'TJUE_API_KEY' },
      },
    ],
  },
};

const mcpAsset: AssetDetail = {
  ...asset,
  id: 'mcp:remote-demo',
  kind: 'mcp',
  displayName: 'Remote MCP',
  runtimeId: 'remote-mcp',
  entryFile: 'mcp.json',
};

const mcpDefinition: McpDefinition = {
  $schema: 'https://example.invalid/mcp-definition.v1.schema.json',
  schemaVersion: 1,
  kind: 'mcp',
  id: 'mcp:remote-demo',
  runtimeId: 'remote-mcp',
  displayName: 'Remote MCP',
  transport: {
    type: 'streamableHttp',
  },
};

const privateConfiguration: AssetOverlayResponse['configuration'] = {
  kind: 'engineAdapter',
  configuration: {
    arguments: [],
    environment: [],
    values: [
      { key: 'profile', value: 'default' },
      { key: 'retries', value: 2 },
      { key: 'streaming', value: false },
    ],
    secrets: [{ key: 'apiKey', secretSlot: 'configuration.apiKey' }],
  },
};

const overlayResponse = (secretSlots: AssetOverlayResponse['secretSlots'] = []): AssetOverlayResponse => ({
  assetId: asset.id,
  kind: 'engineAdapter',
  configuration: privateConfiguration,
  secretSlots,
  version: 4,
  updatedAt: 3,
});

const renderDialog = (targetAsset: AssetDetail = asset) =>
  render(<AssetRuntimeDialog visible asset={targetAsset} onClose={mocks.onClose} onSaved={mocks.onSaved} />);

describe('asset runtime private configuration dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.overlay.mockResolvedValue(overlayResponse());
    mocks.readFile.mockResolvedValue({
      assetId: asset.id,
      path: asset.entryFile,
      digest: 'sha256-entry',
      mediaType: 'application/json',
      content: JSON.stringify(definition),
      contentSource: 'local',
    });
    mocks.configure.mockResolvedValue(overlayResponse());
    mocks.onSaved.mockResolvedValue(undefined);
  });

  it('renders and persists schema-driven string, number, and boolean values', async () => {
    renderDialog();

    const profile = await screen.findByLabelText('Profile');
    const retries = screen.getByLabelText('Retries');
    const streaming = screen.getByLabelText('Streaming');

    expect(profile).toHaveValue('default');
    expect(retries).toHaveValue('2');
    expect(streaming).toHaveAttribute('aria-checked', 'false');

    fireEvent.change(profile, { target: { value: 'work' } });
    fireEvent.change(retries, { target: { value: '5' } });
    fireEvent.click(streaming);
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(mocks.configure).toHaveBeenCalledTimes(1));
    const request = mocks.configure.mock.calls[0]?.[0];
    expect(request.configuration.configuration.values).toEqual(
      expect.arrayContaining([
        { key: 'profile', value: 'work' },
        { key: 'retries', value: 5 },
        { key: 'streaming', value: true },
      ])
    );
    expect(request.configuration.configuration.secrets).toEqual([]);
    expect(request.secretUpdates).toEqual([]);
  });

  it('keeps an existing secret when its one-time input is left blank and never renders secret material', async () => {
    mocks.overlay.mockResolvedValue(
      overlayResponse([
        {
          slot: 'configuration.apiKey',
          configured: true,
          maskedValue: 'CIPHERTEXT_OR_PRIVATE_REFERENCE_MUST_NOT_RENDER',
        },
      ])
    );
    renderDialog();

    const secretInput = await screen.findByLabelText('API key');
    expect(secretInput).toHaveValue('');
    expect(screen.queryByText('CIPHERTEXT_OR_PRIVATE_REFERENCE_MUST_NOT_RENDER')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('configuration.apiKey');

    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(mocks.configure).toHaveBeenCalledTimes(1));
    expect(mocks.configure.mock.calls[0]?.[0].secretUpdates).toEqual([]);
  });

  it('submits a newly entered secret once without storing it in public configuration', async () => {
    renderDialog();

    const secretInput = await screen.findByLabelText('API key');
    fireEvent.change(secretInput, { target: { value: 'one-time-secret' } });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(mocks.configure).toHaveBeenCalledTimes(1));
    const request = mocks.configure.mock.calls[0]?.[0];
    expect(request.secretUpdates).toEqual([
      {
        slot: 'configuration.apiKey',
        operation: 'set',
        value: 'one-time-secret',
      },
    ]);
    expect(JSON.stringify(request.configuration)).not.toContain('one-time-secret');
  });

  it('submits an explicit clear operation for an existing optional credential', async () => {
    mocks.overlay.mockResolvedValue(
      overlayResponse([
        {
          slot: 'configuration.apiKey',
          configured: true,
          maskedValue: '••••••',
        },
      ])
    );
    renderDialog();

    await screen.findByLabelText('API key');
    fireEvent.click(screen.getByText('settings.assetRuntime.clearSecret'));
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(mocks.configure).toHaveBeenCalledTimes(1));
    const request = mocks.configure.mock.calls[0]?.[0];
    expect(request.configuration.configuration.secrets).toEqual([]);
    expect(request.secretUpdates).toEqual([
      {
        slot: 'configuration.apiKey',
        operation: 'clear',
      },
    ]);
  });

  it('discards an unsaved named secret when its row is removed', async () => {
    renderDialog();

    await screen.findByLabelText('Profile');
    fireEvent.click(screen.getByText('common.add'));
    fireEvent.change(
      screen.getByLabelText('settings.assetRuntime.fields.environment settings.assetRuntime.secretNamePlaceholder 1'),
      { target: { value: 'TOKEN' } }
    );
    fireEvent.change(
      screen.getByLabelText('settings.assetRuntime.fields.environment settings.assetRuntime.secretValueLabel 1'),
      { target: { value: 'discard-me' } }
    );
    fireEvent.click(screen.getByLabelText('common.delete'));
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(mocks.configure).toHaveBeenCalledTimes(1));
    const request = mocks.configure.mock.calls[0]?.[0];
    expect(request.configuration.configuration.environment).toEqual([]);
    expect(request.secretUpdates).toEqual([]);
  });

  it('uses the immutable Definition transport for first-time remote MCP configuration', async () => {
    mocks.overlay.mockRejectedValue({
      name: 'BackendHttpError',
      status: 404,
      code: 'ASSET_OVERLAY_NOT_CONFIGURED',
    });
    mocks.readFile.mockResolvedValue({
      assetId: mcpAsset.id,
      path: mcpAsset.entryFile,
      digest: 'sha256-mcp-entry',
      mediaType: 'application/json',
      content: JSON.stringify(mcpDefinition),
      contentSource: 'local',
    });
    mocks.configure.mockResolvedValue({
      assetId: mcpAsset.id,
      kind: 'mcp',
      configuration: {
        kind: 'mcp',
        configuration: {
          transport: 'streamableHttp',
          instanceUrl: 'https://example.invalid/mcp',
          arguments: [],
          environment: [],
          headers: [],
          values: [],
          secrets: [],
        },
      },
      secretSlots: [],
      version: 1,
      updatedAt: 4,
    });
    renderDialog(mcpAsset);

    await screen.findByText('settings.assetRuntime.transports.streamableHttp');
    expect(screen.getByLabelText('settings.assetRuntime.fields.transport')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByLabelText('settings.assetRuntime.fields.arguments')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.assetRuntime.fields.environment')).not.toBeInTheDocument();

    const instanceUrl = screen.getByLabelText('settings.assetRuntime.fields.instanceUrl');
    expect(screen.getByText('common.save').closest('button')).toBeDisabled();
    fireEvent.change(instanceUrl, { target: { value: 'https://example.invalid/mcp' } });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(mocks.configure).toHaveBeenCalledTimes(1));
    expect(mocks.configure.mock.calls[0]?.[0].configuration).toMatchObject({
      kind: 'mcp',
      configuration: {
        transport: 'streamableHttp',
        instanceUrl: 'https://example.invalid/mcp',
      },
    });
  });

  it('blocks a missing required schema value before sending configuration to Core', async () => {
    renderDialog();

    const profile = await screen.findByLabelText('Profile');
    fireEvent.change(profile, { target: { value: '' } });

    expect(screen.getByText('settings.assetRuntime.invalidConfiguration')).toBeInTheDocument();
    expect(screen.getByText('common.save').closest('button')).toBeDisabled();
    expect(mocks.configure).not.toHaveBeenCalled();
  });
});
