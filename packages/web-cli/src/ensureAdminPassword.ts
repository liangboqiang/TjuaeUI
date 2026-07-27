/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 *
 * 压缩包首次启动时，tjuaecore 的 SQLite `users` 表包含 password_hash 为空的
 * `system_default_user`。本模块探测 /api/auth/status；当
 * `needs_setup === true` 时，调用 /api/webui/reset-password 生成并保存随机密码，
 * 再输出到标准输出供用户登录。
 *
 * 此流程与 Electron 的 maybeSeedInitialPassword 及 scripts/webui.ts 中的 Bun
 * 开发辅助流程保持一致，修改其中任一处时必须同步更新。
 *
 * 输出格式由 scripts/smoke-test-web-cli.sh 解析；修改时必须同步更新该脚本。
 */

export type EnsureAdminPasswordDeps = {
  fetch: typeof fetch;
  log: (msg: string) => void;
  warn: (msg: string) => void;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

export type EnsureAdminPasswordOptions = {
  /** tjuaecore 在 127.0.0.1 上监听的端口。 */
  backendPort: number;
  /** 等待 /api/auth/status 就绪的总时限，默认 15 秒。 */
  statusTimeoutMs?: number;
  /** /api/auth/status 探测间隔，默认 500 毫秒。 */
  statusPollIntervalMs?: number;
  /**
   * 失败提示中显示的重置命令。发布压缩包使用 `tjuaeui-web resetpass`，仓库内
   * 开发使用 `bun run resetpass`；默认使用发布形式。
   */
  resetCommand?: string;
};

type AuthStatus = {
  needs_setup?: boolean;
  data?: { needs_setup?: boolean };
};

type ResetPasswordResponse = {
  data?: { new_password?: string };
  new_password?: string;
};

type SystemUserResponse = {
  data?: { username?: string } | null;
};

async function waitForStatus(
  deps: EnsureAdminPasswordDeps,
  url: string,
  budgetMs: number,
  intervalMs: number
): Promise<AuthStatus> {
  const deadline = deps.now() + budgetMs;
  let lastErr: unknown = undefined;
  while (deps.now() < deadline) {
    try {
      const res = await deps.fetch(url);
      if (res.ok) {
        return (await res.json()) as AuthStatus;
      }
      lastErr = new Error(`/api/auth/status 返回状态码 ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await deps.sleep(intervalMs);
  }
  throw lastErr instanceof Error ? lastErr : new Error('/api/auth/status 未在限定时间内就绪');
}

async function fetchAdminUsername(deps: EnsureAdminPasswordDeps, backendPort: number): Promise<string> {
  try {
    const res = await deps.fetch(`http://127.0.0.1:${backendPort}/api/auth/internal/users/system`);
    if (!res.ok) return 'admin';
    const json = (await res.json()) as SystemUserResponse;
    return json.data?.username || 'admin';
  } catch {
    return 'admin';
  }
}

/**
 * 探测后端认证状态。首次安装时调用 reset-password 并输出凭据。该函数不抛出
 * 异常；失败时记录警告并继续启动，用户仍可手动执行 resetpass。
 */
export async function ensureAdminPassword(
  opts: EnsureAdminPasswordOptions,
  deps: EnsureAdminPasswordDeps
): Promise<void> {
  const timeoutMs = opts.statusTimeoutMs ?? 15_000;
  const intervalMs = opts.statusPollIntervalMs ?? 500;
  const resetCmd = opts.resetCommand ?? 'tjuaeui-web resetpass';
  const base = `http://127.0.0.1:${opts.backendPort}`;

  let status: AuthStatus;
  try {
    status = await waitForStatus(deps, `${base}/api/auth/status`, timeoutMs, intervalMs);
  } catch (err) {
    deps.warn(`[tjuaeui-web] 无法验证管理员凭据：${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  const needsSetup = status.needs_setup ?? status.data?.needs_setup ?? false;

  if (!needsSetup) {
    const username = await fetchAdminUsername(deps, opts.backendPort);
    deps.log(`[tjuaeui-web] 请使用用户名“${username}”登录；忘记密码时运行 \`${resetCmd}\`。`);
    return;
  }

  try {
    const resetRes = await deps.fetch(`${base}/api/webui/reset-password`, { method: 'POST' });
    if (!resetRes.ok) {
      deps.warn(`[tjuaeui-web] /api/webui/reset-password 返回状态码 ${resetRes.status}；请运行 \`${resetCmd}\``);
      return;
    }
    const payload = (await resetRes.json()) as ResetPasswordResponse;
    const newPassword = payload.data?.new_password ?? payload.new_password;
    if (!newPassword) {
      deps.warn(`[tjuaeui-web] /api/webui/reset-password 未返回 new_password；请运行 \`${resetCmd}\``);
      return;
    }
    const username = await fetchAdminUsername(deps, opts.backendPort);
    deps.log(`[tjuaeui-web] 已生成初始管理员密码：${newPassword}`);
    deps.log(`[tjuaeui-web] 请使用用户名“${username}”登录，并在界面中修改密码。`);
  } catch (err) {
    deps.warn(`[tjuaeui-web] 无法生成初始管理员密码：${err instanceof Error ? err.message : String(err)}`);
  }
}
