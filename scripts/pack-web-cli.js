#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { prepareTjuaeCore } = require('../packages/shared-scripts/src/prepare-tjuaecore.js');
const { resolveTjuaeCoreVersion } = require('./resolveTjuaeCoreVersion.js');

const projectRoot = path.resolve(__dirname, '..');
const platform = process.env.PACK_PLATFORM || process.platform;
const arch = process.env.PACK_ARCH || process.arch;
const version = require('../package.json').version;

// 统一平台和架构名称，供压缩包命名使用。
const platformMap = { darwin: 'darwin', linux: 'linux', win32: 'win' };
const archMap = { arm64: 'arm64', x64: 'x86_64', ia32: 'x86' };
const normalizedPlatform = platformMap[platform] || platform;
const normalizedArch = archMap[arch] || arch;

const tarballName = `tjuaeui-web-${version}-${normalizedPlatform}-${normalizedArch}.tar.gz`;
const distDir = path.join(projectRoot, 'dist-web-cli');
const tarballPath = path.join(distDir, tarballName);

console.log(`正在为 ${platform}-${arch} 打包 Web 命令行程序……`);

// 1. 准备内置 tjuaecore。
console.log('1. 正在准备 tjuaecore……');
prepareTjuaeCore({
  projectRoot,
  platform,
  arch,
  version: resolveTjuaeCoreVersion(projectRoot),
});

// 2. 创建暂存目录。
console.log('2. 正在创建暂存目录……');
const stagingDir = path.join(distDir, 'staging');
fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

const tarballContentDir = path.join(stagingDir, 'tjuaeui-web');
fs.mkdirSync(tarballContentDir, { recursive: true });

// 3. 使用 Bun 把 Web 命令行程序编译成独立可执行文件。
// 单个二进制会包含 Bun 运行时和全部依赖，因此压缩包无需 node_modules，
// 用户也无需另行安装 Node.js。
console.log('3. 正在编译独立 Web 命令行程序……');
// 映射为 Bun --target 使用的平台和架构名称。
const bunTargetPlatform = { darwin: 'darwin', linux: 'linux', win32: 'windows' }[platform] || platform;
const bunTargetArch = { arm64: 'arm64', x64: 'x64', ia32: 'x64' }[arch] || arch;
const bunTarget = `bun-${bunTargetPlatform}-${bunTargetArch}`;
const executableName = platform === 'win32' ? 'tjuaeui-web.exe' : 'tjuaeui-web';
const executablePath = path.join(tarballContentDir, executableName);
const webCliEntry = path.join(projectRoot, 'packages/web-cli/src/index.ts');
execSync(`bun build --compile --target=${bunTarget} --outfile="${executablePath}" "${webCliEntry}"`, {
  cwd: projectRoot,
  stdio: 'inherit',
});
console.log(`  → ${executablePath}`);

// 4. 复制 package.json，并写入仓库根版本供运行时读取。
// packages/web-cli/package.json 作为工作区包固定为 0.0.0，不随发行升级；
// 此处写入真实版本，使 `tjuaeui-web version` 与压缩包文件名一致。
const srcPkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'packages/web-cli/package.json'), 'utf8'));
srcPkg.version = version;
fs.writeFileSync(path.join(tarballContentDir, 'package.json'), JSON.stringify(srcPkg, null, 2) + '\n');

// 5. 从桌面渲染进程构建结果复制单页应用静态文件。
// electron-vite 输出到仓库根目录的 out/，而不是 packages/desktop/out/。
console.log('5. 正在复制静态文件……');
const rendererOutDir = path.join(projectRoot, 'out/renderer');
const staticDest = path.join(tarballContentDir, 'static');
if (fs.existsSync(rendererOutDir)) {
  fs.cpSync(rendererOutDir, staticDest, { recursive: true });
} else {
  throw new Error(`在 ${rendererOutDir} 未找到桌面渲染进程构建结果。请先运行 bunx electron-vite build。`);
}

// 6. 复制内置 tjuaecore。
const backendSrc = path.join(projectRoot, 'resources/bundled-tjuaecore', `${platform}-${arch}`);
const backendDest = path.join(tarballContentDir, 'bundled-tjuaecore', `${platform}-${arch}`);
if (!fs.existsSync(backendSrc)) {
  throw new Error(`缺少后端资源目录 ${backendSrc}。请确认 prepareTjuaeCore 已成功完成。`);
}
fs.mkdirSync(path.dirname(backendDest), { recursive: true });
fs.cpSync(backendSrc, backendDest, { recursive: true });

// 7. 创建压缩包。
fs.mkdirSync(distDir, { recursive: true });
execSync(`tar -czf ${path.basename(tarballPath)} -C ${stagingDir} tjuaeui-web`, {
  cwd: path.dirname(tarballPath),
  stdio: 'inherit',
});

console.log(`✅ 已创建压缩包：${tarballPath}`);

// 8. 生成 SHA-256 校验文件（使用 Node.js crypto 保持跨平台一致）。
const checksumPath = `${tarballPath}.sha256`;
const hash = crypto.createHash('sha256');
hash.update(fs.readFileSync(tarballPath));
const digest = hash.digest('hex');
// 与 shasum 输出格式保持一致："<hash>  <filename>\n"。
fs.writeFileSync(checksumPath, `${digest}  ${path.basename(tarballPath)}\n`);
console.log(`✅ 已创建校验文件：${checksumPath}`);

console.log('打包完成。');
