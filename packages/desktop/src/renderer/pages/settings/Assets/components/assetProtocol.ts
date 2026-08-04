import { httpGet } from '@/common/adapter/httpBridge';
import { ASSET_COLLABORATION_PROTOCOL_VERSION } from '@/common/adapter/assetProtocolContract';

export { ASSET_COLLABORATION_PROTOCOL_VERSION } from '@/common/adapter/assetProtocolContract';

export const REQUIRED_ASSET_COLLABORATION_CAPABILITIES = [
  'localAssetCatalogV1',
  'remoteMarketV2',
  'hubPullRequestPublishV1',
  'runtimeAssetReceiptV1',
  'typedAssetRuntimeV1',
] as const;

export type AssetCollaborationCapability = (typeof REQUIRED_ASSET_COLLABORATION_CAPABILITIES)[number];

export type AssetCollaborationProtocol = {
  protocolVersion: string;
  buildIdentifier: string;
  capabilities: AssetCollaborationCapability[];
};

export type AssetProtocolCompatibility =
  | { compatible: true }
  | {
      compatible: false;
      reason: 'versionMismatch' | 'buildMismatch' | 'capabilityMissing';
      expectedBuildIdentifier?: string;
      actualBuildIdentifier?: string;
    };

/**
 * 验证 Core 明确声明的协议、固定构建版本与能力，不根据旧接口或 GitHub 发布接口推测兼容性。
 */
export const validateAssetCollaborationProtocol = (
  protocol: AssetCollaborationProtocol,
  expectedBuildIdentifier: string
): AssetProtocolCompatibility => {
  if (protocol.protocolVersion !== ASSET_COLLABORATION_PROTOCOL_VERSION) {
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

  const capabilities = new Set(protocol.capabilities);
  return REQUIRED_ASSET_COLLABORATION_CAPABILITIES.every((capability) => capabilities.has(capability))
    ? { compatible: true }
    : { compatible: false, reason: 'capabilityMissing' };
};

export const assetProtocolApi = {
  get: httpGet<AssetCollaborationProtocol, void>('/api/assets/protocol'),
};
