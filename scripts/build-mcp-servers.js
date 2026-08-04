#!/usr/bin/env node
/**
 * 把内置 MCP 服务脚本构建为完全自包含的 CJS 包。
 *
 * electron-vite 的 externalizeDepsPlugin 会把 npm 包保留为 require() 调用。
 * 这对支持 ASAR 虚拟文件系统的 Electron 主进程有效，但外部 node 进程从
 * app.asar.unpacked 执行脚本时没有 ASAR 支持，因此会失败。
 *
 * 本脚本使用 esbuild 编程接口，避免 --define 值中的特殊字符引发命令行转义问题。
 */

const esbuild = require('esbuild');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SHARED_OPTIONS = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  tsconfig: path.join(ROOT, 'tsconfig.json'),
  loader: { '.wasm': 'empty' },
};

async function main() {
  await Promise.all([
    esbuild.build({
      ...SHARED_OPTIONS,
      entryPoints: [path.join(ROOT, 'packages/desktop/src/process/resources/builtinMcp/imageGenServer.ts')],
      outfile: path.join(ROOT, 'out/main/builtin-mcp-image-gen.js'),
    }),
  ]);
}

main().catch((err) => {
  console.error('MCP 服务构建失败：', err);
  process.exit(1);
});
