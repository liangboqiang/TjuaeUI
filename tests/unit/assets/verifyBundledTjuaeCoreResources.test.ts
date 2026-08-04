import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const {
  verifyBundledTjuaeCoreResources,
} = require('../../../packages/shared-scripts/src/verify-bundled-tjuaecore-resources');

function writeFile(filePath: string, contents = 'x') {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, { flush: true });
}

function writeJson(filePath: string, value: unknown) {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function seedBundle(resourcesDir: string) {
  const base = join(resourcesDir, 'bundled-tjuaecore', 'win32-x64');
  const managed = join(base, 'managed-resources');
  writeFile(join(base, 'tjuaecore.exe'));
  writeJson(join(base, 'manifest.json'), { platform: 'win32', arch: 'x64' });
  writeFile(join(managed, 'node', 'node-v24.11.0-win-x64', 'node.exe'));
  writeJson(join(managed, 'manifest.json'), {
    schemaVersion: 3,
    runtimeKey: 'win32-x64',
    node: {
      version: '24.11.0',
      root: 'node/node-v24.11.0-win-x64',
      executable: 'node.exe',
    },
  });
  return managed;
}

describe('verifyBundledTjuaeCoreResources', () => {
  let tmp: string;
  let resourcesDir: string;
  let managedResourcesDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'tjuaeui-bundled-resources-'));
    resourcesDir = join(tmp, 'resources');
    managedResourcesDir = seedBundle(resourcesDir);
  });

  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  function verify() {
    return verifyBundledTjuaeCoreResources({
      resourcesDir,
      electronPlatformName: 'win32',
      targetArch: 'x64',
    });
  }

  it('accepts the node-only managed-resources v3 contract', () => {
    const result = verify();
    expect(result.missing).toEqual([]);
    expect(result.failures).toEqual([]);
  });

  it('rejects every bundled third-party CLI directory', () => {
    writeFile(join(managedResourcesDir, 'cli', 'codex', '0.144.6', 'win32-x64', 'codex.exe'));
    const result = verify();
    expect(result.failures).toContainEqual(
      expect.objectContaining({
        component: 'third-party-cli',
        reason: 'forbidden_bundled_dependency',
      })
    );
  });

  it('rejects legacy contracts that declare CLI payloads', () => {
    writeJson(join(managedResourcesDir, 'manifest.json'), {
      schemaVersion: 3,
      runtimeKey: 'win32-x64',
      node: {
        version: '24.11.0',
        root: 'node/node-v24.11.0-win-x64',
        executable: 'node.exe',
      },
      clis: [],
    });
    expect(verify().failures).toContainEqual(expect.objectContaining({ reason: 'invalid_schema' }));
  });

  it('rejects unsupported schema versions', () => {
    writeJson(join(managedResourcesDir, 'manifest.json'), {
      schemaVersion: 2,
      runtimeKey: 'win32-x64',
      node: {
        version: '24.11.0',
        root: 'node/node-v24.11.0-win-x64',
        executable: 'node.exe',
      },
    });
    expect(verify().failures).toContainEqual(expect.objectContaining({ reason: 'unsupported_schema_version' }));
  });

  it('reports a missing managed Node executable', () => {
    rmSync(join(managedResourcesDir, 'node', 'node-v24.11.0-win-x64', 'node.exe'));
    const result = verify();
    expect(result.failures).toContainEqual(
      expect.objectContaining({ component: 'managed-node', reason: 'missing_file' })
    );
  });

  it('rejects runtime-key mismatches', () => {
    writeJson(join(managedResourcesDir, 'manifest.json'), {
      schemaVersion: 3,
      runtimeKey: 'linux-x64',
      node: {
        version: '24.11.0',
        root: 'node/node-v24.11.0-win-x64',
        executable: 'node.exe',
      },
    });
    expect(verify().failures).toContainEqual(expect.objectContaining({ reason: 'runtime_key_mismatch' }));
  });
});
