/**
 * ACP Agent Startup Latency Benchmark
 *
 * Launches the Electron app with ACP_PERF=1, then drives N consecutive
 * new-chat sessions for each specified agent backend (claude, codex).
 * After each session reaches session_active, it reads the [ACP-PERF] log
 * lines from the electron-log file and records per-phase timings.
 *
 * Usage:
 *   bunx tsx scripts/benchmark-acp-startup.ts [--agents claude,codex] [--sessions 20]
 */
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';

// ── CLI args ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let agents = ['claude', 'codex'];
  let sessions = 20;
  let slow = false;
  let models: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agents' && args[i + 1]) {
      agents = args[i + 1].split(',').map((s) => s.trim());
      i++;
    }
    if (args[i] === '--sessions' && args[i + 1]) {
      sessions = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--models' && args[i + 1]) {
      models = args[i + 1].split(',').map((s) => s.trim());
      i++;
    }
    if (args[i] === '--slow') {
      slow = true;
    }
  }
  return { agents, sessions, slow, models };
}

// ── Types ───────────────────────────────────────────────────────────────────

type SessionTiming = {
  agent: string;
  model: string;
  sessionIndex: number;
  wallClockMs: number;
  totalMs: number;
  connectionMs: number;
  authenticationMs: number;
  sessionCreatedMs: number;
  modelSetMs: number;
  sessionModeSetMs: number;
  firstChunkMs: number;
  // Connection sub-phases
  shellEnvMs: number;
  envPreparedMs: number;
  processSpawnMs: number;
  cliStartupMs: number;
  protocolInitMs: number;
  connectTotalMs: number;
  codexCacheLookupMs: number;
  codexDiagnosticsMs: number;
  failed: boolean;
  timestamp: string;
};

// ── Selectors (mirrors tests/e2e/helpers/selectors.ts) ──────────────────────

const AGENT_PILL = '[data-agent-pill="true"]';
const GUID_INPUT = '.guid-input-card-shell textarea';
const AGENT_STATUS_MESSAGE = '.agent-status-message';
const NEW_CHAT_TRIGGER = 'div.newChatTrigger';
const MODEL_SELECTOR_BTN = 'button.sendbox-model-btn.guid-config-btn';

function agentPillByBackend(backend: string) {
  return `${AGENT_PILL}[data-agent-backend="${backend}"]`;
}

// ── Log parsing ─────────────────────────────────────────────────────────────

function getLogFilePath(): string {
  const today = new Date().toISOString().slice(0, 10);
  // Dev mode uses "TjuaeUI-Dev", production uses "TjuaeUI"
  const devPath = path.join(os.homedir(), 'Library', 'Logs', 'TjuaeUI-Dev', `${today}.log`);
  const prodPath = path.join(os.homedir(), 'Library', 'Logs', 'TjuaeUI', `${today}.log`);
  return fs.existsSync(devPath) ? devPath : prodPath;
}

function getLogFileSize(logPath: string): number {
  try {
    return fs.statSync(logPath).size;
  } catch {
    return 0;
  }
}

function readNewLogLines(logPath: string, offset: number): string[] {
  try {
    const currentSize = fs.statSync(logPath).size;
    if (currentSize <= offset) return [];
    const fd = fs.openSync(logPath, 'r');
    const buf = Buffer.alloc(currentSize - offset);
    fs.readSync(fd, buf, 0, buf.length, offset);
    fs.closeSync(fd);
    return buf.toString('utf-8').split('\n');
  } catch {
    return [];
  }
}

const PERF_START_REGEX = /\[ACP-PERF\] start: (.+?) (\d+)ms/;
const PERF_CONNECT_REGEX = /\[ACP-PERF\] connect: (.+?) (\d+)ms/;
const PERF_BACKEND_REGEX = /\[ACP-PERF\] \w+: (env prepared|process spawned)\D*?(\d+)ms/;
const PERF_FIRST_CHUNK_REGEX = /\[ACP-PERF\] stream: first chunk received (\d+)ms/;

