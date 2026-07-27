import { startWebHost, startStaticServer } from '@tjuae/web-host';
import type { WebHostHandle, StaticServerHandle } from '@tjuae/web-host';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowserUrl, shouldAutoOpenBrowser } from './browser.js';
import { ensureAdminPassword } from './ensureAdminPassword.js';

// tarball layout:
//   tjuaeui-web/
//   ├── tjuaeui-web              ← bun-compiled standalone binary (process.execPath)
//   ├── package.json             ← for runtime version lookup
//   ├── bundled-tjuaecore/<plat-arch>/tjuaecore[.exe]
//   └── static/                  ← SPA assets
//
// Under `bun build --compile`, import.meta.url resolves to a virtual /$bunfs/
// path, NOT the real tarball location — we MUST use process.execPath to find
// sibling files. In dev (tsx/node), process.execPath is the node/bun binary,
// so fall back to import.meta.url there.
function resolveCliRoot(): string {
  // Heuristic: if the executable path ends in "tjuaeui-web" or "tjuaeui-web.exe",
  // treat it as the packaged single-file binary and return its directory.
  const exe = process.execPath;
  const exeName = path.basename(exe).toLowerCase();
  if (exeName === 'tjuaeui-web' || exeName === 'tjuaeui-web.exe') {
    return path.dirname(exe);
  }
  // Dev mode (tsx/node/bun running from source): use import.meta.url
  const __filename = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(__filename), '..');
}

const cliRoot = resolveCliRoot();

// `isPackaged` mirrors AppMetadata.isPackaged: true when running as the
// bun-compiled single-file binary inside a release tarball. Only the
// resetpass hint text varies by mode today.
//
// Note on macOS quarantine: we tried stripping `com.apple.quarantine` from
// cliRoot at process start, but Gatekeeper refuses exec _before_ our code
// runs, so the first launch still fails. Users must either run
// `xattr -dr com.apple.quarantine <path>` manually or use `install-web.sh`,
// which does it for them. Until we sign + notarize, there is nothing the
// binary itself can do about first-launch quarantine.
const isPackaged = (() => {
  const exeName = path.basename(process.execPath).toLowerCase();
  return exeName === 'tjuaeui-web' || exeName === 'tjuaeui-web.exe';
})();

const BACKEND_BINARY = process.platform === 'win32' ? 'tjuaecore.exe' : 'tjuaecore';
const DEFAULT_PORT = 25808;
const RESET_COMMAND = isPackaged ? 'tjuaeui-web resetpass' : 'bun run resetpass';

let currentHandle: WebHostHandle | StaticServerHandle | null = null;

function parseArgs(argv: string[]): { command: string; flags: Map<string, string | true> } {
  const [command = 'start', ...rest] = argv;
  const flags = new Map<string, string | true>();
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith('--')) continue;
    const name = token.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) {
      flags.set(name, next);
      i++;
    } else {
      flags.set(name, true);
    }
  }
  return { command, flags };
}

function resolveBackendBinary(flags: Map<string, string | true>): string {
  const override = flags.get('backend-bin');
  if (typeof override === 'string') return path.resolve(override);
  const envOverride = process.env.TJUAEUI_BACKEND_BIN;
  if (envOverride) return path.resolve(envOverride);
  const platArch = `${process.platform}-${process.arch}`;
  const bundled = path.join(cliRoot, 'bundled-tjuaecore', platArch, BACKEND_BINARY);
  return bundled;
}

function resolveStaticDir(flags: Map<string, string | true>): string {
  const override = flags.get('static-dir');
  if (typeof override === 'string') return path.resolve(override);
  return path.join(cliRoot, 'static');
}

function resolveDataDir(flags: Map<string, string | true>): string {
  const override = flags.get('data-dir');
  if (typeof override === 'string') return path.resolve(override);
  const envOverride = process.env.TJUAEUI_DATA_DIR;
  if (envOverride) return path.resolve(envOverride);
  return path.join(os.homedir(), '.tjuaeui-web');
}

function resolveLogDir(flags: Map<string, string | true>, dataDir: string): string {
  const override = flags.get('log-dir');
  if (typeof override === 'string') return path.resolve(override);
  const envOverride = process.env.TJUAEUI_LOG_DIR;
  if (envOverride) return path.resolve(envOverride);
  return path.join(dataDir, 'logs');
}

function resolvePort(flags: Map<string, string | true>): number {
  const cli = flags.get('port');
  if (typeof cli === 'string' && /^\d+$/.test(cli)) return Number(cli);
  const env = process.env.TJUAEUI_PORT ?? process.env.PORT;
  if (env && /^\d+$/.test(env)) return Number(env);
  return DEFAULT_PORT;
}

function resolveAllowRemote(flags: Map<string, string | true>): boolean {
  if (flags.has('remote')) return true;
  const env = process.env.TJUAEUI_ALLOW_REMOTE ?? process.env.TJUAEUI_REMOTE;
  if (!env) return false;
  return ['1', 'true', 'yes', 'on'].includes(env.trim().toLowerCase());
}

