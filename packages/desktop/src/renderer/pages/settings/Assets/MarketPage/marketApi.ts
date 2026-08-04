import type { AssetFile, AssetKind, MarketIndex } from '@/common/types/agent/assets';
import { httpGet, httpPost } from '@/common/adapter/httpBridge';
import { ASSET_PROTOCOL_REQUEST_OPTIONS } from '@/common/adapter/assetProtocolContract';

type MarketOperation = {
  operationId: string;
  assetId: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'rolledBack';
};

type MarketMutationParams = {
  remoteAssetId: string;
  idempotencyKey: string;
};

/**
 * 远程市场只接收原子资产索引；接口不可用时由页面显示真实空态，
 * 不从扩展注册表合成任何市场状态。
 */
export const marketApi = {
  listAssets: httpGet<MarketIndex, { kind?: AssetKind; search?: string }>(
    (params) => {
      const query = new URLSearchParams();
      if (params.kind) query.set('kind', params.kind);
      if (params.search?.trim()) query.set('search', params.search.trim());
      const suffix = query.toString();
      return `/api/market/assets${suffix ? `?${suffix}` : ''}`;
    },
    { ...ASSET_PROTOCOL_REQUEST_OPTIONS, silentStatuses: [404, 501, 503] }
  ),
  refresh: httpPost<MarketIndex['cache'], { distributionRevision?: string }>(
    '/api/market/refresh',
    ({ distributionRevision }) => (distributionRevision ? { distributionRevision } : {}),
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  readFile: httpGet<AssetFile, { remoteAssetId: string; path: string }>((params) => {
    const query = new URLSearchParams({
      remoteAssetId: params.remoteAssetId,
      path: params.path,
    });
    return `/api/market/files?${query.toString()}`;
  }, ASSET_PROTOCOL_REQUEST_OPTIONS),
  install: httpPost<MarketOperation, MarketMutationParams>(
    '/api/market/assets/install',
    ({ remoteAssetId, idempotencyKey }) => ({ remoteAssetId, idempotencyKey }),
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
  sync: httpPost<MarketOperation, MarketMutationParams>(
    '/api/market/assets/sync',
    ({ remoteAssetId, idempotencyKey }) => ({ remoteAssetId, idempotencyKey }),
    ASSET_PROTOCOL_REQUEST_OPTIONS
  ),
};
