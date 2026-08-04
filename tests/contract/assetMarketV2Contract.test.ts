import type {
  AssetKind,
  AssetTrust,
  MarketAsset,
  MarketAssetStatus,
  MarketIndex,
  MarketPackage,
  MarketPackageReviewStatus,
} from '@/common/types/agent/assets';
import { marketApi } from '@/renderer/pages/settings/Assets/MarketPage/marketApi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import contractFixture from '../fixtures/hub-index.v2.cross-repository.json';

const ENGINE_ID = 'tjuaeasset-contract-engine/engineAdapter/contract-acp';
const SKILL_ID = 'tjuaeasset-contract-skill/skill/contract-helper';
const SOURCE_REVISION = '0123456789abcdef0123456789abcdef01234567';
const DISTRIBUTION_REVISION = 'd123456789abcdef0123456789abcdef01234567';

type RawHubAsset = (typeof contractFixture.assets)[keyof typeof contractFixture.assets];
type RawHubPackage = (typeof contractFixture.packages)[keyof typeof contractFixture.packages];

const parseAssetKind = (value: string): AssetKind => {
  switch (value) {
    case 'assistant':
    case 'engineAdapter':
    case 'skill':
    case 'mcp':
      return value;
    default:
      throw new Error(`unsupported Hub asset kind: ${value}`);
  }
};

const parseAssetTrust = (value: string): AssetTrust => {
  switch (value) {
    case 'official':
    case 'verified':
    case 'community':
      return value;
    default:
      throw new Error(`unsupported Hub asset trust: ${value}`);
  }
};

const parseAssetStatus = (value: string): MarketAssetStatus => {
  switch (value) {
    case 'active':
    case 'deprecated':
    case 'revoked':
      return value;
    default:
      throw new Error(`unsupported Hub asset status: ${value}`);
  }
};

const parseReviewStatus = (value: string): MarketPackageReviewStatus => {
  switch (value) {
    case 'approved':
    case 'underReview':
    case 'rejected':
      return value;
    default:
      throw new Error(`unsupported Hub package review status: ${value}`);
  }
};

const parseSchemaVersion = (value: number): 2 => {
  if (value !== 2) {
    throw new Error(`unsupported Hub schema version: ${value}`);
  }
  return value;
};

const toMarketAsset = (asset: RawHubAsset): MarketAsset => ({
  id: asset.id,
  kind: parseAssetKind(asset.kind),
  runtimeId: asset.runtimeId,
  dependencies: [...asset.dependencies],
  displayName: asset.displayName,
  description: asset.description,
  version: asset.version,
  definitionDigest: asset.definitionDigest,
  entryFile: asset.entryFile,
  packageName: asset.packageName,
  author: asset.author,
  license: asset.license,
  trust: parseAssetTrust(asset.trust),
  status: parseAssetStatus(asset.status),
  compatibility: {
    compatible: true,
    tjuae: asset.compatibility.tjuae,
  },
  sourceRevision: asset.sourceRevision,
  files: asset.files.map((file) => ({
    path: file.path,
    digest: file.digest,
    size: file.size,
    mediaType: file.mediaType,
  })),
  tags: [...asset.tags],
  presenceState: 'notInstalled',
  allowedActions: ['view'],
});

const toMarketPackage = (marketPackage: RawHubPackage): MarketPackage => ({
  name: marketPackage.name,
  version: marketPackage.version,
  reviewStatus: parseReviewStatus(marketPackage.reviewStatus),
  atomic: marketPackage.atomic,
  assetIds: [...marketPackage.assetIds],
  dependencies: { ...marketPackage.dependencies },
  tarball: marketPackage.tarball,
  integrity: marketPackage.integrity,
  archiveIntegrity: marketPackage.archiveIntegrity,
  unpackedSize: marketPackage.unpackedSize,
  repository: marketPackage.repository,
  sourcePath: marketPackage.sourcePath,
  manifestPath: marketPackage.manifestPath,
  sourceRevision: marketPackage.sourceRevision,
});

