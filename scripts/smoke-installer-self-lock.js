#!/usr/bin/env node

const { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');

function nsisQuote(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '$\\"').replace(/\$/g, '$$');
}

function findMakensis() {
  if (process.env.MAKENSIS && existsSync(process.env.MAKENSIS)) {
    return process.env.MAKENSIS;
  }

  const candidates = [];
  const cacheRoot = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache') : '';

  function walk(dir, depth = 0) {
    if (!dir || depth > 5 || !existsSync(dir)) {
      return;
    }

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase() === 'makensis.exe') {
        candidates.push(full);
      }
    }
  }

  walk(cacheRoot);
  candidates.sort((a, b) => b.localeCompare(a));
  if (candidates[0]) {
    return candidates[0];
  }

  const fromPath = spawnSync('where.exe', ['makensis.exe'], { encoding: 'utf8' });
  if (fromPath.status === 0) {
    const first = fromPath.stdout.split(/\r?\n/).find(Boolean);
    if (first && existsSync(first)) {
      return first;
    }
  }

  throw new Error('未找到 makensis.exe。请先执行一次 Windows 构建，或设置 MAKENSIS=C:\\path\\to\\makensis.exe');
}

function readJsonl(logPath) {
  return readFileSync(logPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line.replace(/^\uFEFF/, '')));
}

function normalizeWinPath(value) {
  return path.win32.normalize(String(value).replace(/\\\\/g, '\\'));
}

function main() {
  if (process.platform !== 'win32') {
    throw new Error('此冒烟测试仅支持 Windows。');
  }

  const makensis = findMakensis();
  const root = mkdtempSync(path.join(tmpdir(), 'tjuaeui-self-lock-'));
  const installDir = path.join(root, 'install-dir');
  mkdirSync(installDir, { recursive: true });
  writeFileSync(path.join(installDir, 'existing-file.txt'), 'self-lock smoke\n', 'utf8');

  const nsiPath = path.join(root, 'tjuaeui-self-lock-smoke.nsi');
  const exePath = path.join(root, 'tjuaeui-self-lock-smoke.exe');
  const logPath = path.join(
    process.env.TEMP || tmpdir(),
    `tjuaeui-installer-self-lock-${new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+$/, '')
      .replace('T', '-')}-log.jsonl`
  );
  const resultPath = path.join(process.env.TEMP || tmpdir(), `tjuaeui-installer-self-lock-${process.pid}-result.txt`);
  const processControlPath = path.join(repoRoot, 'resources', 'windows', 'installer-process-control.nsh');

  const nsi = `
Unicode true
Name "TjuaeUI Installer Self Lock Smoke"
OutFile "${nsisQuote(exePath)}"
RequestExecutionLevel user
SilentInstall silent
!define VERSION "self-lock-smoke"
!define TJUAEUI_TARGET_ARCH "x64"
!define TJUAEUI_FALLBACK_LOG "tjuaeui-installer-self-lock-fallback.log"
!define TJUAEUI_APP_EXECUTABLE_FILENAME "TjuaeUI.exe"
!define UNINSTALL_FILENAME "Uninstall TjuaeUI.exe"
!define PROJECT_DIR "${nsisQuote(repoRoot)}"
!include LogicLib.nsh
!include "${nsisQuote(processControlPath)}"

Var TjuaeUISessionId
Var TjuaeUIIsUpdated
Var TjuaeUISessionLogPath
Var ResultFile

Section
  StrCpy $INSTDIR "${nsisQuote(installDir)}"
  StrCpy $TjuaeUISessionId "selflock"
  StrCpy $TjuaeUIIsUpdated "1"
  StrCpy $TjuaeUISessionLogPath "${nsisQuote(logPath)}"
  StrCpy $ResultFile "${nsisQuote(resultPath)}"
  InitPluginsDir
  SetOutPath $INSTDIR
  StrCpy $TjuaeUICurrentOutDir "$INSTDIR"
  !insertmacro TJUAEUI_QUERY_LOCKERS "$INSTDIR" $TjuaeUILockerResult
  FileOpen $0 "$ResultFile" w
  FileWrite $0 "$TjuaeUILockerResult"
  FileWrite $0 "|$TjuaeUICurrentOutDir|$TjuaeUISessionLogPath"
  FileClose $0
  \${If} $TjuaeUILockerResult != 0
    SetErrorLevel 10
    Quit
  \${EndIf}
SectionEnd
`;

  try {
    writeFileSync(nsiPath, nsi, 'utf8');
    console.log(`[安装器自身占用] makensis：${makensis}`);
    const compile = spawnSync(makensis, [nsiPath], { encoding: 'utf8' });
    if (compile.status !== 0) {
      process.stdout.write(compile.stdout || '');
      process.stderr.write(compile.stderr || '');
      throw new Error(`makensis 执行失败，退出码：${compile.status}`);
    }

    const run = spawnSync(exePath, [], { encoding: 'utf8' });
    if (run.status !== 0) {
      process.stdout.write(run.stdout || '');
      process.stderr.write(run.stderr || '');
      const result = existsSync(resultPath) ? readFileSync(resultPath, 'utf8') : '<缺失>';
      throw new Error(`自身占用测试程序退出码为 ${run.status}；占用检测结果=${result}`);
    }

    const events = readJsonl(logPath);
    const lockers =
      events.findLast?.((event) => event.event === 'rm-lockers') ??
      events.filter((event) => event.event === 'rm-lockers').at(-1);
    if (!lockers) {
      throw new Error(`缺少 rm-lockers 事件：${logPath}`);
    }
    if (lockers.fallbackReason !== 'installer-self-lock') {
      throw new Error(`预期 fallbackReason 为 installer-self-lock，实际为 ${lockers.fallbackReason || '<空>'}`);
    }
    if (normalizeWinPath(lockers.currentOutDir) !== normalizeWinPath(installDir)) {
      throw new Error(`预期 currentOutDir 为 ${installDir}，实际为 ${lockers.currentOutDir}`);
    }
    const blocking = lockers.blockingProcesses || [];
    if (!blocking.some((process) => process.name === 'TjuaeUI installer' && Number(process.pid) > 0)) {
      throw new Error(`预期检测到 TjuaeUI 安装器占用，实际为 ${JSON.stringify(blocking)}`);
    }

    console.log(`[安装器自身占用] 检查通过：${logPath}`);
  } finally {
    rmSync(resultPath, { force: true });
    rmSync(root, { recursive: true, force: true });
  }
}

try {
  main();
} catch (err) {
  console.error(`[安装器自身占用] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
