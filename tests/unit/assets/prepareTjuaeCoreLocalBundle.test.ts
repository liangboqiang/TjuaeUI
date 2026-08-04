import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const {
  canReuseTjuaeCoreCache,
  prepareTjuaeCore,
  resolveTjuaeCorePreparationPolicy,
} = require('../../../packages/shared-scripts/src/prepare-tjuaecore');

afterEach(() => {
  delete process.env.TJUAEUI_BACKEND_BUILD_MODE;
  delete process.env.TJUAEUI_BACKEND_LOCAL_BINARY;
  delete process.env.TJUAEUI_BACKEND_LOCAL_BUNDLE_DIR;
});

describe('prepare-tjuaecore local bundle input', () => {
  it('hard fails local bundle input that lacks managed-resources manifest', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'tjuaeui-local-bundle-'));
    const projectRoot = join(tmp, 'project');
    const localBundle = join(tmp, 'bundle');
    mkdirSync(join(localBundle, 'managed-resources'), { recursive: true });
    writeFileSync(join(localBundle, 'tjuaecore.exe'), '');

    const previous = process.env.TJUAEUI_BACKEND_LOCAL_BUNDLE_DIR;
    process.env.TJUAEUI_BACKEND_LOCAL_BUNDLE_DIR = localBundle;
    try {
      expect(() =>
        prepareTjuaeCore({
          projectRoot,
          platform: 'win32',
          arch: 'x64',
          version: 'v0.1.46',
        })
      ).toThrow(/managed-resources\/manifest\.json/);
    } finally {
      if (previous === undefined) delete process.env.TJUAEUI_BACKEND_LOCAL_BUNDLE_DIR;
      else process.env.TJUAEUI_BACKEND_LOCAL_BUNDLE_DIR = previous;
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('正式构建拒绝本地资源包和本地二进制来源', () => {
    expect(() =>
      resolveTjuaeCorePreparationPolicy({
        TJUAEUI_BACKEND_BUILD_MODE: 'production',
        TJUAEUI_BACKEND_LOCAL_BUNDLE_DIR: 'C:\\tmp\\local-core',
      })
    ).toThrow(/正式构建禁止使用本地 TjuaeCore/);

    expect(() =>
      resolveTjuaeCorePreparationPolicy({
        TJUAEUI_BACKEND_BUILD_MODE: 'production',
        TJUAEUI_BACKEND_LOCAL_BINARY: 'C:\\tmp\\tjuaecore.exe',
      })
    ).toThrow(/正式构建禁止使用本地 TjuaeCore/);
  });

  it('正式构建只复用可追溯的 Release 或 Actions 缓存', () => {
    const production = { mode: 'production' };
    expect(canReuseTjuaeCoreCache({ sourceType: 'download' }, production)).toBe(true);
    expect(canReuseTjuaeCoreCache({ sourceType: 'actions-artifact' }, production)).toBe(true);
    expect(canReuseTjuaeCoreCache({ sourceType: 'local-bundle' }, production)).toBe(false);
    expect(canReuseTjuaeCoreCache({ sourceType: 'local-binary' }, production)).toBe(false);
  });

  it('拒绝未知的 TjuaeCore 构建模式', () => {
    expect(() => resolveTjuaeCorePreparationPolicy({ TJUAEUI_BACKEND_BUILD_MODE: 'release-ish' })).toThrow(
      /只能是 development 或 production/
    );
  });
});