function readPackageVersion(): string {
  try {
    const pkgPath = path.join(cliRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function runStart(flags: Map<string, string | true>): Promise<void> {
  const backendBin = resolveBackendBinary(flags);
  const staticDir = resolveStaticDir(flags);
  const dataDir = resolveDataDir(flags);
  fs.mkdirSync(dataDir, { recursive: true });
  const logDir = resolveLogDir(flags, dataDir);
  fs.mkdirSync(logDir, { recursive: true });
  const port = resolvePort(flags);
  const allowRemote = resolveAllowRemote(flags);
  const version = readPackageVersion();
  const autoOpenBrowser = shouldAutoOpenBrowser({
    allowRemote,
    env: process.env,
    openFlag: flags.has('open'),
    noOpenFlag: flags.has('no-open'),
  });

  if (!fs.existsSync(staticDir)) {
    console.error(`[tjuaeui-web] 未找到静态资源目录：${staticDir}`);
    console.error('  提示：使用 --static-dir <路径> 指向 SPA 构建输出');
    process.exit(1);
  }

  console.log(`[tjuaeui-web] 版本：${version}`);
  console.log(`[tjuaeui-web] 数据目录：${dataDir}`);
  console.log(`[tjuaeui-web] 日志目录：${logDir}`);
  console.log(`[tjuaeui-web] 静态资源目录：${staticDir}`);
  console.log(`[tjuaeui-web] 后端二进制文件：${backendBin}`);
  console.log(`[tjuaeui-web] 正在启动：端口=${port}，允许远程访问=${allowRemote}`);

  const backendAvailable = fs.existsSync(backendBin);

  if (!backendAvailable) {
    // 降级模式：不启动后端，仅提供 SPA 外壳。浏览器 API 请求会失败，
    // 前端负责向用户显示“后端缺失”提示。
    console.warn('');
    console.warn('⚠️  未找到后端二进制文件，正在以前端模式启动。');
    console.warn(`   缺失：${backendBin}`);
    console.warn('   WebUI 可以加载，但在后端可用前 API 请求都会失败。');
    console.warn('   启用后端：下载 tjuaecore，并设置 TJUAEUI_BACKEND_BIN。');
    console.warn('');

    const handle = await startStaticServer({
      staticDir,
      backendPort: 0, // 无效端口使 API 代理以可控方式失败。
      port,
      allowRemote,
    });
    currentHandle = handle;

    console.log('');
    console.log('TjuaeUI WebUI（仅前端）已就绪');
    console.log(`  本机地址：${handle.localUrl}`);
    if (handle.networkUrl) console.log(`  网络地址：${handle.networkUrl}`);
    if (autoOpenBrowser) {
      const openResult = openBrowserUrl(handle.localUrl);
      if (openResult.ok) {
        console.log(`[tjuaeui-web] 已在浏览器中打开 ${handle.localUrl}`);
      } else {
        console.warn(`[tjuaeui-web] 无法自动打开浏览器：${openResult.reason}`);
      }
    }
    console.log('');
    console.log('按 Ctrl+C 停止。');
  } else {
    const handle = await startWebHost({
      app: {
        version,
        isPackaged: true,
        resourcesPath: cliRoot,
        userDataPath: dataDir,
      },
      staticDir,
      port,
      allowRemote,
      dataDir,
      logDir,
      dirs: {
        cacheDir: dataDir,
        workDir: dataDir,
        logDir,
      },
      backend: {
        kind: 'ownBackend',
        resolveBackend: () => backendBin,
      },
    });

    currentHandle = handle;

    console.log('');
    console.log('TjuaeUI WebUI 已就绪');
    console.log(`  本机地址：${handle.localUrl}`);
    if (handle.networkUrl) console.log(`  网络地址：${handle.networkUrl}`);

    // 首次启动时，如果 SQLite 尚无管理员密码，则由后端生成密码并输出。
    // 该步骤失败时不终止启动，用户仍可手动执行 resetpass。
    await ensureAdminPassword(
      { backendPort: handle.backendPort, resetCommand: RESET_COMMAND },
      {
        fetch: (...args) => fetch(...args),
        log: (msg) => console.log(msg),
        warn: (msg) => console.warn(msg),
        sleep: (ms) => delay(ms),
        now: () => Date.now(),
      }
    );

    if (autoOpenBrowser) {
      const openResult = openBrowserUrl(handle.localUrl);
      if (openResult.ok) {
        console.log(`[tjuaeui-web] 已在浏览器中打开 ${handle.localUrl}`);
      } else {
        console.warn(`[tjuaeui-web] 无法自动打开浏览器：${openResult.reason}`);
      }
    }

    console.log('');
    console.log('按 Ctrl+C 停止。');
  }

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[tjuaeui-web] 收到 ${signal}，正在停止……`);
    try {
      if (currentHandle) await currentHandle.stop();
    } catch (err) {
      console.error('[tjuaeui-web] 停止失败：', err);
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

/**
 * `tjuaeui-web resetpass`：临时启动后端，调用
 * /api/webui/reset-password，输出新密码后关闭。它与 `start` 使用相同的
 * data-dir 解析规则，因此会重置用户日常使用的数据库。
 */
async function runResetPassword(flags: Map<string, string | true>): Promise<void> {
  const backendBin = resolveBackendBinary(flags);
  if (!fs.existsSync(backendBin)) {
    console.error(`[tjuaeui-web] 未找到后端二进制文件：${backendBin}`);
    console.error('  提示：使用 --backend-bin <路径>，或设置 TJUAEUI_BACKEND_BIN');
    process.exit(1);
  }
  const dataDir = resolveDataDir(flags);
  fs.mkdirSync(dataDir, { recursive: true });
  const logDir = resolveLogDir(flags, dataDir);
  fs.mkdirSync(logDir, { recursive: true });
  const staticDir = resolveStaticDir(flags);
  const version = readPackageVersion();

  console.log(`[tjuaeui-web] 正在重置 ${dataDir} 中的管理员密码`);

  const handle = await startWebHost({
    app: {
      version,
      isPackaged: true,
      resourcesPath: cliRoot,
      userDataPath: dataDir,
    },
    // resetpass 只需要后端；仍传入静态目录以满足 Web Host 启动契约。
    staticDir,
    // 使用临时端口（0），避免与并行运行的实例冲突。
    port: 0,
    allowRemote: false,
    dataDir,
    logDir,
    dirs: { cacheDir: dataDir, workDir: dataDir, logDir },
    backend: { kind: 'ownBackend', resolveBackend: () => backendBin },
  });
  currentHandle = handle;

  try {
    // 等待后端完成迁移和初始化后再调用接口。
    const deadline = Date.now() + 15_000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${handle.backendPort}/api/auth/status`);
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {
        /* 后端仍在启动 */
      }
      await delay(500);
    }
    if (!ready) {
      console.error('[tjuaeui-web] 后端未在 15 秒内就绪');
      process.exit(1);
    }

    const res = await fetch(`http://127.0.0.1:${handle.backendPort}/api/webui/reset-password`, {
      method: 'POST',
    });
    if (!res.ok) {
      console.error(`[tjuaeui-web] /api/webui/reset-password 返回状态码 ${res.status}`);
      process.exit(1);
    }
    const payload = (await res.json()) as {
      data?: { new_password?: string; username?: string };
      new_password?: string;
      username?: string;
    };
    const newPassword = payload.data?.new_password ?? payload.new_password;
    const username = payload.data?.username ?? payload.username ?? 'admin';
    if (!newPassword) {
      console.error('[tjuaeui-web] reset-password 响应缺少 new_password');
      process.exit(1);
    }
    console.log(`[tjuaeui-web] 用户名：${username}`);
    console.log(`[tjuaeui-web] 新密码：${newPassword}`);
    console.log('[tjuaeui-web] 现有会话均已失效。');
  } finally {
    try {
      await handle.stop();
    } catch {
      /* 尽力关闭 */
    }
    currentHandle = null;
  }
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (command === '--version' || command === 'version' || command === '-v') {
    console.log(readPackageVersion());
    return;
  }

  if (command === '--help' || command === 'help' || command === '-h') {
    console.log(`用法：tjuaeui-web <命令> [选项]

命令：
  start              启动 WebUI（默认）
  resetpass          重置管理员密码并输出新密码
  version            显示版本
  help               显示帮助

start 选项：
  --port <端口>           监听端口（默认：${DEFAULT_PORT}）
  --remote                绑定 0.0.0.0，而不是 127.0.0.1
  --open                  强制在浏览器中打开本机地址
  --no-open               禁止自动打开浏览器
  --data-dir <路径>       覆盖数据目录（默认：~/.tjuaeui-web）
  --log-dir <路径>        覆盖日志目录（默认：<数据目录>/logs）
  --static-dir <路径>     覆盖静态资源目录
  --backend-bin <路径>    覆盖后端二进制文件路径

resetpass 选项：
  --data-dir <路径>       要重置的数据目录（默认：~/.tjuaeui-web）
  --backend-bin <路径>    覆盖后端二进制文件路径

环境变量：
  TJUAEUI_PORT, TJUAEUI_ALLOW_REMOTE, TJUAEUI_DATA_DIR, TJUAEUI_LOG_DIR,
  TJUAEUI_BACKEND_BIN, TJUAEUI_OPEN_BROWSER
`);
    return;
  }

  if (command === 'resetpass') {
    await runResetPassword(flags);
    return;
  }

  if (command !== 'start') {
    console.error(`未知命令：${command}`);
    console.error('用法：tjuaeui-web [start|resetpass|version|help]');
    process.exit(1);
  }

  await runStart(flags);
}

main().catch((err: Error) => {
  console.error('[tjuaeui-web] 严重错误：', err.message);
  if (currentHandle) void currentHandle.stop().catch(() => undefined);
  process.exit(1);
});
