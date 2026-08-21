export type AssistantCatalogSource = 'mine' | 'tjuae-hub';

export type AssistantCatalogIdentity = {
  source: AssistantCatalogSource;
  namespace: string;
  slug: string;
};

export const assistantCatalogIdentityKey = (identity: AssistantCatalogIdentity): string =>
  `${identity.source}:${identity.namespace}:${identity.slug}`;

export type AssistantCatalogPreferences = {
  selectedVersion?: string;
  followLatest: boolean;
  enabled: boolean;
  activationStatus: 'inactive' | 'ready' | 'pending' | 'error' | string;
  sortOrder: number;
  lastUsedAt?: number;
};

export type AssistantCatalogItem = {
  identity: AssistantCatalogIdentity;
  name: string;
  description: string;
  avatarUrl?: string;
  latestVersion: string;
  categories: string[];
  editable: boolean;
  system: boolean;
  canDisable: boolean;
  canDelete: boolean;
  preferences: AssistantCatalogPreferences;
};

export type AssistantCatalogPage = {
  items: AssistantCatalogItem[];
  total: number;
  nextCursor?: string;
};

export type AssistantDefaultRef = {
  source: string;
  namespace: string;
  slug: string;
};

export type AssistantRequirementKind = 'skill' | 'mcp' | 'model' | 'agent';

export type AssistantRequirement = {
  key: string;
  kind: AssistantRequirementKind;
  required: boolean;
  label: string;
  identity?: AssistantDefaultRef;
  preferredIds: string[];
  versionRequirement?: string;
};

export type AssistantCatalogManifest = {
  format: string;
  formatVersion: number;
  id: string;
  version: string;
  name: string;
  nameI18n: Record<string, string>;
  description: string;
  descriptionI18n: Record<string, string>;
  categories: string[];
  avatar?: string;
  defaults: {
    agent?: string;
    model: { mode: string; value?: string };
    permission: { mode: string; value?: string };
    thoughtLevel: { mode: string; value?: string };
    skills: AssistantDefaultRef[];
    mcps: string[];
  };
  requirements: AssistantRequirement[];
  recommendedPrompts: string[];
  recommendedPromptsI18n: Record<string, string[]>;
  contentHash: string;
};

export type AssistantCatalogVersion = { version: string; revision: string; digest: string };
export type AssistantCatalogFile = { path: string; size: number; sha256: string };
export type AssistantCatalogFileContent = { path: string; content: string; size: number };

export type AssistantCatalogDetail = {
  item: AssistantCatalogItem;
  manifest: AssistantCatalogManifest;
  readme: string;
  files: AssistantCatalogFile[];
  versions: AssistantCatalogVersion[];
};

export type AssistantVersionFileDiff = {
  path: string;
  status: 'added' | 'modified' | 'deleted' | string;
  binary: boolean;
  baseContent?: string;
  targetContent?: string;
};

export type AssistantVersionComparison = {
  baseVersion: string;
  targetVersion: string;
  files: AssistantVersionFileDiff[];
};

export type AssistantActivationStatus =
  | 'ready'
  | 'disabled'
  | 'missing'
  | 'version_conflict'
  | 'ambiguous'
  | 'incompatible'
  | 'configuration_required'
  | 'secret_required'
  | 'unavailable';

export type AssistantActivationAction = 'keep' | 'enable' | 'import' | 'configure' | 'use_default' | 'select' | 'skip';

export type AssistantActivationCandidate = {
  id: string;
  label: string;
  version?: string;
  enabled: boolean;
  available: boolean;
};

export type AssistantActivationItem = {
  requirementKey: string;
  label: string;
  required: boolean;
  status: AssistantActivationStatus;
  message: string;
  allowedActions: AssistantActivationAction[];
  candidates: AssistantActivationCandidate[];
  currentResourceId?: string;
};

export type AssistantActivationGroup = {
  kind: AssistantRequirementKind;
  items: AssistantActivationItem[];
  requiresConfirmation: boolean;
};

export type AssistantActivationPlan = {
  planId: string;
  fingerprint: string;
  identity: AssistantCatalogIdentity;
  version: string;
  groups: AssistantActivationGroup[];
  readyWithoutChanges: boolean;
};

export type AssistantActivationChoice = {
  requirementKey: string;
  action: AssistantActivationAction;
  resourceId?: string;
};

export type AssistantCatalogOperation = {
  identity: AssistantCatalogIdentity;
  version: string;
  enabled: boolean;
  activationStatus: string;
};

export type AssistantRuntimeOption = {
  id: string;
  identity: AssistantCatalogIdentity;
  version: string;
  name: string;
  nameI18n: Record<string, string>;
  description: string;
  descriptionI18n: Record<string, string>;
  avatarUrl?: string;
  agentId: string;
  agent?: {
    agentType: string;
    source: 'internal' | 'builtin' | 'extension' | 'custom';
    backend: string;
  };
  agentStatus: 'missing' | 'online' | 'offline' | 'unchecked';
  teamSelectable: boolean;
  modelIds: string[];
  permission?: string;
  thoughtLevel?: string;
  skillIds: string[];
  mcpIds: string[];
  recommendedPrompts: string[];
  recommendedPromptsI18n: Record<string, string[]>;
  sortOrder: number;
  lastUsedAt?: number;
};

export type CreateMineAssistantRequest = {
  slug: string;
  name: string;
  description: string;
};

export type ImportAssistantRequest = { archivePath: string };

export type CopyAssistantToMineRequest = AssistantCatalogIdentity & {
  version?: string;
  targetSlug: string;
};

export type ExportAssistantRequest = AssistantCatalogIdentity & {
  version?: string;
  outputPath: string;
};

export type ExportAssistantResponse = { outputPath: string };

export type SaveAssistantCatalogFileRequest = AssistantCatalogIdentity & {
  path: string;
  content: string;
};

export type UpdateAssistantCatalogSettingsRequest = AssistantCatalogIdentity & {
  name: string;
  description: string;
  avatar?: string;
  avatarDataUrl?: string;
  categories: string[];
  defaults: AssistantCatalogManifest['defaults'];
  recommendedPrompts: string[];
  rules: string;
};

export type PublishAssistantCatalogRequest = AssistantCatalogIdentity & {
  version: string;
  message: string;
};

export type PublishAssistantCatalogResponse = { commit: string };
