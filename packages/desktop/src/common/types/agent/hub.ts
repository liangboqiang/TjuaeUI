export type HubAssetKind = 'assistant' | 'engineAdapter' | 'skill' | 'mcp';
export type HubPublishWarningCode = 'SENSITIVE_FIELDS_REMOVED';

export type HubPackageFile = {
  path: string;
  content: string;
  sha256: string;
  size: number;
};

export type HubCanonicalPackage = {
  packageName: string;
  manifest: Record<string, unknown>;
  files: HubPackageFile[];
};

export type HubPublishRequest = {
  assetKind: HubAssetKind;
  assetId: string;
  packageName: string;
  version: string;
  author: string;
  license: string;
  sourceRepository: string;
  metadataConfirmed: boolean;
  idempotencyKey: string;
  title?: string;
  body?: string;
};

export type HubPublishConnectionStatus = {
  state: 'notConfigured' | 'disconnected' | 'authorizationPending' | 'connected' | 'insufficientPermissions';
  account?: string;
  userCode?: string;
  verificationUri?: string;
  installationUri?: string;
  expiresAt?: number;
  pollAfterMs?: number;
  reasonCode?: string;
};

export type HubPublishPreparation = {
  status: 'notPushed';
  package: HubCanonicalPackage;
  proposedBranchName: string;
  baseBranch: 'main';
  repository: string;
  manualContributionUrl: string;
  requiresUserAction: true;
  warningCodes: HubPublishWarningCode[];
  blockedFields: string[];
};

export type HubPublishResult = {
  status: 'published';
  operationId: string;
  branchName: string;
  pullRequestUrl: string;
  repository: string;
};
