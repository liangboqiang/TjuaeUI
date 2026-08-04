/**
 * @vitest-environment node
 */

import type { EngineAdapterDefinition, McpDefinition } from '@/common/types/agent/assets';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readFixture = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/asset-contract/${name}`, import.meta.url)), 'utf8')) as T;

const engine = readFixture<EngineAdapterDefinition>('engine-adapter-definition.v1.complete.json');
const mcp = readFixture<McpDefinition>('mcp-definition.v1.complete.json');

describe('typed asset Definition contract', () => {
  it('matches the fixed Hub engine-adapter fixture and its portable identity', () => {
    expect(engine).toMatchObject({
      schemaVersion: 1,
      kind: 'engineAdapter',
      id: 'contract-acp',
      runtimeId: 'contract-acp',
      protocol: { type: 'acp', transport: 'stdio' },
      runtime: { commandName: 'contract-acp' },
    });
    expect(engine.id).toBe(engine.runtimeId);
    expect(engine.runtime).toEqual({ commandName: 'contract-acp' });
  });

  it('matches the fixed Hub MCP fixture and the closed transport vocabulary', () => {
    expect(mcp).toMatchObject({
      schemaVersion: 1,
      kind: 'mcp',
      id: 'contract-mcp',
      runtimeId: 'contract-mcp',
      transport: { type: 'stdio' },
    });
    expect(['stdio', 'sse', 'streamableHttp']).toContain(mcp.transport.type);
    expect(mcp.id).toBe(mcp.runtimeId);
  });

  it('requires every low-code field to declare its real runtime injection target', () => {
    expect(engine.configurationSchema?.fields.length).toBeGreaterThan(0);
    expect(mcp.configurationSchema?.fields.length).toBeGreaterThan(0);
    expect(engine.configurationSchema?.fields.every((field) => field.binding.target === 'environment')).toBe(true);
    expect(mcp.configurationSchema?.fields.every((field) => field.binding.target === 'environment')).toBe(true);
    for (const field of [...(engine.configurationSchema?.fields ?? []), ...(mcp.configurationSchema?.fields ?? [])]) {
      expect(field.binding.name).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/u);
    }
  });

  it('contains no private Overlay values in either shareable Definition fixture', () => {
    const serialized = JSON.stringify([engine, mcp]);
    for (const forbidden of [
      '"secretSlot"',
      '"secretUpdates"',
      '"values"',
      '"secrets"',
      '"executablePath"',
      '"instanceUrl"',
      'C:\\\\',
      '/Users/',
      '/home/',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
