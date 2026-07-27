/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const { resolveTjuaeCoreVersion } = require('../../../scripts/resolveTjuaeCoreVersion.js') as {
  resolveTjuaeCoreVersion: (projectRoot: string) => string;
};

const originalOverride = process.env.TJUAEUI_BACKEND_VERSION;
const temporaryDirectories: string[] = [];

const createProject = (packageJson: unknown): string => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'tjuaeui-core-version-'));
  temporaryDirectories.push(projectRoot);
  writeFileSync(path.join(projectRoot, 'package.json'), `${JSON.stringify(packageJson)}\n`, 'utf8');
  return projectRoot;
};

afterEach(() => {
  if (originalOverride === undefined) {
    delete process.env.TJUAEUI_BACKEND_VERSION;
  } else {
    process.env.TJUAEUI_BACKEND_VERSION = originalOverride;
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('resolveTjuaeCoreVersion', () => {
  it('优先使用显式环境变量覆盖值', () => {
    process.env.TJUAEUI_BACKEND_VERSION = '  v9.8.7  ';
    expect(resolveTjuaeCoreVersion(createProject({ tjuaeCoreVersion: 'v0.2.0' }))).toBe('v9.8.7');
  });

  it('默认读取 package.json 中固定的 Core 版本', () => {
    delete process.env.TJUAEUI_BACKEND_VERSION;
    expect(resolveTjuaeCoreVersion(createProject({ tjuaeCoreVersion: ' v0.2.0 ' }))).toBe('v0.2.0');
  });

  it('缺少固定版本时拒绝不可复现构建', () => {
    delete process.env.TJUAEUI_BACKEND_VERSION;
    expect(() => resolveTjuaeCoreVersion(createProject({ version: '3.0.0' }))).toThrow(
      'package.json 缺少有效的 tjuaeCoreVersion'
    );
  });

  it('拒绝 latest 这类会随时间变化的版本', () => {
    delete process.env.TJUAEUI_BACKEND_VERSION;
    expect(() => resolveTjuaeCoreVersion(createProject({ tjuaeCoreVersion: 'latest' }))).toThrow('必须是固定版本标签');
  });
});
