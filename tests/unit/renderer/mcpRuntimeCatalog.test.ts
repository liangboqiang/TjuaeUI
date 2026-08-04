/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mcpServiceMock } = vi.hoisted(() => ({
  mcpServiceMock: {
    listServers: { invoke: vi.fn() },
  },
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  mcpService: mcpServiceMock,
}));

import { loadRuntimeMcpCatalog } from '@/renderer/services/mcpRuntimeCatalog';

describe('loadRuntimeMcpCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mcpServiceMock.listServers.invoke.mockResolvedValue([
      {
        id: 'mcp:projected',
        name: 'Projector managed server',
        enabled: true,
        transport: { type: 'stdio', command: 'projected', args: [] },
        created_at: 2,
        updated_at: 2,
        original_json: '{}',
        builtin: false,
      },
    ]);
  });

  it('returns only the Core runtime projection catalog', async () => {
    const result = await loadRuntimeMcpCatalog();

    expect(result.map((server) => server.id)).toEqual(['mcp:projected']);
  });

  it('deduplicates repeated projection rows by stable runtime id', async () => {
    const server = {
      id: 'mcp:projected',
      name: 'Projector managed server',
      enabled: true,
      transport: { type: 'stdio', command: 'projected', args: [] },
      created_at: 2,
      updated_at: 2,
      original_json: '{}',
      builtin: false,
    };
    mcpServiceMock.listServers.invoke.mockResolvedValue([server, server]);

    const result = await loadRuntimeMcpCatalog();

    expect(result).toHaveLength(1);
  });

  it('propagates a Core catalog failure instead of falling back to client settings', async () => {
    mcpServiceMock.listServers.invoke.mockRejectedValue(new Error('Core unavailable'));

    await expect(loadRuntimeMcpCatalog()).rejects.toThrow('Core unavailable');
  });
});
