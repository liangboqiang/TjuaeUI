import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface NativeModuleTools {
  resolveToolEntry(projectRoot: string, toolName: string): string;
  runCli(argv?: string[]): number;
}

const require = createRequire(import.meta.url);
const tools = require('../../../scripts/rebuildNativeModules.js') as NativeModuleTools;
const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

describe('原生模块确定性工具链', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['prebuild-install', 'electron-rebuild'])('从项目依赖中解析 %s', (toolName) => {
    const entry = tools.resolveToolEntry(repositoryRoot, toolName);

    expect(fs.existsSync(entry)).toBe(true);
    expect(entry).toContain('node_modules');
  });

  it('缺少必要参数时拒绝执行', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(tools.runCli([])).toBe(2);
  });
});
