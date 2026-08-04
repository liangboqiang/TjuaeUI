import type {
  AssetDetail,
  AssetFileEntry,
  AssetKind,
  AssetRuntimeState,
  AssetSyncState,
  MarketAsset,
  MarketAssetFile,
  MarketPresenceState,
} from '@/common/types/agent/assets';
import {
  Attention,
  BranchOne,
  CheckOne,
  Download,
  Edit,
  Error,
  Lightning,
  People,
  Puzzle,
  Refresh,
  Speed,
} from '@icon-park/react';
import React from 'react';

export const ASSET_KINDS: ReadonlyArray<{
  kind: AssetKind;
  labelKey: string;
  icon: React.ReactElement;
}> = [
  {
    kind: 'assistant',
    labelKey: 'settings.assetWorkbench.kinds.assistant',
    icon: <People size='14' aria-hidden='true' />,
  },
  {
    kind: 'engineAdapter',
    labelKey: 'settings.assetWorkbench.kinds.engineAdapter',
    icon: <Speed size='14' aria-hidden='true' />,
  },
  { kind: 'skill', labelKey: 'settings.assetWorkbench.kinds.skill', icon: <Lightning size='14' aria-hidden='true' /> },
  { kind: 'mcp', labelKey: 'settings.assetWorkbench.kinds.mcp', icon: <Puzzle size='14' aria-hidden='true' /> },
];

const SYNC_STATE_PRESENTATION: Record<
  AssetSyncState,
  { labelKey: string; className: string; icon: React.ReactElement }
> = {
  synced: {
    labelKey: 'settings.assetWorkbench.syncStates.synced',
    className: 'text-success-6',
    icon: <CheckOne size='16' aria-hidden='true' />,
  },
  localModified: {
    labelKey: 'settings.assetWorkbench.syncStates.localModified',
    className: 'text-warning-6',
    icon: <Edit size='16' aria-hidden='true' />,
  },
  remoteUpdated: {
    labelKey: 'settings.assetWorkbench.syncStates.remoteUpdated',
    className: 'text-primary-6',
    icon: <Download size='16' aria-hidden='true' />,
  },
  diverged: {
    labelKey: 'settings.assetWorkbench.syncStates.diverged',
    className: 'text-warning-6',
    icon: <BranchOne size='16' aria-hidden='true' />,
  },
  conflict: {
    labelKey: 'settings.assetWorkbench.syncStates.conflict',
    className: 'text-danger-6',
    icon: <Error size='16' aria-hidden='true' />,
  },
  upstreamRemoved: {
    labelKey: 'settings.assetWorkbench.syncStates.upstreamRemoved',
    className: 'text-danger-6',
    icon: <Attention size='16' aria-hidden='true' />,
  },
  incompatible: {
    labelKey: 'settings.assetWorkbench.syncStates.incompatible',
    className: 'text-danger-6',
    icon: <Attention size='16' aria-hidden='true' />,
  },
  revoked: {
    labelKey: 'settings.assetWorkbench.syncStates.revoked',
    className: 'text-danger-6',
    icon: <Error size='16' aria-hidden='true' />,
  },
  remoteUnknown: {
    labelKey: 'settings.assetWorkbench.syncStates.remoteUnknown',
    className: 'text-t-tertiary',
    icon: <Attention size='16' aria-hidden='true' />,
  },
};

const DETACHED_PRESENTATION = {
  labelKey: 'settings.assetWorkbench.trackingStates.detached',
  className: 'text-t-secondary',
  icon: <Edit size='16' aria-hidden='true' />,
};

const PRESENCE_STATE_PRESENTATION: Record<
  MarketPresenceState,
  { labelKey: string; className: string; icon: React.ReactElement }
> = {
  notInstalled: {
    labelKey: 'settings.assetWorkbench.presenceStates.notInstalled',
    className: 'text-primary-6',
    icon: <Download size='16' aria-hidden='true' />,
  },
  installed: {
    labelKey: 'settings.assetWorkbench.presenceStates.installed',
    className: 'text-success-6',
    icon: <CheckOne size='16' aria-hidden='true' />,
  },
};

const RUNTIME_STATE_PRESENTATION: Record<
  AssetRuntimeState,
  { labelKey: string; className: string; icon: React.ReactElement }
> = {
  notConfigured: {
    labelKey: 'settings.assetRuntime.states.notConfigured',
    className: 'text-t-tertiary',
    icon: <Attention size='16' aria-hidden='true' />,
  },
  inactive: {
    labelKey: 'settings.assetRuntime.states.inactive',
    className: 'text-t-secondary',
    icon: <Lightning size='16' aria-hidden='true' />,
  },
  activating: {
    labelKey: 'settings.assetRuntime.states.activating',
    className: 'text-primary-6',
    icon: <Refresh size='16' aria-hidden='true' />,
  },
  active: {
    labelKey: 'settings.assetRuntime.states.active',
    className: 'text-success-6',
    icon: <CheckOne size='16' aria-hidden='true' />,
  },
  degraded: {
    labelKey: 'settings.assetRuntime.states.degraded',
    className: 'text-warning-6',
    icon: <Attention size='16' aria-hidden='true' />,
  },
  needsRepair: {
    labelKey: 'settings.assetRuntime.states.needsRepair',
    className: 'text-danger-6',
    icon: <Error size='16' aria-hidden='true' />,
  },
};

/**
 * 本地原创或已解除跟踪的资产没有同步状态。为旧的本地工作台调用点
 * 返回“未跟踪”展示，但绝不把它伪造成一种 AssetSyncState。
 */
export const getSyncStatePresentation = (state?: AssetSyncState) =>
  state ? SYNC_STATE_PRESENTATION[state] : DETACHED_PRESENTATION;

export const getMarketSyncState = (asset: MarketAsset): AssetSyncState | undefined => asset.syncState;

export const getMarketStatusPresentation = (asset: MarketAsset) =>
  asset.syncState ? SYNC_STATE_PRESENTATION[asset.syncState] : PRESENCE_STATE_PRESENTATION[asset.presenceState];

export const getRuntimeStatePresentation = (state: AssetRuntimeState) => RUNTIME_STATE_PRESENTATION[state];

export const resolveDefaultAssetFile = (detail: AssetDetail): AssetFileEntry | undefined => {
  if (detail.kind === 'skill') {
    const skillEntry = detail.files.find((file) => file.path.split('/').at(-1)?.toUpperCase() === 'SKILL.MD');
    if (skillEntry) return skillEntry;
  }

  if (detail.entryFile) {
    const declaredEntry = detail.files.find((file) => file.path === detail.entryFile);
    if (declaredEntry) return declaredEntry;
  }

  return detail.files.find((file) => file.text) ?? detail.files[0];
};

export const resolveDefaultMarketAssetFile = (asset: MarketAsset): MarketAssetFile | undefined => {
  if (asset.kind === 'skill') {
    const skillEntry = asset.files.find((file) => file.path.split('/').at(-1)?.toUpperCase() === 'SKILL.MD');
    if (skillEntry) return skillEntry;
  }

  return asset.files.find((file) => file.path === asset.entryFile) ?? asset.files[0];
};

export const isMarkdownFile = (file?: Pick<AssetFileEntry, 'path' | 'mediaType'>): boolean =>
  Boolean(file && (file.mediaType.includes('markdown') || /\.md(?:own)?$/i.test(file.path)));

export const formatAssetFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
