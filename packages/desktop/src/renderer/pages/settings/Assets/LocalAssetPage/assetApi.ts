import type {
  AssetContentSource,
  CreateLocalAssetRequest,
  AssetDetail,
  AssetDiff,
  AssetFile,
  AssetKind,
  AssetOverlay,
  AssetOverlayResponse,
  AssetSecretUpdate,
  AssetOperation,
  AssetResolveResult,
  AssetResolveStrategy,
  AssetRestoreResult,
  AssetRuntimeStatus,
  AssetSummary,
  DuplicateLocalAssetRequest,
} from '@/common/types/agent/assets';
import { httpGet, httpPost, httpPut } from '@/common/adapter/httpBridge';
import { ASSET_PROTOCOL_REQUEST_OPTIONS } from '@/common/adapter/assetProtocolContract';

const assetPath = (assetId: string): string => `/api/assets/${encodeURIComponent(assetId)}`;

type AssetRuntimeCommand = {
  assetId: string;
  idempotencyKey: string;
  expectedDefinitionDigest: string;
  expectedOverlayVersion?: number;
};

const runtimeCommandBody = ({
  idempotencyKey,
  expectedDefinitionDigest,
  expectedOverlayVersion,
}: AssetRuntimeCommand) => ({
  idempotencyKey,
  expectedDefinitionDigest,
  ...(expectedOverlayVersion === undefined ? {} : { expectedOverlayVersion }),
});

export const assetApi = {
  create: httpPost<AssetDetail, CreateLocalAssetRequest>(
    '/api/assets',
    (request) => request,
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  duplicate: httpPost<AssetDetail, DuplicateLocalAssetRequest>(
    (params) => `${assetPath(params.sourceAssetId)}/duplicate`,
    ({ sourceAssetId: _sourceAssetId, ...request }) => request,
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  list: httpGet<AssetSummary[], { kind?: AssetKind }>((params) => {
    const query = params.kind ? `?kind=${encodeURIComponent(params.kind)}` : '';
    return `/api/assets${query}`;
  }, ASSET_PROTOCOL_REQUEST_OPTIONS),
  detail: httpGet<AssetDetail, { assetId: string; source?: AssetContentSource }>((params) => {
    const query = params.source ? `?source=${encodeURIComponent(params.source)}` : '';
    return `${assetPath(params.assetId)}${query}`;
  }, ASSET_PROTOCOL_REQUEST_OPTIONS),
  readFile: httpGet<AssetFile, { assetId: string; path: string; source?: AssetContentSource }>((params) => {
    const query = new URLSearchParams({ path: params.path });
    if (params.source) query.set('source', params.source);
    return `${assetPath(params.assetId)}/files?${query.toString()}`;
  }, ASSET_PROTOCOL_REQUEST_OPTIONS),
  writeFile: httpPut<AssetDetail, { assetId: string; path: string; content: string; expectedDigest: string }>(
    (params) => `${assetPath(params.assetId)}/files`,
    ({ path, content, expectedDigest }) => ({ path, content, expectedDigest }),
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  overlay: httpGet<AssetOverlayResponse, { assetId: string }>(
    (params) => `${assetPath(params.assetId)}/overlay`,
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  configure: httpPut<
    AssetOverlayResponse,
    {
      assetId: string;
      configuration: AssetOverlay;
      secretUpdates: AssetSecretUpdate[];
      expectedVersion?: number;
    }
  >(
    (params) => `${assetPath(params.assetId)}/configure`,
    ({ configuration, secretUpdates, expectedVersion }) => ({
      configuration,
      secretUpdates,
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
    }),
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  validate: httpPost<AssetRuntimeStatus, AssetRuntimeCommand>(
    (params) => `${assetPath(params.assetId)}/validate`,
    runtimeCommandBody,
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  tryRun: httpPost<AssetRuntimeStatus, AssetRuntimeCommand>(
    (params) => `${assetPath(params.assetId)}/try-run`,
    runtimeCommandBody,
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  activate: httpPost<AssetRuntimeStatus, AssetRuntimeCommand>(
    (params) => `${assetPath(params.assetId)}/activate`,
    runtimeCommandBody,
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  deactivate: httpPost<AssetRuntimeStatus, AssetRuntimeCommand>(
    (params) => `${assetPath(params.assetId)}/deactivate`,
    runtimeCommandBody,
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  diff: httpGet<AssetDiff, { assetId: string }>(
    (params) => `/api/market/local/${encodeURIComponent(params.assetId)}/diff`,
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  resolve: httpPost<
    AssetResolveResult,
    {
      assetId: string;
      strategy: AssetResolveStrategy;
      expectedLocalDigest: string;
      expectedBaseDigest: string;
      expectedRemoteDigest: string;
      idempotencyKey: string;
      confirmDestructive?: boolean;
    }
  >(
    (params) => `/api/market/local/${encodeURIComponent(params.assetId)}/resolve`,
    ({
      strategy,
      expectedLocalDigest,
      expectedBaseDigest,
      expectedRemoteDigest,
      idempotencyKey,
      confirmDestructive,
    }) => ({
      strategy,
      expectedLocalDigest,
      expectedBaseDigest,
      expectedRemoteDigest,
      idempotencyKey,
      confirmDestructive: confirmDestructive ?? false,
    }),
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  restore: httpPost<
    AssetRestoreResult,
    {
      assetId: string;
      recoveryOperationId: string;
      expectedLocalDigest: string;
      idempotencyKey: string;
    }
  >(
    (params) => `/api/market/local/${encodeURIComponent(params.assetId)}/restore`,
    ({ recoveryOperationId, expectedLocalDigest, idempotencyKey }) => ({
      recoveryOperationId,
      expectedLocalDigest,
      idempotencyKey,
    }),
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  uninstall: httpPost<AssetOperation, { assetId: string; idempotencyKey: string }>(
    (params) => `${assetPath(params.assetId)}/uninstall`,
    ({ idempotencyKey }) => ({ idempotencyKey }),
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  detach: httpPost<AssetSummary, { assetId: string }>(
    (params) => `${assetPath(params.assetId)}/detach`,
    () => ({}),
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
};