const createMarketResponse = (): MarketIndex => ({
  schemaVersion: parseSchemaVersion(contractFixture.schemaVersion),
  generatedAt: contractFixture.generatedAt,
  assets: Object.values(contractFixture.assets).map(toMarketAsset),
  packages: Object.values(contractFixture.packages).map(toMarketPackage),
  cache: {
    distributionRevision: DISTRIBUTION_REVISION,
    cachedAt: 1,
    sourceUrl: `https://raw.githubusercontent.com/liangboqiang/TjuaeHub/${DISTRIBUTION_REVISION}/index.json`,
    stale: false,
  },
});

const fetchMock = vi.fn();

describe('Hub Index v2 跨仓库契约', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => {
      return new Response(JSON.stringify({ success: true, data: createMarketResponse() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('将固定 engineAdapter 资产完整映射为 UI DTO', () => {
    const engine = createMarketResponse().assets.find((asset) => asset.id === ENGINE_ID);

    expect(engine).toMatchObject({
      kind: 'engineAdapter',
      runtimeId: 'contract-acp',
      dependencies: [SKILL_ID],
      status: 'active',
      definitionDigest: `sha256-${'a'.repeat(64)}`,
      sourceRevision: SOURCE_REVISION,
      files: [
        {
          path: 'asset-package.json',
          digest: `sha256-${'d'.repeat(64)}`,
          size: 1024,
          mediaType: 'application/json',
        },
        {
          path: 'engine-adapter.json',
          digest: `sha256-${'c'.repeat(64)}`,
          size: 384,
          mediaType: 'application/json',
        },
      ],
    });
  });

  it('保留原子包依赖、双摘要与统一源码修订', () => {
    const response = createMarketResponse();
    const enginePackage = response.packages.find((entry) => entry.name === 'tjuaeasset-contract-engine');

    expect(enginePackage).toMatchObject({
      assetIds: [ENGINE_ID],
      reviewStatus: 'approved',
      dependencies: { 'tjuaeasset-contract-skill': '^1.4.0' },
      sourcePath: 'assets/tjuaeasset-contract-engine',
      manifestPath: 'assets/tjuaeasset-contract-engine/asset-package.json',
      integrity: `sha256-${'1'.repeat(64)}`,
      archiveIntegrity: `sha256-${'3'.repeat(64)}`,
      sourceRevision: SOURCE_REVISION,
    });
    expect(response.assets.every((asset) => asset.sourceRevision === SOURCE_REVISION)).toBe(true);
    expect(response.packages.every((entry) => entry.sourceRevision === SOURCE_REVISION)).toBe(true);
  });

  it('通过资产市场 API 读取同一份 v2 DTO 而不访问旧 Hub 接口', async () => {
    const response = await marketApi.listAssets.invoke({ kind: 'engineAdapter' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:13400/api/market/assets?kind=engineAdapter',
      expect.any(Object)
    );
    expect(response.schemaVersion).toBe(2);
    expect(response.assets.find((asset) => asset.id === ENGINE_ID)?.runtimeId).toBe('contract-acp');
  });

  it('固定夹具映射器拒绝旧 agent 类型，避免契约样例掩盖类型漂移', () => {
    expect(() => parseAssetKind('agent')).toThrow('unsupported Hub asset kind');
  });

  it('固定夹具映射器拒绝 v2 之外的样例', () => {
    expect(() => parseSchemaVersion(1)).toThrow('unsupported Hub schema version');
  });

  it('固定夹具保留资产生命周期并拒绝未知治理枚举', () => {
    expect(createMarketResponse().assets.find((asset) => asset.id === SKILL_ID)?.status).toBe('deprecated');
    expect(() => parseAssetStatus('disabled')).toThrow('unsupported Hub asset status');
    expect(() => parseReviewStatus('trusted')).toThrow('unsupported Hub package review status');
  });
});
