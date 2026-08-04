/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { resolveHubPreparationPolicy, validateAtomicPackageLocation, validateSeedManifest } = require(
  resolve(__dirname, '../../../scripts/prepareHubResources.js')
) as {
  resolveHubPreparationPolicy: (
    env: Record<string, string | undefined>,
    localSource: string
  ) => { mode: 'development' | 'production'; skip: boolean };
  validateAtomicPackageLocation: (packageName: string, entry: Record<string, unknown>) => void;
  validateSeedManifest: (manifest: Record<string, unknown>) => Record<string, unknown>;
};

function validSeedManifest(): Record<string, unknown> {
  const digest = `sha256-${'a'.repeat(64)}`;
  return {
    $schema:
      'https://raw.githubusercontent.com/liangboqiang/TjuaeHub/main/schemas/offline-seed-manifest.v1.schema.json',
    schemaVersion: 1,
    generatedAt: '2026-08-03T00:00:00.000Z',
    sourceRevision: 'b'.repeat(40),
    seedIndexDigest: digest,
    bundle: {
      fileName: `tjuae-seed-${'a'.repeat(64)}.zip`,
      digest,
      size: 1,
    },
    assetKinds: ['assistant', 'engineAdapter', 'mcp', 'skill'],
    packageNames: ['tjuaeasset-demo'],
    assetIds: ['tjuaeasset-demo/assistant/demo'],
  };
}

describe('TjuaeHub 离线资源构建策略', () => {
  it.each([
    [{ TJUAEUI_HUB_BUILD_MODE: 'production' }, '显式正式模式'],
    [{ CI: 'true' }, 'CI'],
    [{ NODE_ENV: 'production' }, 'production NODE_ENV'],
  ])('%s 推导为正式模式', (env) => {
    expect(resolveHubPreparationPolicy(env, '')).toEqual({
      mode: 'production',
      skip: false,
    });
  });

  it('允许开发模式显式使用本地 Hub 分发目录', () => {
    expect(
      resolveHubPreparationPolicy(
        {
          TJUAEUI_HUB_BUILD_MODE: 'development',
        },
        'E:\\development\\TjuaeHub\\dist'
      )
    ).toEqual({
      mode: 'development',
      skip: false,
    });
  });

  it('拒绝正式构建跳过 Hub 离线资源', () => {
    expect(() =>
      resolveHubPreparationPolicy(
        {
          TJUAEUI_HUB_BUILD_MODE: 'production',
          TJUAEUI_HUB_SKIP: '1',
        },
        ''
      )
    ).toThrow('正式构建禁止跳过');
  });

  it('拒绝正式构建使用本地 sibling 或 dist', () => {
    expect(() =>
      resolveHubPreparationPolicy(
        {
          TJUAEUI_HUB_BUILD_MODE: 'production',
        },
        'E:\\development\\TjuaeHub\\dist'
      )
    ).toThrow('正式构建禁止使用本地 TjuaeHub 源');
  });

  it('拒绝未知构建模式', () => {
    expect(() => resolveHubPreparationPolicy({ TJUAEUI_HUB_BUILD_MODE: 'preview' }, '')).toThrow(
      'development 或 production'
    );
  });

  it('正式桌面打包始终强制固定 Hub 分发源策略', () => {
    const buildScript = readFileSync(resolve(__dirname, '../../../scripts/build-with-builder.js'), 'utf8');
    expect(buildScript).toContain("const localAcceptanceBuild = args.includes('--local-acceptance')");
    expect(buildScript).toContain("TJUAEUI_HUB_BUILD_MODE: localAcceptanceBuild ? 'development' : 'production'");
  });

  it('只接受 assets/{packageName}/asset-package.json 原子包布局', () => {
    const packageName = 'tjuaeasset-demo';
    expect(() =>
      validateAtomicPackageLocation(packageName, {
        repository: 'https://github.com/liangboqiang/TjuaeHub/',
        sourcePath: `assets/${packageName}`,
        manifestPath: `assets/${packageName}/asset-package.json`,
      })
    ).not.toThrow();

    expect(() =>
      validateAtomicPackageLocation(packageName, {
        repository: 'https://github.com/liangboqiang/TjuaeHub',
        sourcePath: `legacy/${packageName}`,
        manifestPath: `legacy/${packageName}/manifest.json`,
      })
    ).toThrow('asset-package.json');
  });

  it('接受 Hub 当前离线种子的四类资产清单契约', () => {
    const manifest = validSeedManifest();
    expect(validateSeedManifest(manifest)).toBe(manifest);
  });

  it('拒绝缺失或不完整的 assetKinds', () => {
    const missing = validSeedManifest();
    delete missing.assetKinds;
    expect(() => validateSeedManifest(missing)).toThrow('字段不符合固定契约');

    const incomplete = validSeedManifest();
    incomplete.assetKinds = ['assistant', 'skill'];
    expect(() => validateSeedManifest(incomplete)).toThrow('必须完整且仅包含四类核心资产');
  });
});
