import { getPlatformServices } from '@/common/platform';

/**
 * Returns baseName unchanged in release builds, or baseName + '-dev' in dev builds.
 * When TJUAEUI_MULTI_INSTANCE=1, appends '-2' to isolate the second dev instance.
 * Used to isolate symlink and directory names between environments.
 *
 * @example
 * getEnvAwareName('.tjuaeui')        // release → '.tjuaeui',        dev → '.tjuaeui-dev'
 * getEnvAwareName('.tjuaeui-config') // release → '.tjuaeui-config', dev → '.tjuaeui-config-dev'
 * // with TJUAEUI_MULTI_INSTANCE=1:  dev → '.tjuaeui-dev-2'
 */
export function getEnvAwareName(baseName: string): string {
  if (getPlatformServices().paths.isPackaged() === true) return baseName;
  const suffix = process.env.TJUAEUI_MULTI_INSTANCE === '1' ? '-dev-2' : '-dev';
  return `${baseName}${suffix}`;
}
