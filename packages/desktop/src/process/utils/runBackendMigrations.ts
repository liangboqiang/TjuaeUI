/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { migrateConfigStorage, migrateProviders } from '@/common/config/configMigration';
import { type ProcessConfig as ProcessConfigType } from './initStorage';

type ConfigFile = typeof ProcessConfigType;
type MigrationStepResult = boolean;

const MIGRATION_STEPS: Array<{
  name: string;
  run: (configFile: ConfigFile) => Promise<MigrationStepResult>;
}> = [
  { name: 'migrateConfigStorage', run: async (configFile) => (await migrateConfigStorage(configFile), true) },
  { name: 'migrateProviders', run: async (configFile) => (await migrateProviders(configFile), true) },
];

/**
 * Runs the remaining non-asset settings migrations.
 *
 * Asset installation and official catalog seeding deliberately do not happen
 * here. Four-kind assets are owned by TjuaeCore and TjuaeHub; startup must not
 * synthesize MCP rows, copy secrets, or create a second official asset source.
 */
export async function runBackendMigrations(configFile: ConfigFile): Promise<void> {
  await MIGRATION_STEPS.reduce<Promise<void>>(async (previous, step) => {
    await previous;
    const start = Date.now();
    try {
      const completed = await step.run(configFile);
      const elapsed = Date.now() - start;
      if (!completed) {
        console.warn(`[TjuaeUI] Backend migration step incomplete: ${step.name} (${elapsed}ms)`);
        return;
      }
      console.info(`[TjuaeUI] Backend migration step completed: ${step.name} (${elapsed}ms)`);
    } catch (error) {
      const elapsed = Date.now() - start;
      console.error(`[TjuaeUI] Backend migration step failed: ${step.name} (${elapsed}ms)`, error);
    }
  }, Promise.resolve());
}
