import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const scriptPath = 'resources/windows/support/verify-bundled-tjuaecore-install.ps1';
const script = readFileSync(scriptPath, 'utf8');

function writeFile(filePath: string, contents = 'x') {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function writeJson(filePath: string, value: unknown) {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

describe('Windows bundled tjuaecore install verifier', () => {
  it('enforces the node-only v3 contract and rejects bundled third-party CLIs', () => {
    expect(script).toContain("Join-Path $managedRoot 'manifest.json'");
    expect(script).toContain('[double]$contract.schemaVersion -ne 3');
    expect(script).toContain('forbidden_bundled_dependency');
    expect(script).not.toContain('missing_required_cli');
    expect(script).not.toContain('2.1.215');
    expect(script).not.toContain('0.144.6');
  });

  it('keeps machine-readable failure logging', () => {
    expect(script).toContain('unsupported_schema_version');
    expect(script).toContain('invalid_schema');
    expect(script).toContain('result=fail runtime=$RuntimeKey failures=$summary');
  });

  const runOnWindows = process.platform === 'win32' ? it : it.skip;

  runOnWindows('fails an install containing a third-party CLI payload', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'tjuaeui-install-verify-'));
    const installDir = join(tmp, 'install');
    const base = join(installDir, 'resources', 'bundled-tjuaecore', 'win32-x64');
    const managedRoot = join(base, 'managed-resources');
    const logPath = join(tmp, 'verify.log');
    try {
      writeFile(join(base, 'tjuaecore.exe'));
      writeJson(join(base, 'manifest.json'), { platform: 'win32', arch: 'x64' });
      writeFile(join(managedRoot, 'node', 'node-v24.11.0-win-x64', 'node.exe'));
      writeFile(join(managedRoot, 'cli', 'codex', 'codex.exe'));
      writeJson(join(managedRoot, 'manifest.json'), {
        schemaVersion: 3,
        runtimeKey: 'win32-x64',
        node: {
          version: '24.11.0',
          root: 'node/node-v24.11.0-win-x64',
          executable: 'node.exe',
        },
      });

      const result = spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath,
          '-InstallDir',
          installDir,
          '-RuntimeKey',
          'win32-x64',
          '-LogPath',
          logPath,
        ],
        { encoding: 'utf8' }
      );

      expect(result.status).not.toBe(0);
      expect(readFileSync(logPath, 'utf8')).toContain('forbidden_bundled_dependency');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
