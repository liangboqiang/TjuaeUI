import { assetApi } from '@/renderer/pages/settings/Assets/LocalAssetPage/assetApi';
import { marketApi } from '@/renderer/pages/settings/Assets/MarketPage/marketApi';
import { assetProtocolApi } from '@/renderer/pages/settings/Assets/components/assetProtocol';
import {
  ASSET_COLLABORATION_PROTOCOL_HEADER,
  ASSET_COLLABORATION_PROTOCOL_VERSION,
} from '@/common/adapter/assetProtocolContract';
import { hub } from '@/common/adapter/ipcBridge';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

const okJson = (data: unknown): Response =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const getFetchCall = (index: number): [string, RequestInit] => {
  const call = fetchMock.mock.calls[index] as [string, RequestInit] | undefined;
  if (!call) throw new Error(`expected fetch call ${index}`);
  return call;
};

describe('asset workbench API adapters', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => okJson({}));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('leaves discovery header-free and identifies every guarded asset namespace', async () => {
    await assetProtocolApi.get.invoke();
    await assetApi.detail.invoke({ assetId: 'skill:demo' });
    await marketApi.listAssets.invoke({});
    await hub.preparePublish.invoke({
      assetKind: 'skill',
      assetId: 'skill:demo',
      packageName: 'tjuaeasset-demo',
      version: '1.0.0',
      author: 'Tjuae',
      license: 'Apache-2.0',
      sourceRepository: 'https://github.com/example/demo',
      metadataConfirmed: true,
      idempotencyKey: 'publish-1',
    });

    const protocolHeader = (callIndex: number) =>
      new Headers((fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined)?.headers).get(
        ASSET_COLLABORATION_PROTOCOL_HEADER
      );

    expect(protocolHeader(0)).toBeNull();
    expect(protocolHeader(1)).toBe(ASSET_COLLABORATION_PROTOCOL_VERSION);
    expect(protocolHeader(2)).toBe(ASSET_COLLABORATION_PROTOCOL_VERSION);
    expect(protocolHeader(3)).toBe(ASSET_COLLABORATION_PROTOCOL_VERSION);
  });

  it('requests local and baseline content through the source-aware Core contract', async () => {
    await assetApi.detail.invoke({ assetId: 'skill:demo', source: 'base' });
    await assetApi.readFile.invoke({ assetId: 'skill:demo', path: 'references/设计.md', source: 'local' });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:13400/api/assets/skill%3Ademo?source=base');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://127.0.0.1:13400/api/assets/skill%3Ademo/files?path=references%2F%E8%AE%BE%E8%AE%A1.md&source=local'
    );
  });

  it('sends the current file digest as the optimistic write precondition', async () => {
    await assetApi.writeFile.invoke({
      assetId: 'skill:demo',
      path: 'SKILL.md',
      content: '# Updated',
      expectedDigest: 'sha256-old',
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.method).toBe('PUT');
    expect(JSON.parse(String(request.body))).toEqual({
      path: 'SKILL.md',
      content: '# Updated',
      expectedDigest: 'sha256-old',
    });
  });

  it('creates and duplicates safe local Definitions without sending runtime state', async () => {
    await assetApi.create.invoke({
      id: 'skill:local-demo',
      kind: 'skill',
      displayName: 'Local demo',
      description: 'Local-only Definition',
    });
    await assetApi.duplicate.invoke({
      sourceAssetId: 'skill:source',
      id: 'skill:copy',
      displayName: 'Local copy',
    });

    const createCall = getFetchCall(0);
    const duplicateCall = getFetchCall(1);
    expect(createCall[0]).toBe('http://127.0.0.1:13400/api/assets');
    expect(JSON.parse(String(createCall[1].body))).toEqual({
      id: 'skill:local-demo',
      kind: 'skill',
      displayName: 'Local demo',
      description: 'Local-only Definition',
    });
    expect(duplicateCall[0]).toBe('http://127.0.0.1:13400/api/assets/skill%3Asource/duplicate');
    expect(JSON.parse(String(duplicateCall[1].body))).toEqual({
      id: 'skill:copy',
      displayName: 'Local copy',
    });
  });

  it('keeps the atomic market endpoint independent from the legacy Hub package API', async () => {
    await marketApi.listAssets.invoke({ kind: 'engineAdapter', search: 'codex cli' });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://127.0.0.1:13400/api/market/assets?kind=engineAdapter&search=codex+cli'
    );
  });

  it('uses the market coordinator for pinned three-way diff and sends all optimistic digests', async () => {
    await assetApi.diff.invoke({ assetId: 'skill:demo' });
    await assetApi.resolve.invoke({
      assetId: 'skill:demo',
      strategy: 'useRemote',
      expectedLocalDigest: 'sha256-local',
      expectedBaseDigest: 'sha256-base',
      expectedRemoteDigest: 'sha256-remote',
      idempotencyKey: 'resolve-1',
      confirmDestructive: true,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:13400/api/market/local/skill%3Ademo/diff');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://127.0.0.1:13400/api/market/local/skill%3Ademo/resolve');
    const resolveCall = fetchMock.mock.calls[1];
    if (!resolveCall) throw new Error('expected resolve request');
    expect(JSON.parse(String((resolveCall[1] as RequestInit).body))).toEqual({
      strategy: 'useRemote',
      expectedLocalDigest: 'sha256-local',
      expectedBaseDigest: 'sha256-base',
      expectedRemoteDigest: 'sha256-remote',
      idempotencyKey: 'resolve-1',
      confirmDestructive: true,
    });
  });

  it('keeps uninstall and detach as distinct local-library operations', async () => {
    await assetApi.uninstall.invoke({
      assetId: 'skill:demo',
      idempotencyKey: 'uninstall-1',
    });
    await assetApi.detach.invoke({ assetId: 'skill:demo' });

    const uninstallCall = fetchMock.mock.calls[0];
    const detachCall = fetchMock.mock.calls[1];
    if (!uninstallCall || !detachCall) throw new Error('expected uninstall and detach requests');

    expect(uninstallCall[0]).toBe('http://127.0.0.1:13400/api/assets/skill%3Ademo/uninstall');
    expect(JSON.parse(String((uninstallCall[1] as RequestInit).body))).toEqual({
      idempotencyKey: 'uninstall-1',
    });
    expect(detachCall[0]).toBe('http://127.0.0.1:13400/api/assets/skill%3Ademo/detach');
    expect(JSON.parse(String((detachCall[1] as RequestInit).body))).toEqual({});
  });

  it('keeps private Overlay configuration separate from explicit runtime lifecycle commands', async () => {
    await assetApi.configure.invoke({
      assetId: 'mcp:demo',
      configuration: {
        kind: 'mcp',
        configuration: {
          transport: 'streamableHttp',
          instanceUrl: 'https://example.invalid/mcp',
          arguments: [],
          environment: [],
          headers: [{ name: 'Authorization', secretSlot: 'header.authorization' }],
          values: [{ key: 'workspace', value: 'demo' }],
          secrets: [],
        },
      },
      secretUpdates: [
        {
          slot: 'header.authorization',
          operation: 'set',
          value: 'one-time-secret',
        },
      ],
      expectedVersion: 3,
    });
    await assetApi.tryRun.invoke({
      assetId: 'mcp:demo',
      idempotencyKey: 'try-run-1',
      expectedDefinitionDigest: 'sha256-definition',
      expectedOverlayVersion: 3,
    });

    const configureCall = getFetchCall(0);
    const tryRunCall = getFetchCall(1);
    expect(configureCall[0]).toBe('http://127.0.0.1:13400/api/assets/mcp%3Ademo/configure');
    expect(JSON.parse(String(configureCall[1].body))).toEqual({
      configuration: {
        kind: 'mcp',
        configuration: {
          transport: 'streamableHttp',
          instanceUrl: 'https://example.invalid/mcp',
          arguments: [],
          environment: [],
          headers: [{ name: 'Authorization', secretSlot: 'header.authorization' }],
          values: [{ key: 'workspace', value: 'demo' }],
          secrets: [],
        },
      },
      secretUpdates: [
        {
          slot: 'header.authorization',
          operation: 'set',
          value: 'one-time-secret',
        },
      ],
      expectedVersion: 3,
    });
    expect(tryRunCall[0]).toBe('http://127.0.0.1:13400/api/assets/mcp%3Ademo/try-run');
    expect(JSON.parse(String(tryRunCall[1].body))).toEqual({
      idempotencyKey: 'try-run-1',
      expectedDefinitionDigest: 'sha256-definition',
      expectedOverlayVersion: 3,
    });
  });
});