function parsePerfLines(lines: string[]): Partial<SessionTiming> {
  const result: Partial<SessionTiming> = {
    totalMs: 0,
    connectionMs: 0,
    authenticationMs: 0,
    sessionCreatedMs: 0,
    modelSetMs: 0,
    sessionModeSetMs: 0,
    firstChunkMs: 0,
    shellEnvMs: 0,
    envPreparedMs: 0,
    processSpawnMs: 0,
    cliStartupMs: 0,
    protocolInitMs: 0,
    connectTotalMs: 0,
    codexCacheLookupMs: 0,
    codexDiagnosticsMs: 0,
    failed: false,
  };

  for (const line of lines) {
    // Parse first chunk latency
    const chunkMatch = PERF_FIRST_CHUNK_REGEX.exec(line);
    if (chunkMatch) {
      result.firstChunkMs = parseInt(chunkMatch[1], 10);
      continue;
    }

    // Parse connection sub-phases: [ACP-PERF] connect: <phase> <ms>ms
    const connMatch = PERF_CONNECT_REGEX.exec(line);
    if (connMatch) {
      const [, phase, msStr] = connMatch;
      const ms = parseInt(msStr, 10);
      if (phase.startsWith('shell env loaded')) result.shellEnvMs = ms;
      else if (phase.startsWith('cli startup')) result.cliStartupMs = ms;
      else if (phase.startsWith('protocol initialized')) result.protocolInitMs = ms;
      else if (phase === 'total') result.connectTotalMs = ms;
      else if (phase.startsWith('codex cached binary lookup')) result.codexCacheLookupMs = ms;
      else if (phase.startsWith('codex diagnostics')) result.codexDiagnosticsMs = ms;
      continue;
    }

    // Parse backend-specific phases: [ACP-PERF] <backend>: env prepared|process spawned <ms>ms
    const backendMatch = PERF_BACKEND_REGEX.exec(line);
    if (backendMatch) {
      const [, phase, msStr] = backendMatch;
      const ms = parseInt(msStr, 10);
      if (phase.startsWith('env prepared')) result.envPreparedMs = ms;
      else if (phase.startsWith('process spawned')) result.processSpawnMs = ms;
      continue;
    }

    // Parse start-level phases: [ACP-PERF] start: <phase> <ms>ms
    const match = PERF_START_REGEX.exec(line);
    if (!match) continue;
    const [, phase, msStr] = match;
    const ms = parseInt(msStr, 10);

    if (phase === 'total') result.totalMs = ms;
    else if (phase.startsWith('connection.connect()')) result.connectionMs = ms;
    else if (phase.startsWith('authentication')) result.authenticationMs = ms;
    else if (phase.startsWith('session created')) result.sessionCreatedMs = ms;
    else if (phase.startsWith('model set')) result.modelSetMs = ms;
    else if (phase.startsWith('session mode set')) result.sessionModeSetMs = ms;
    else if (phase.startsWith('failed')) result.failed = true;
  }

  return result;
}

// ── App launch (mirrors tests/e2e/fixtures.ts) ─────────────────────────────

async function launchApp(): Promise<ElectronApplication> {
  const projectRoot = path.resolve(__dirname, '..');
  console.log(`[基准测试] 正在从以下目录启动 Electron 应用：${projectRoot}`);

  const launchArgs = ['.'];
  const electronApp = await electron.launch({
    args: launchArgs,
    cwd: projectRoot,
    env: {
      ...process.env,
      ACP_PERF: '1',
      TJUAEUI_DISABLE_AUTO_UPDATE: '1',
      TJUAEUI_E2E_TEST: '1',
      TJUAEUI_DISABLE_DEVTOOLS: '1',
      TJUAEUI_CDP_PORT: '0',
      NODE_ENV: 'development',
    },
    timeout: 60_000,
  });

  return electronApp;
}

