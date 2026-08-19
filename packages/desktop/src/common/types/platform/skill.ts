/** The four first-class skill sources shown by one catalog. */
export type SkillSource = 'mine' | 'tjuae-hub' | 'skillhub' | 'clawhub';

export type SkillIdentity = {
  source: SkillSource;
  namespace: string;
  slug: string;
};

export const skillIdentityKey = (identity: SkillIdentity): string =>
  `${identity.source}:${identity.namespace}:${identity.slug}`;

/** User state lives outside the public skill package. */
export type SkillPreferences = {
  selectedVersion?: string;
  followLatest: boolean;
  enabled: boolean;
  /** Add this skill to the initial skill set of newly-created assistants. */
  autoInject: boolean;
};

export type SkillCatalogItem = {
  identity: SkillIdentity;
  name: string;
  description: string;
  latestVersion: string;
  categories: string[];
  tags: string[];
  iconUrl?: string;
  author?: string;
  preferences: SkillPreferences;
  editable: boolean;
  canCopyToMine: boolean;
  canPublishToTjuaeHub: boolean;
};

export type SkillCatalogPage = {
  items: SkillCatalogItem[];
  total: number;
  nextCursor?: string;
};

export type SkillCatalogVersion = {
  version: string;
  contentHash?: string;
  publishedAt?: number;
};

export type SkillCatalogFile = {
  path: string;
  size: number;
  sha256?: string;
};

export type SkillCatalogFileContent = {
  path: string;
  content: string;
  size: number;
  editable: boolean;
};

export type SkillCatalogDetail = {
  skill: SkillCatalogItem;
  selectedVersion: string;
  versions: SkillCatalogVersion[];
  files: SkillCatalogFile[];
  readme: string;
};

export type SkillVersionFileDiff = {
  path: string;
  status: 'added' | 'modified' | 'deleted' | string;
  binary: boolean;
  baseContent?: string;
  targetContent?: string;
};

export type SkillVersionComparison = {
  identity: SkillIdentity;
  baseVersion: string;
  targetVersion: string;
  files: SkillVersionFileDiff[];
};

export type SkillOperation = {
  identity: SkillIdentity;
  version: string;
};

export type UpdateSkillPreferences = SkillPreferences;

/** Compact runtime shape used by assistant and conversation selectors. */
export type SkillWorkspace = {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  categories: string[];
  preferences: SkillPreferences;
};

export const toAvailableSkill = (item: SkillCatalogItem): SkillWorkspace => ({
  id: skillIdentityKey(item.identity),
  slug: item.identity.slug,
  name: item.name,
  description: item.description,
  version: item.preferences.selectedVersion ?? item.latestVersion,
  categories: item.categories,
  preferences: item.preferences,
});
