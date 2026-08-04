/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for renderer/utils/model/agentTypes.ts → fetchManagedEngines.
 * The settings management fetcher must hit the dedicated `getManagedEngines`
 * bridge (`/api/engines/management`) and degrade to [] on failure.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/common', () => ({
  ipcBridge: {
    acpConversation: {
      getManagedEngines: { invoke: vi.fn() },
    },
  },
}));

import { fetchManagedEngines } from '@/renderer/utils/model/agentTypes';
import { ipcBridge } from '@/common';

describe('fetchManagedEngines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns rows from the include_disabled (managed) bridge', async () => {
    const rows = [{ id: 'd', name: 'D', agent_type: 'acp', agent_source: 'custom', enabled: false, available: false }];
    (ipcBridge.acpConversation.getManagedEngines.invoke as any).mockResolvedValue(rows);

    await expect(fetchManagedEngines()).resolves.toEqual(rows);
    expect(ipcBridge.acpConversation.getManagedEngines.invoke).toHaveBeenCalledTimes(1);
  });

  it('returns [] when the bridge rejects', async () => {
    (ipcBridge.acpConversation.getManagedEngines.invoke as any).mockRejectedValue(new Error('boom'));

    await expect(fetchManagedEngines()).resolves.toEqual([]);
  });

  it('returns [] when the bridge yields a non-array', async () => {
    (ipcBridge.acpConversation.getManagedEngines.invoke as any).mockResolvedValue(undefined);

    await expect(fetchManagedEngines()).resolves.toEqual([]);
  });
});
