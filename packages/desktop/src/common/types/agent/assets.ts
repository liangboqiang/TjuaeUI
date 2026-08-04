/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

export type AssetKind = 'assistant' | 'engineAdapter' | 'skill' | 'mcp';
export type AssetContentSource = 'local' | 'base' | 'remote';
export type AssetOrigin = 'local' | 'hub' | 'seed';
export type AssetTrust = 'official' | 'verified' | 'community';
export type AssetScope = 'system' | 'user';
export type AssetEditability = 'readOnly' | 'overlay' | 'full';
export type AssetTrackingMode = 'tracked' | 'detached';
export type AssetRuntimeState = 'notConfigured' | 'inactive' | 'activating' | 'active' | 'degraded' | 'needsRepair';
export type AssetRuntimeHealthStatus = 'unknown' | 'healthy' | 'unhealthy';
export type AssetRuntimeProjectionKind = AssetKind;

export type AssetSyncState =
  | 'synced'
  | 'localModified'
  | 'remoteUpdated'
  | 'diverged'
  | 'conflict'
  | 'upstreamRemoved'
  | 'incompatible'
  | 'revoked'
  | 'remoteUnknown';

export type AssetAction =
  | 'view'
  | 'edit'
  | 'configure'
  | 'validate'
  | 'tryRun'
  | 'activate'
  | 'deactivate'
  | 'install'
  | 'uninstall'
  | 'sync'
  | 'publish'
  | 'viewDiff'
  | 'resolveConflict'
  | 'detach'
  | 'restore';

export type AssetUpstream = {
  packageName: string;
  remoteAssetId: string;
  version: string;
  sourceRevision: string;
  remoteDigest: string;
  trackingMode: AssetTrackingMode;
  checkedAt?: number;
};

export type AssetSummary = {
  id: string;
  kind: AssetKind;
  displayName: string;
  description?: string;
  origin: AssetOrigin;
  trust: AssetTrust;
  scope: AssetScope;
  editability: AssetEditability;
  definitionDigest: string;
  runtimeState: AssetRuntimeState;
  /** 仅当本地资产仍在跟踪 Hub 上游时存在。 */
  syncState?: AssetSyncState;
  allowedActions: AssetAction[];
  runtimeId?: string;
  upstream?: AssetUpstream;
  createdAt: number;
  updatedAt: number;
};

export type AssetFileEntry = {
  path: string;
  digest: string;
  size: number;
  mediaType: string;
  text: boolean;
};

/** Core 返回的扁平化资产详情。 */
export type AssetDetail = AssetSummary & {
  files: AssetFileEntry[];
  entryFile?: string;
  contentSource: AssetContentSource;
  sourceDigest: string;
  runtimeBinding?: AssetRuntimeBinding;
};

export type AssetRuntimeBinding = {
  assetId: string;
  kind: AssetKind;
  projectionKind: AssetRuntimeProjectionKind;
  /** Definition 中的可移植运行身份；Core 的内部 projectionRuntimeId 永不返回 UI。 */
  portableRuntimeId: string;
  definitionDigest: string;
  overlayVersion: number;
  healthStatus: AssetRuntimeHealthStatus;
  tryRunReceiptId?: string;
  lastErrorCode?: string;
  projectedAt: number;
  healthCheckedAt?: number;
};

export type AssetSecretBinding = {
  name: string;
  secretSlot: string;
};

export type AssetConfigurationValue = string | number | boolean;

export type AssetPublicConfigurationValue = {
  key: string;
  value: AssetConfigurationValue;
};

export type AssetConfigurationSecretBinding = {
  key: string;
  secretSlot: string;
};

export type AssistantAssetOverlay = {
  defaultModelId?: string;
  engineAssetId?: string;
  sortOrder?: number;
};

export type SkillAssetOverlay = Record<string, never>;

export type EngineAdapterAssetOverlay = {
  executablePath?: string;
  command?: string;
  arguments: string[];
  workingDirectory?: string;
  environment: AssetSecretBinding[];
  values: AssetPublicConfigurationValue[];
  secrets: AssetConfigurationSecretBinding[];
};

export type McpAssetTransport = 'stdio' | 'sse' | 'streamableHttp';

export type AssetConfigurationField = {
  key: string;
  label: string;
  description?: string;
  valueType: 'string' | 'number' | 'boolean';
  required: boolean;
  secret: boolean;
  binding: {
    target: 'environment' | 'header';
    name: string;
  };
};

export type AssetConfigurationSchema = {
  fields: AssetConfigurationField[];
};

export type PortableNpmPackage = {
  ecosystem: 'npm';
  name: string;
  version: string;
  runner: 'bunx' | 'npx';
};

export type EngineAdapterDefinition = {
  $schema: string;
  schemaVersion: 1;
  kind: 'engineAdapter';
  id: string;
  runtimeId: string;
  displayName: string;
  description?: string;
  icon?: string;
  protocol: {
    type: 'acp';
    transport: 'stdio';
    arguments?: string[];
  };
  runtime: {
    commandName: string;
  };
  capabilities?: {
    streaming?: boolean;
    authenticationRequired?: boolean;
    skillsDirectories?: string[];
  };
  configurationSchema?: AssetConfigurationSchema;
};

export type McpDefinition = {
  $schema: string;
  schemaVersion: 1;
  kind: 'mcp';
  id: string;
  runtimeId: string;
  displayName: string;
  description?: string;
  transport:
    | {
        type: 'stdio';
        package: PortableNpmPackage;
        arguments?: string[];
      }
    | {
        type: 'sse' | 'streamableHttp';
      };
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    sampling?: boolean;
    logging?: boolean;
    completions?: boolean;
  };
  configurationSchema?: AssetConfigurationSchema;
};

