export type SkillPreferences = {
  enabled: boolean;
  autoInject: boolean;
};

export type SkillSource =
  | { kind: 'local' }
  | {
      kind: 'market';
      marketId: string;
      repository: string;
      path: string;
      revision?: string;
    };

/** The only installed skill entity: one editable local Git workspace. */
export type SkillWorkspace = {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  path: string;
  source: SkillSource;
  categories: string[];
  preferences: SkillPreferences;
  gitStatus: 'clean' | 'modified' | 'conflicted' | 'unknown';
};

export type MarketInfo = {
  id: string;
  name: string;
  repository: string;
  revision: string;
};

export type MarketSyncState = 'notInstalled' | 'synced' | 'localChanged' | 'updateAvailable' | 'diverged';

/** A read-only static index entry. It becomes a SkillWorkspace only after installation. */
export type MarketSkill = {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  path: string;
  digest: string;
  categories: string[];
  market: MarketInfo;
  installed: boolean;
  installedVersion?: string;
  syncState: MarketSyncState;
};

export type MarketFileComparison = {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  binary: boolean;
  localContent?: string;
  remoteContent?: string;
};

export type MarketSkillComparison = {
  slug: string;
  baseRevision: string;
  remoteRevision: string;
  syncState: MarketSyncState;
  files: MarketFileComparison[];
};

export type PublishMarketSkillResult = {
  branch: string;
  commit: string;
  compareUrl: string;
};

export type UpdateSkillPreferences = SkillPreferences;
