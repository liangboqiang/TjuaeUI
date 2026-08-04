import { isBackendHttpError } from '@/common/adapter/httpBridge';
import type { TFunction } from 'i18next';

const ASSET_ERROR_KEYS: Readonly<Record<string, string>> = {
  ASSET_CONCURRENT_MODIFICATION: 'settings.assetWorkbench.concurrentModification',
  ASSET_SOURCE_UNAVAILABLE: 'settings.assetWorkbench.sourceUnavailableDescription',
  ASSET_BASE_MISSING: 'settings.assetWorkbench.sourceUnavailableDescription',
  ASSET_MERGE_CONFLICT: 'settings.assetWorkbench.resolve.autoMergeBlocked',
  ASSET_DESTRUCTIVE_CONFIRMATION_REQUIRED: 'settings.assetWorkbench.resolve.confirmRemoteDescription',
  MARKET_NOT_READY: 'settings.assetWorkbench.remoteUnavailable',
  MARKET_UNAVAILABLE: 'settings.assetWorkbench.remoteUnavailable',
  MARKET_UPSTREAM_UNAVAILABLE: 'settings.assetWorkbench.remoteUnavailable',
  RUNTIME_ENGINE_ADAPTER_UNSUPPORTED: 'settings.assetWorkbench.incompatible',
  RUNTIME_MCP_UNSUPPORTED: 'settings.assetWorkbench.incompatible',
};

/**
 * Asset surfaces deliberately localize stable backend codes and never expose
 * backend/native exception text. Besides preventing English-only UI, this
 * keeps paths, transport details, and other diagnostic data out of notices.
 */
export const localizeAssetError = (t: TFunction, error: unknown, fallbackKey: string): string => {
  if (isBackendHttpError(error)) {
    const key = ASSET_ERROR_KEYS[error.code];
    if (key) return t(key);
  }
  return t(fallbackKey);
};
