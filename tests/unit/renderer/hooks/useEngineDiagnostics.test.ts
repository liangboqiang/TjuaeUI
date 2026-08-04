/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeStart, mutate, refreshCatalog, listeners } = vi.hoisted(() => ({
  invokeStart: vi.fn().mockResolvedValue({
    run_id: 'startup-run',
    trigger: 'startup',
    state: 'running',
    total: 2,
    completed: 0,
    online: 0,
    needs_attention: 0,
    missing: 0,
    started_at: 1,
  }),
  mutate: vi.fn(),
  refreshCatalog: vi.fn(),
  listeners: [] as Array<(payload: unknown) => void>,
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    acpConversation: {
      startEngineDiagnostics: { invoke: invokeStart },
      getCurrentEngineDiagnostics: { invoke: vi.fn().mockResolvedValue(null) },
      diagnosticsChanged: {
        on: (listener: (payload: unknown) => void) => {
          listeners.push(listener);
          return vi.fn();
        },
      },
    },
  },
}));

vi.mock('swr', () => ({ mutate }));
vi.mock('@/renderer/hooks/agent/useManagedEngines', () => ({
  refreshManagedEngineCatalogAndAssistants: refreshCatalog,
}));

import { ensureStartupEngineDiagnostics } from '@/renderer/hooks/agent/useEngineDiagnostics';
import { MANAGED_ENGINES_SWR_KEY } from '@/renderer/utils/model/agentTypes';

describe('startup engine diagnostics', () => {
  beforeEach(() => {
    invokeStart.mockClear();
    mutate.mockClear();
    refreshCatalog.mockClear();
  });

  it('starts once and keeps model/catalog caches synchronized outside the settings page', async () => {
    ensureStartupEngineDiagnostics();
    ensureStartupEngineDiagnostics();

    expect(invokeStart).toHaveBeenCalledTimes(1);
    expect(invokeStart).toHaveBeenCalledWith({ trigger: 'startup' });
    expect(listeners).toHaveLength(1);

    listeners[0]?.({
      agent: {
        id: 'codex',
        name: 'Codex',
        agent_type: 'acp',
        agent_source: 'builtin',
        enabled: true,
        installed: true,
        status: 'online',
      },
      run: {
        run_id: 'startup-run',
        trigger: 'startup',
        state: 'completed',
        total: 2,
        completed: 2,
        online: 1,
        needs_attention: 1,
        missing: 0,
        started_at: 1,
        finished_at: 2,
      },
    });

    expect(mutate).toHaveBeenCalledWith(MANAGED_ENGINES_SWR_KEY, expect.any(Function), { revalidate: false });
    expect(refreshCatalog).toHaveBeenCalledTimes(1);
  });
});
