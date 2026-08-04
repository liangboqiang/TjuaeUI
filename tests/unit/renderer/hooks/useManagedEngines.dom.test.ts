/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for renderer/hooks/agent/useManagedEngines.ts.
 *
 * The Engine settings management surface must read the
 * dedicated management view (a separate SWR key from assistant business data).
 * cache). Diagnostics-only actions can refresh the management cache only;
 * catalog-changing actions that affect generated assistants must also
 * invalidate assistant list caches.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('swr', () => ({
  default: vi.fn(() => ({ data: [], error: null, isLoading: false })),
  mutate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/renderer/utils/model/agentTypes', () => ({
  MANAGED_ENGINES_SWR_KEY: 'engines.managed',
  fetchManagedEngines: vi.fn(),
}));

import { getManagedEngines, useManagedEngines } from '@/renderer/hooks/agent/useManagedEngines';
import useSWR, { mutate } from 'swr';
import { fetchManagedEngines } from '@/renderer/utils/model/agentTypes';
import type { ManagedAgent } from '@/renderer/utils/model/agentTypes';

const mockSWRResult = (value: {
  data: ManagedAgent[] | undefined;
  error: unknown;
  isLoading: boolean;
  isValidating?: boolean;
}) => {
  const swrMock = useSWR as unknown as { mockReturnValue: (next: unknown) => void };
  swrMock.mockReturnValue({ isValidating: false, ...value });
};

describe('useManagedEngines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to the management SWR key with the managed fetcher', () => {
    mockSWRResult({ data: [], error: null, isLoading: false });

    renderHook(() => useManagedEngines());

    expect(useSWR).toHaveBeenCalledWith('engines.managed', fetchManagedEngines);
  });

  it('exposes the engines returned by SWR', () => {
    const engines: ManagedAgent[] = [
      {
        id: 'x',
        name: 'X',
        agent_type: 'acp',
        agent_source: 'custom',
        enabled: false,
        installed: false,
        status: 'unchecked',
        sort_order: 100,
      },
    ];
    mockSWRResult({ data: engines, error: null, isLoading: false });

    const { result } = renderHook(() => useManagedEngines());

    expect(result.current.engines).toEqual(engines);
  });

  it('falls back to an empty list when SWR has no data yet', () => {
    mockSWRResult({ data: undefined, error: null, isLoading: true });

    const { result } = renderHook(() => useManagedEngines());

    expect(result.current.engines).toEqual([]);
  });

  it('revalidate refreshes only the management key', async () => {
    mockSWRResult({ data: [], error: null, isLoading: false });

    const { result } = renderHook(() => useManagedEngines());

    await act(async () => {
      await result.current.revalidate();
    });

    expect(mutate).toHaveBeenCalledWith('engines.managed');
    expect(mutate).not.toHaveBeenCalledWith('agents.detected');
  });

  it('refreshCatalog refreshes the management key and assistant list caches', async () => {
    mockSWRResult({ data: [], error: null, isLoading: false });

    const { result } = renderHook(() => useManagedEngines());

    await act(async () => {
      await result.current.refreshCatalog();
    });

    expect(mutate).toHaveBeenCalledWith('engines.managed');
    expect(mutate).toHaveBeenCalledWith('assistants.list');
    expect(mutate).toHaveBeenCalledWith('assistants');
  });

  it('getManagedEngines fetches the management catalog without invalidating the detected cache', async () => {
    const managedAgents: ManagedAgent[] = [
      {
        id: 'managed-1',
        name: 'Managed Agent',
        agent_type: 'acp',
        agent_source: 'builtin',
        enabled: true,
        installed: true,
        status: 'online',
        sort_order: 100,
      },
    ];
    vi.mocked(fetchManagedEngines).mockResolvedValue(managedAgents);

    const result = await getManagedEngines();

    expect(fetchManagedEngines).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith('engines.managed', managedAgents, { revalidate: false });
    expect(mutate).not.toHaveBeenCalledWith('agents.detected');
    expect(result).toEqual(managedAgents);
  });
});