async function resolveMainWindow(electronApp: ElectronApplication): Promise<Page> {
  const existing = electronApp.windows().find((w) => !w.url().startsWith('devtools://'));
  if (existing) {
    await existing.waitForLoadState('domcontentloaded');
    return existing;
  }

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const win = await electronApp.waitForEvent('window', { timeout: 1_000 }).catch(() => null);
    if (win && !win.url().startsWith('devtools://')) {
      await win.waitForLoadState('domcontentloaded');
      return win;
    }
  }
  throw new Error('无法找到主窗口');
}

// ── Navigation helpers ──────────────────────────────────────────────────────

async function navigateTo(page: Page, hash: string): Promise<void> {
  await page.evaluate((h) => window.location.assign(h), hash);
  await page.waitForFunction((h) => window.location.hash === h, hash, { timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForFunction(() => (document.body.textContent?.length ?? 0) > 50, { timeout: 10_000 }).catch(() => {});
}

async function goToGuid(page: Page): Promise<void> {
  if (page.url().includes('#/guid')) return;
  await navigateTo(page, '#/guid');
}

// ── Bridge helper (mirrors tests/e2e/helpers/bridge.ts) ─────────────────────

async function invokeBridge<T = unknown>(page: Page, key: string, data?: unknown, timeoutMs = 10_000): Promise<T> {
  return page.evaluate(
    async ({ requestKey, requestData, requestTimeoutMs }) => {
      const api = (window as unknown as { electronAPI?: { emit?: Function; on?: Function } }).electronAPI;
      if (!api?.emit || !api?.on) throw new Error('electronAPI 桥接不可用');

      const id = `bench_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
      const callbackEventName = `subscribe.callback-${requestKey}${id}`;
      const requestEventName = `subscribe-${requestKey}`;

      return new Promise<unknown>((resolve, reject) => {
        let settled = false;
        const off = api.on?.((payload: { value: unknown }) => {
          try {
            const raw = payload?.value;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw as { name?: string; data?: unknown });
            if (parsed?.name !== callbackEventName) return;
            if (settled) return;
            settled = true;
            off?.();
            clearTimeout(timer);
            resolve(parsed.data);
          } catch (e) {
            if (settled) return;
            settled = true;
            off?.();
            clearTimeout(timer);
            reject(e);
          }
        });

        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          off?.();
          reject(new Error(`桥接请求超时：${requestKey}`));
        }, requestTimeoutMs);

        api.emit?.(requestEventName, { id, data: requestData });
      });
    },
    { requestKey: key, requestData: data, requestTimeoutMs: timeoutMs }
  ) as Promise<T>;
}

// ── Benchmark loop ──────────────────────────────────────────────────────────

/**
 * Select a model from the ACP model dropdown on the guid page.
 * @param modelLabel - The visible model label text (e.g. "Sonnet", "Opus", "Haiku").
 *                     Matches case-insensitively, partial match supported.
 */
async function selectModel(page: Page, modelLabel: string, slow: boolean): Promise<boolean> {
  const pause = (ms: number) => (slow ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

  // Wait for model selector button to appear (models load asynchronously after agent probe)
  const btn = page.locator(MODEL_SELECTOR_BTN);
  try {
    await btn.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    console.log(`  [模型] 模型选择按钮不可见，跳过模型切换`);
    return false;
  }

  await pause(500);
  await btn.click();

  // Escape user-provided model label before embedding in RegExp
  const escapedModelLabel = modelLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Wait for dropdown menu to render, then find the matching item by exact label text
  const menuItem = page
    .locator(`.arco-dropdown-menu-item span`)
    .filter({ hasText: new RegExp(`^${escapedModelLabel}$`, 'i') })
    .first();
  try {
    await menuItem.waitFor({ state: 'visible', timeout: 5_000 });
  } catch {
    // Close the dropdown before returning
    await page.keyboard.press('Escape');
    console.log(`  [模型] 下拉列表中未找到模型“${modelLabel}”`);
    return false;
  }
  await pause(300);
  await menuItem.click();
  await pause(300);
  return true;
}

async function runBenchmark(
  page: Page,
  electronApp: ElectronApplication,
  agents: string[],
  models: string[],
  sessionsPerAgent: number,
  slow = false
): Promise<SessionTiming[]> {
  const pause = (ms: number) => (slow ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
  const logPath = getLogFilePath();
  const results: SessionTiming[] = [];

  // Build test matrix: agent × model (if models specified) or agent × ['default']
  const modelList = models.length > 0 ? models : ['default'];

  for (const agent of agents) {
    for (const model of modelList) {
      const groupLabel = model === 'default' ? agent : `${agent}/${model}`;
      console.log(`\n[基准测试] 正在为“${groupLabel}”运行 ${sessionsPerAgent} 个会话……\n`);

      for (let i = 1; i <= sessionsPerAgent; i++) {
        const label = `[${groupLabel} #${i}/${sessionsPerAgent}]`;

        try {
          // 1. Record log offset
          const logOffset = getLogFileSize(logPath);

          // 2. Navigate to guid
          await goToGuid(page);

          // 3. Wait for pills to render, select agent
          await page.locator(AGENT_PILL).first().waitFor({ state: 'visible', timeout: 8_000 });
          await pause(1_000);
          const pill = page.locator(agentPillByBackend(agent));
          const pillVisible = await pill.isVisible().catch(() => false);
          if (!pillVisible) {
            console.log(`${label} 跳过：未找到智能体选项`);
            break;
          }
          await pill.click();
          await page.waitForSelector(`${agentPillByBackend(agent)}[data-agent-selected="true"]`, {
            timeout: 5_000,
          });
          await pause(1_000);

          // 3b. Select model if specified
          if (model !== 'default') {
            const modelSelected = await selectModel(page, model, slow);
            if (!modelSelected) {
              console.log(`${label} 跳过：模型“${model}”不可用`);
              break;
            }
            console.log(`${label} 已选择模型“${model}”`);
          }

          // 4. Send message
          const textarea = page.locator(GUID_INPUT);
          await textarea.waitFor({ state: 'visible', timeout: 8_000 });
          await pause(500);
          await textarea.fill(`基准测试 ${groupLabel} 会话 ${i}`);
          console.log(`${label} 已填写输入框，正在按下回车键……`);
          await pause(1_000);
          const wallStart = Date.now();
          await textarea.press('Enter');

          // 5. Wait for conversation page
          console.log(`${label} 正在等待会话页面……`);
          await page.waitForFunction(() => window.location.hash.includes('/conversation/'), {
            timeout: 15_000,
          });
          const hash = new URL(page.url()).hash;
          const conversationId = hash.split('/conversation/')[1];
          console.log(`${label} 会话已创建：${conversationId}`);

          // 6. Wait for ACP startup + response to complete by polling the log file.
          //    - [ACP-PERF] start: total — marks startup complete
          //    - [ACP-PERF] send: sendPrompt completed — marks the full turn done
          console.log(`${label} 正在等待 [ACP-PERF] 日志……`);
          const pollDeadline = Date.now() + 180_000;
          let startupDetected = false;
          let turnCompleted = false;
          while (Date.now() < pollDeadline) {
            const newLines = readNewLogLines(logPath, logOffset);
            if (!startupDetected && newLines.some((line) => /\[ACP-PERF\] start: total/.test(line))) {
              startupDetected = true;
              console.log(`${label} 已检测到启动完成，正在等待响应结束……`);
            }
            if (startupDetected && newLines.some((line) => /\[ACP-PERF\] send: sendPrompt completed/.test(line))) {
              turnCompleted = true;
              break;
            }
            await new Promise((r) => setTimeout(r, 500));
          }
          const wallEnd = Date.now();
          const wallClockMs = wallEnd - wallStart;

          if (!startupDetected) {
            console.log(`${label} 警告：180 秒后仍未在日志中找到 [ACP-PERF] start: total`);
          } else if (!turnCompleted) {
            console.log(`${label} 警告：已检测到启动完成，但响应未在超时时间内结束`);
          }

          // 7. Parse log lines (re-read to get final state)
          const finalLines = readNewLogLines(logPath, logOffset);
          const perf = parsePerfLines(finalLines);

          const timing: SessionTiming = {
            agent,
            model,
            sessionIndex: i,
            wallClockMs,
            totalMs: perf.totalMs ?? 0,
            connectionMs: perf.connectionMs ?? 0,
            authenticationMs: perf.authenticationMs ?? 0,
            sessionCreatedMs: perf.sessionCreatedMs ?? 0,
            modelSetMs: perf.modelSetMs ?? 0,
            sessionModeSetMs: perf.sessionModeSetMs ?? 0,
            firstChunkMs: perf.firstChunkMs ?? 0,
            shellEnvMs: perf.shellEnvMs ?? 0,
            envPreparedMs: perf.envPreparedMs ?? 0,
            processSpawnMs: perf.processSpawnMs ?? 0,
            cliStartupMs: perf.cliStartupMs ?? 0,
            protocolInitMs: perf.protocolInitMs ?? 0,
            connectTotalMs: perf.connectTotalMs ?? 0,
            codexCacheLookupMs: perf.codexCacheLookupMs ?? 0,
            codexDiagnosticsMs: perf.codexDiagnosticsMs ?? 0,
            failed: perf.failed ?? false,
            timestamp: new Date().toISOString(),
          };
          results.push(timing);

          console.log(
            `${label} 总耗时=${timing.totalMs}ms 首个数据块=${timing.firstChunkMs}ms 实际耗时=${wallClockMs}ms ` +
              `（连接=${timing.connectionMs} 身份验证=${timing.authenticationMs} ` +
              `会话=${timing.sessionCreatedMs} 模型=${timing.modelSetMs}）` +
              ` [连接明细：Shell环境=${timing.shellEnvMs} 环境准备=${timing.envPreparedMs}` +
              ` 创建进程=${timing.processSpawnMs} CLI启动=${timing.cliStartupMs}` +
              ` 协议初始化=${timing.protocolInitMs} 总计=${timing.connectTotalMs}]`
          );

          // 8. 删除会话并释放资源（终止智能体进程并删除数据库记录）。
          if (conversationId) {
            console.log(`${label} 正在删除会话 ${conversationId}……`);
            try {
              const deleted = await page.evaluate(async (convId) => {
                const api = (window as any).electronAPI;
                if (!api?.emit || !api?.on) return false;

                const reqId = `del_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
                const callbackName = `subscribe.callback-remove-conversation${reqId}`;

                return new Promise<boolean>((resolve) => {
                  const timer = setTimeout(() => resolve(false), 15_000);
                  const off = api.on((payload: any) => {
                    const parsed = typeof payload?.value === 'string' ? JSON.parse(payload.value) : payload?.value;
                    if (parsed?.name !== callbackName) return;
                    off?.();
                    clearTimeout(timer);
                    resolve(!!parsed.data);
                  });
                  api.emit('subscribe-remove-conversation', { id: reqId, data: { id: convId } });
                });
              }, conversationId);
              console.log(`${label} 删除结果：${deleted}`);
              if (deleted) {
                await page
                  .waitForFunction(() => !window.location.hash.includes('/conversation/'), { timeout: 5_000 })
                  .catch(() => {});
              }
            } catch (e: unknown) {
              const errMsg = e instanceof Error ? e.message : String(e);
              console.warn(`${label} 删除失败：${errMsg}`);
            }
          }

          // 9. Cooldown — wait for ACP subprocess to fully exit
          await new Promise((r) => setTimeout(r, 2_000));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`${label} 失败：${msg}`);
          results.push({
            agent,
            model,
            sessionIndex: i,
            wallClockMs: -1,
            totalMs: -1,
            connectionMs: 0,
            authenticationMs: 0,
            sessionCreatedMs: 0,
            modelSetMs: 0,
            sessionModeSetMs: 0,
            firstChunkMs: 0,
            shellEnvMs: 0,
            envPreparedMs: 0,
            processSpawnMs: 0,
            cliStartupMs: 0,
            protocolInitMs: 0,
            connectTotalMs: 0,
            codexCacheLookupMs: 0,
            codexDiagnosticsMs: 0,
            failed: true,
            timestamp: new Date().toISOString(),
          });

          // Try to recover: navigate back to guid
          await goToGuid(page).catch(() => {});
          await new Promise((r) => setTimeout(r, 2_000));
        }
      }
    }
  }

  return results;
}

// ── Statistics ───────────────────────────────────────────────────────────────

function computeStats(values: number[]) {
  const sorted = [...values].filter((v) => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return { mean: 0, median: 0, p95: 0, min: 0, max: 0, count: 0 };
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = Math.round(sum / sorted.length);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  return { mean, median, p95, min: sorted[0], max: sorted[sorted.length - 1], count: sorted.length };
}

// ── Grouping helper ────────────────────────────────────────────────────────

/** Derive unique group keys from results (e.g. "claude/sonnet-4", "codex/default"). */
function getGroups(results: SessionTiming[]): { key: string; agent: string; model: string }[] {
  const seen = new Set<string>();
  const groups: { key: string; agent: string; model: string }[] = [];
  for (const r of results) {
    const key = r.model === 'default' ? r.agent : `${r.agent}/${r.model}`;
    if (!seen.has(key)) {
      seen.add(key);
      groups.push({ key, agent: r.agent, model: r.model });
    }
  }
  return groups;
}

function filterGroup(results: SessionTiming[], agent: string, model: string): SessionTiming[] {
  return results.filter((r) => r.agent === agent && r.model === model && !r.failed);
}

// ── Terminal report ─────────────────────────────────────────────────────────

function printTerminalReport(results: SessionTiming[]) {
  const groups = getGroups(results);

  console.log('\n' + '═'.repeat(80));
  console.log('  ACP 启动延迟基准测试——摘要');
  console.log('═'.repeat(80));

  for (const { key, agent, model } of groups) {
    const gr = filterGroup(results, agent, model);
    const totalStats = computeStats(gr.map((r) => r.totalMs));
    const firstChunkStats = computeStats(gr.map((r) => r.firstChunkMs));
    const wallStats = computeStats(gr.map((r) => r.wallClockMs));
    const connStats = computeStats(gr.map((r) => r.connectionMs));
    const authStats = computeStats(gr.map((r) => r.authenticationMs));
    const sessStats = computeStats(gr.map((r) => r.sessionCreatedMs));
    // 连接子阶段。
    const shellEnvStats = computeStats(gr.map((r) => r.shellEnvMs));
    const envPrepStats = computeStats(gr.map((r) => r.envPreparedMs));
    const spawnStats = computeStats(gr.map((r) => r.processSpawnMs));
    const cliStartupStats = computeStats(gr.map((r) => r.cliStartupMs));
    const protoInitStats = computeStats(gr.map((r) => r.protocolInitMs));
    const connTotalStats = computeStats(gr.map((r) => r.connectTotalMs));

    const pad = 24;
    console.log(`\n  ${key.toUpperCase()}（${totalStats.count} 个成功会话）`);
    console.log('  ' + '─'.repeat(76));
    console.log(
      `  ${'阶段'.padEnd(pad)} ${'平均值'.padStart(8)} ${'中位数'.padStart(8)} ${'P95'.padStart(8)} ${'最小值'.padStart(8)} ${'最大值'.padStart(8)}`
    );
    console.log('  ' + '─'.repeat(76));

    const rows: [string, ReturnType<typeof computeStats>][] = [
      ['总耗时（日志）', totalStats],
      ['首个数据块', firstChunkStats],
      ['实际耗时', wallStats],
      ['建立连接', connStats],
      ['  Shell 环境', shellEnvStats],
      ['  环境准备', envPrepStats],
      ['  创建进程', spawnStats],
      ['  CLI 启动', cliStartupStats],
      ['  协议初始化', protoInitStats],
      ['  连接总耗时', connTotalStats],
      ['身份验证', authStats],
      ['创建会话', sessStats],
    ];

    // 存在数据时添加 Codex 专属行。
    const codexCacheStats = computeStats(gr.map((r) => r.codexCacheLookupMs));
    const codexDiagStats = computeStats(gr.map((r) => r.codexDiagnosticsMs));
    if (codexCacheStats.count > 0 || codexDiagStats.count > 0) {
      rows.push(['  Codex 缓存查找', codexCacheStats]);
      rows.push(['  Codex 诊断', codexDiagStats]);
    }

    for (const [label, stats] of rows) {
      console.log(
        `  ${label.padEnd(pad)} ${(stats.mean + 'ms').padStart(8)} ${(stats.median + 'ms').padStart(8)} ${(stats.p95 + 'ms').padStart(8)} ${(stats.min + 'ms').padStart(8)} ${(stats.max + 'ms').padStart(8)}`
      );
    }
  }

  console.log('\n' + '═'.repeat(80) + '\n');
}

// ── HTML report ─────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function generateHtmlReport(results: SessionTiming[]): string {
  const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = path.join(__dirname, 'benchmark-results');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `acp-startup-${now}.html`);

  const groups = getGroups(results);
  const statsRows = groups
    .map(({ key, agent, model }) => {
      const gr = filterGroup(results, agent, model);
      const metrics: [string, number[]][] = [
        ['启动总耗时', gr.map((r) => r.totalMs)],
        ['首个数据块', gr.map((r) => r.firstChunkMs)],
        ['建立连接', gr.map((r) => r.connectionMs)],
        ['  Shell 环境', gr.map((r) => r.shellEnvMs)],
        ['  环境准备', gr.map((r) => r.envPreparedMs)],
        ['  创建进程', gr.map((r) => r.processSpawnMs)],
        ['  CLI 启动', gr.map((r) => r.cliStartupMs)],
        ['  协议初始化', gr.map((r) => r.protocolInitMs)],
        ['身份验证', gr.map((r) => r.authenticationMs)],
        ['创建会话', gr.map((r) => r.sessionCreatedMs)],
      ];
      return metrics
        .map(([label, vals]) => {
          const s = computeStats(vals);
          return `<tr><td>${escapeHtml(key)}</td><td>${label}</td><td>${s.count}</td><td>${s.mean}ms</td><td>${s.median}ms</td><td>${s.p95}ms</td><td>${s.min}ms</td><td>${s.max}ms</td></tr>`;
        })
        .join('\n');
    })
    .join('\n');

  const metricCards = groups
    .map(({ key, agent, model }) => {
      const successful = filterGroup(results, agent, model).filter((result) => !result.failed);
      const totalMedian = computeStats(successful.map((result) => result.totalMs)).median;
      const firstChunkMedian = computeStats(successful.map((result) => result.firstChunkMs)).median;
      const maxValue = Math.max(totalMedian, firstChunkMedian, 1);
      const totalWidth = Math.max((totalMedian / maxValue) * 100, 1);
      const firstChunkWidth = Math.max((firstChunkMedian / maxValue) * 100, 1);
      return `<section class="metric-card">
        <h2>${escapeHtml(key)}</h2>
        <div class="metric-row"><span>启动中位数</span><div class="bar-track"><i style="width:${totalWidth}%"></i></div><strong>${totalMedian} ms</strong></div>
        <div class="metric-row"><span>首块中位数</span><div class="bar-track"><i class="first-chunk" style="width:${firstChunkWidth}%"></i></div><strong>${firstChunkMedian} ms</strong></div>
        <p>成功会话：${successful.length}</p>
      </section>`;
    })
    .join('\n');

  const rawRows = results
    .map((r) => {
      const groupKey = r.model === 'default' ? r.agent : `${r.agent}/${r.model}`;
      return (
        `<tr class="${r.failed ? 'failed' : ''}"><td>${r.sessionIndex}</td><td>${escapeHtml(groupKey)}</td>` +
        `<td>${r.totalMs}</td><td>${r.firstChunkMs}</td><td>${r.connectionMs}</td>` +
        `<td>${r.shellEnvMs}</td><td>${r.envPreparedMs}</td><td>${r.processSpawnMs}</td>` +
        `<td>${r.cliStartupMs}</td><td>${r.protocolInitMs}</td>` +
        `<td>${r.authenticationMs}</td><td>${r.sessionCreatedMs}</td>` +
        `<td>${r.wallClockMs}</td><td>${r.failed ? '失败' : '通过'}</td></tr>`
      );
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>ACP 启动延迟基准测试</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; background: #f8f9fa; color: #333; }
    h1 { margin-bottom: 8px; }
    .meta { color: #666; margin-bottom: 24px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-bottom: 32px; }
    .metric-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .metric-card h2 { margin-bottom: 16px; font-size: 18px; }
    .metric-card p { color: #666; font-size: 13px; margin-top: 12px; }
    .metric-row { display: grid; grid-template-columns: 88px 1fr 72px; gap: 12px; align-items: center; margin: 10px 0; font-size: 13px; }
    .metric-row strong { text-align: right; }
    .bar-track { height: 10px; overflow: hidden; border-radius: 999px; background: #eef1f4; }
    .bar-track i { display: block; height: 100%; border-radius: inherit; background: #4a90d9; }
    .bar-track i.first-chunk { background: #50c878; }
    table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 24px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
    th { background: #f1f3f5; font-weight: 600; }
    tr.failed td { background: #fff5f5; color: #c92a2a; }
    @media (max-width: 720px) { body { padding: 16px; } .metric-row { grid-template-columns: 80px 1fr 64px; } }
  </style>
</head>
<body>
  <h1>ACP 启动延迟基准测试</h1>
  <p class="meta">生成时间：${new Date().toISOString()} &bull; 分组：${groups.map((g) => escapeHtml(g.key)).join('、')}</p>

  <div class="metrics">${metricCards}</div>

  <h2 style="margin-bottom:12px;">统计摘要</h2>
  <table>
    <thead><tr><th>分组</th><th>指标</th><th>会话数</th><th>平均值</th><th>中位数</th><th>P95</th><th>最小值</th><th>最大值</th></tr></thead>
    <tbody>${statsRows}</tbody>
  </table>

  <h2 style="margin-bottom:12px;">原始数据</h2>
  <table>
    <thead><tr><th>#</th><th>分组</th><th>总耗时</th><th>首个数据块</th><th>连接</th><th>Shell 环境</th><th>环境准备</th><th>创建进程</th><th>CLI 启动</th><th>协议初始化</th><th>身份验证</th><th>会话</th><th>实际耗时</th><th>状态</th></tr></thead>
    <tbody>${rawRows}</tbody>
  </table>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, 'utf-8');
  return outputPath;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { agents, sessions, slow, models } = parseArgs();
  const modelStr = models.length > 0 ? `，模型：${models.join('、')}` : '';
  console.log(`[基准测试] 智能体：${agents.join('、')}${modelStr}，会话数：${sessions}${slow ? '，慢速模式' : ''}`);

  const electronApp = await launchApp();
  const page = await resolveMainWindow(electronApp);
  console.log('[基准测试] 应用已启动，主窗口已就绪');

  // Wait for initial load
  await page.waitForFunction(() => (document.body.textContent?.length ?? 0) > 50, { timeout: 30_000 });
  await goToGuid(page);
  console.log('[基准测试] 引导页已就绪，开始基准测试……');

  const results = await runBenchmark(page, electronApp, agents, models, sessions, slow);

  // Report
  printTerminalReport(results);
  const reportPath = generateHtmlReport(results);
  console.log(`[基准测试] HTML 报告：${reportPath}`);

  // Cleanup
  try {
    await electronApp.evaluate(async ({ app }) => app.exit(0));
  } catch {
    // ignore
  }
  await electronApp.close().catch(() => {});
  console.log('[基准测试] 完成');
}

main().catch((err) => {
  console.error('[基准测试] 致命错误：', err);
  process.exit(1);
});
