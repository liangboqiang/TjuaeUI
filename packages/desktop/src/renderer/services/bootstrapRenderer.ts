import { configService } from '@/common/config/configService';

type BootstrapLogger = (message?: unknown, ...optionalParams: unknown[]) => void;

/**
 * Wait for renderer config initialization without coupling app bootstrap to
 * business data prefetches such as `/api/agents`.
 */
export async function bootstrapRendererConfig(logError: BootstrapLogger = console.error): Promise<void> {
  await configService.initialize().catch((err) => {
    logError('Failed to initialize config:', err);
  });
}