export type McpAssetOverlay = {
  transport: McpAssetTransport;
  executablePath?: string;
  arguments: string[];
  instanceUrl?: string;
  environment: AssetSecretBinding[];
  headers: AssetSecretBinding[];
  values: AssetPublicConfigurationValue[];
  secrets: AssetConfigurationSecretBinding[];
};

export type AssetOverlay =
  | { kind: 'assistant'; configuration: AssistantAssetOverlay }
  | { kind: 'engineAdapter'; configuration: EngineAdapterAssetOverlay }
  | { kind: 'skill'; configuration: SkillAssetOverlay }
  | { kind: 'mcp'; configuration: McpAssetOverlay };

export type AssetOverlayResponse = {
  assetId: string;
  kind: AssetKind;
  configuration: AssetOverlay;
  secretSlots: AssetSecretSlotStatus[];
  version: number;
  updatedAt: number;
};

export type AssetSecretSlotStatus = {
  slot: string;
  configured: boolean;
  maskedValue?: string;
};

export type AssetSecretUpdate =
  | {
      slot: string;
      operation: 'set';
      value: string;
    }
  | {
      slot: string;
      operation: 'clear';
    };

export type CreateLocalAssetRequest = {
  id: string;
  kind: AssetKind;
  displayName: string;
  description?: string;
  runtimeId?: string;
};

export type DuplicateLocalAssetRequest = {
  sourceAssetId: string;
  id: string;
  displayName?: string;
  description?: string;
  runtimeId?: string;
};

export type AssetRuntimeStatus = {
  assetId: string;
  kind: AssetKind;
  runtimeState: AssetRuntimeState;
  overlayVersion?: number;
  runtimeBinding?: AssetRuntimeBinding;
  code?: string;
};

export type AssetFile = {
  assetId: string;
  path: string;
  digest: string;
  mediaType: string;
  content: string;
  contentSource?: AssetContentSource;
};

export type AssetDiffFile = {
  path: string;
  base?: AssetFileEntry;
  local?: AssetFileEntry;
  remote?: AssetFileEntry;
  baseDigest?: string;
  localDigest?: string;
  remoteDigest?: string;
  status:
    | 'unchanged'
    | 'localAdded'
    | 'localModified'
    | 'localDeleted'
    | 'remoteAdded'
    | 'remoteModified'
    | 'remoteDeleted'
    | 'converged'
    | 'diverged'
    | 'conflict';
  autoMergeable: boolean;
};

export type AssetDiff = {
  assetId: string;
  syncState: AssetSyncState;
  localDigest: string;
  baseDigest: string;
  remoteDigest: string;
  files: AssetDiffFile[];
};

export type AssetResolveStrategy = 'autoMerge' | 'keepLocal' | 'useRemote' | 'detach';

export type AssetOperation = {
  operationId: string;
  idempotencyKey: string;
  assetId: string;
  kind:
    | 'install'
    | 'configure'
    | 'validate'
    | 'tryRun'
    | 'activate'
    | 'deactivate'
    | 'uninstall'
    | 'sync'
    | 'resolve'
    | 'detach'
    | 'restore';
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'rolledBack';
  phase: string;
  errorCode?: string;
  startedAt: number;
  finishedAt?: number;
};

export type AssetResolveResult = {
  asset: AssetSummary;
  operation: AssetOperation;
  strategy: AssetResolveStrategy;
  recoveryOperationId?: string;
  recoveryDigest?: string;
};

export type AssetRestoreResult = {
  asset: AssetSummary;
  operation: AssetOperation;
  recoveredDigest: string;
};

export type MarketCompatibility = {
  compatible: boolean;
  tjuae: string;
  reasonCode?: string;
};

export type MarketAssetFile = {
  path: string;
  digest: string;
  size: number;
  mediaType: string;
};

export type MarketAssetStatus = 'active' | 'deprecated' | 'revoked';

export type MarketPackageReviewStatus = 'approved' | 'underReview' | 'rejected';

export type MarketAssetDescriptor = {
  id: string;
  kind: AssetKind;
  runtimeId: string;
  dependencies: string[];
  displayName: string;
  description: string;
  version: string;
  definitionDigest: string;
  entryFile: string;
  packageName: string;
  author: string;
  license: string;
  trust: AssetTrust;
  status: MarketAssetStatus;
  compatibility: MarketCompatibility;
  sourceRevision: string;
  files: MarketAssetFile[];
  tags: string[];
};

export type MarketLocalRelation = {
  localAssetId: string;
  localDigest: string;
  baseDigest?: string;
};

export type MarketPresenceState = 'notInstalled' | 'installed';

export type MarketAsset = MarketAssetDescriptor & {
  /** 远程资产是否已复制到当前用户的 Core 本地资产库。 */
  presenceState: MarketPresenceState;
  /** 仅当已安装的本地副本仍跟踪该远程资产时存在。 */
  syncState?: AssetSyncState;
  allowedActions: AssetAction[];
  local?: MarketLocalRelation;
};

export type MarketPackage = {
  name: string;
  version: string;
  reviewStatus: MarketPackageReviewStatus;
  atomic: boolean;
  assetIds: string[];
  dependencies: Record<string, string>;
  tarball: string;
  integrity: string;
  archiveIntegrity: string;
  unpackedSize: number;
  repository: string;
  sourcePath: string;
  manifestPath: string;
  sourceRevision: string;
};

export type MarketIndex = {
  schemaVersion: 2;
  generatedAt: string;
  assets: MarketAsset[];
  packages: MarketPackage[];
  cache: {
    /** Immutable TjuaeHub dist commit; distinct from asset sourceRevision. */
    distributionRevision?: string;
    cachedAt: number;
    sourceUrl: string;
    stale: boolean;
  };
};
