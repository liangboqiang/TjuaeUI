/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runBackendMigrations } from '@/process/utils/runBackendMigrations';
import { migrateConfigStorage, migrateProviders } from '@/common/config/configMigration';

vi.mock('@/common/config/configMigration', () => ({
  migrateConfigStorage: vi.fn().mockResolvedValue(undefined),
  migrateProviders: vi.fn().mockResolvedValue(undefined),
}));

const configFile = {
  get: vi.fn(),
  set: vi.fn(),
};

describe('runBackendMigrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs only non-asset settings migrations in a stable order', async () => {
    const order: string[] = [];
    vi.mocked(migrateConfigStorage).mockImplementation(async () => {
      order.push('config');
    });
    vi.mocked(migrateProviders).mockImplementation(async () => {
      order.push('providers');
    });

    await runBackendMigrations(configFile as never);

    expect(order).toEqual(['config', 'providers']);
  });

  it('continues to the next independent settings migration after a failure', async () => {
    vi.mocked(migrateConfigStorage).mockRejectedValueOnce(new Error('config failed'));

    await expect(runBackendMigrations(configFile as never)).resolves.toBeUndefined();

    expect(migrateProviders).toHaveBeenCalledOnce();
  });
});
