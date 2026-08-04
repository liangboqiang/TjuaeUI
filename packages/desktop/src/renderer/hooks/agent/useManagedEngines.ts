/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ManagedEngine } from '@/renderer/utils/model/agentTypes';
import { MANAGED_ENGINES_SWR_KEY, fetchManagedEngines } from '@/renderer/utils/model/agentTypes';
import useSWR, { mutate } from 'swr';

export type UseManagedEnginesResult = {
  engines: ManagedEngine[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: unknown;
  revalidate: () => Promise<ManagedEngine[] | undefined>;
  refreshCatalog: () => Promise<ManagedEngine[] | undefined>;
};

export async function refreshManagedEngineCatalogAndAssistants(): Promise<ManagedEngine[] | undefined> {
  const [engines] = await Promise.all([
    mutate<ManagedEngine[]>(MANAGED_ENGINES_SWR_KEY),
    mutate('assistants.list'),
    mutate('assistants'),
  ]);
  return engines;
}

/**
 * Hook for the Engine settings management surface only. Reads the dedicated
 * `/api/engines/management` diagnostics view (`MANAGED_ENGINES_SWR_KEY`) so
 * user-disabled and missing candidates remain available to diagnostics.
 * `EnginesPage` applies the management visibility policy separately so
 * uninstalled automatic candidates do not become rows in the main list.
 *
 * `revalidate` refreshes only the management key. It is the right action for
 * diagnostics-only changes that should not invalidate the
 * shared engine catalog.
 *
 * `refreshCatalog` refreshes the management catalog plus assistant list caches
 * after structural or diagnostic changes that can affect generated assistants.
 * Business assistant pickers must not depend on this hook or on `/api/engines`.
 *
 * Do not use this anywhere other than `EngineSettings`.
 */
export const useManagedEngines = (): UseManagedEnginesResult => {
  const { data, isLoading, isValidating, error } = useSWR<ManagedEngine[]>(
    MANAGED_ENGINES_SWR_KEY,
    fetchManagedEngines
  );

  const revalidateManaged = () => mutate<ManagedEngine[]>(MANAGED_ENGINES_SWR_KEY);

  return {
    engines: data ?? [],
    isLoading,
    isRefreshing: isValidating && !isLoading,
    error,
    revalidate: revalidateManaged,
    refreshCatalog: refreshManagedEngineCatalogAndAssistants,
  };
};

/**
 * Lightweight runtime catalog read model for assistant-bound engine rows.
 * Uses the same `/api/engines/management` payload because that endpoint is
 * backed by `agent_metadata`, where ACP catalog snapshots are persisted.
 */
export const useManagedEngineRuntimeCatalog = (): ManagedEngine[] => {
  const { data } = useSWR<ManagedEngine[]>(MANAGED_ENGINES_SWR_KEY, fetchManagedEngines);
  return data ?? [];
};

/**
 * Non-hook entry point for settings/tooling surfaces that need the management
 * diagnostics catalog rather than the business-facing assistant list.
 * Writes the result into the shared management cache only. Callers that
 * actually mutate the engine directory should invalidate the engine
 * cache separately.
 */
export async function getManagedEngines(): Promise<ManagedEngine[]> {
  const data = await fetchManagedEngines();
  await mutate(MANAGED_ENGINES_SWR_KEY, data, { revalidate: false });
  return data;
}
