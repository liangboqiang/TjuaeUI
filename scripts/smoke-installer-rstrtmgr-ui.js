#!/usr/bin/env node

const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');

function nsisQuote(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '$\\"').replace(/\$/g, '$$');
}

function findMakensis() {
  if (process.env.MAKENSIS && existsSync(process.env.MAKENSIS)) {
    return process.env.MAKENSIS;
  }

  const localAppData = process.env.LOCALAPPDATA;
  const cacheRoot = localAppData ? path.join(localAppData, 'electron-builder', 'Cache') : '';
  const candidates = [];

  function walk(dir, depth = 0) {
    if (!dir || depth > 5 || !existsSync(dir)) {
      return;
    }

    for (const entry of require('node:fs').readdirSync(dir, { withFileTypes: true })) {
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

function spawnLocker(lockedFile) {
  const script = `
$ErrorActionPreference = 'Stop'
$path = ${JSON.stringify(lockedFile)}
$fs = [System.IO.File]::Open($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
try {
  while ($true) { Start-Sleep -Seconds 1 }
} finally {
  $fs.Dispose()
}
`;

  return spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    detached: false,
    stdio: 'ignore',
    windowsHide: true,
  });
}

function main() {
  if (process.platform !== 'win32') {
    throw new Error('此冒烟测试仅支持 Windows。');
  }

  const compileOnly = process.argv.includes('--compile-only');
  const makensis = findMakensis();
  const root = mkdtempSync(path.join(tmpdir(), 'tjuaeui-rm-ui-'));
  const installDir = path.join(root, 'install-dir');
  mkdirSync(installDir, { recursive: true });
  const lockedFile = path.join(installDir, 'locked-by-smoke.txt');
  writeFileSync(lockedFile, 'TjuaeUI Restart Manager UI smoke lock\n', 'utf8');

  let locker = null;
  const nsiPath = path.join(root, 'tjuaeui-rstrtmgr-ui-smoke.nsi');
  const exePath = path.join(root, 'tjuaeui-rstrtmgr-ui-smoke.exe');
  const logPath = path.join(
    process.env.TEMP || tmpdir(),
    `tjuaeui-installer-smoke-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-')}.log`
  );
  const processControlPath = path.join(repoRoot, 'resources', 'windows', 'installer-process-control.nsh');
  const messagesPath = path.join(repoRoot, 'resources', 'windows', 'installer-messages.nsh');

  const nsi = `
Unicode true
Name "TjuaeUI Restart Manager UI Smoke"
OutFile "${nsisQuote(exePath)}"
RequestExecutionLevel user
SilentInstall normal
!define TJUAEUI_FALLBACK_LOG "tjuaeui-installer-smoke-fallback.log"
!define VERSION "rstrtmgr-ui-smoke"
!define TJUAEUI_TARGET_ARCH "x64"
!define TJUAEUI_APP_EXECUTABLE_FILENAME "TjuaeUI.exe"
!define UNINSTALL_FILENAME "Uninstall TjuaeUI.exe"
!define PROJECT_DIR "${nsisQuote(repoRoot)}"
!include LogicLib.nsh
!include "${nsisQuote(messagesPath)}"
!include "${nsisQuote(processControlPath)}"

Var TjuaeUISessionLogPath
Var TjuaeUISessionId
Var TjuaeUIIsUpdated

Section
  StrCpy $INSTDIR "${nsisQuote(installDir)}"
  StrCpy $TjuaeUISessionLogPath "${nsisQuote(logPath)}"
  StrCpy $TjuaeUISessionId "rstrtmgrui"
  StrCpy $TjuaeUIIsUpdated "1"
  InitPluginsDir
  BringToFront

  tjuaeui_query_lockers:
    !insertmacro TJUAEUI_QUERY_LOCKERS "${nsisQuote(lockedFile)}" $TjuaeUILockerResult
    StrCpy $TjuaeUILockerList ""
    ClearErrors
    SetDetailsPrint none
    FileOpen $TjuaeUILockerListFile "$PLUGINSDIR\\tjuaeui-rm-lockers.txt" r
    \${IfNot} \${Errors}
      FileRead $TjuaeUILockerListFile $TjuaeUILockerList
      FileClose $TjuaeUILockerListFile
    \${EndIf}
    SetDetailsPrint lastused
    \${If} $TjuaeUILockerList == ""
      StrCpy $TjuaeUILockerList "\${TJUAEUI_MSG_UNKNOWN_PROCESS_EN}"
      StrCpy $TjuaeUILockerListZh "\${TJUAEUI_MSG_UNKNOWN_PROCESS_ZH}"
      StrCpy $TjuaeUILockerListEn "\${TJUAEUI_MSG_UNKNOWN_PROCESS_EN}"
    \${Else}
      StrCpy $TjuaeUILockerListZh "$TjuaeUILockerList"
      StrCpy $TjuaeUILockerListEn "$TjuaeUILockerList"
    \${EndIf}
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "\${TJUAEUI_MSG_FILE_OR_FOLDER_IN_USE_ZH}$\\r$\\n${nsisQuote(lockedFile)}$\\r$\\n$\\r$\\n\${TJUAEUI_MSG_APPLICATION_USING_IT_ZH}$\\r$\\n$TjuaeUILockerListZh$\\r$\\n$\\r$\\n\${TJUAEUI_MSG_CLOSE_LISTED_RETRY_ZH}$\\r$\\n$\\r$\\n\${TJUAEUI_MSG_INSTALLER_LOG_ZH}:$\\r$\\n$TjuaeUISessionLogPath$\\r$\\n$\\r$\\n\${TJUAEUI_MSG_BLOCK_SEPARATOR}$\\r$\\n$\\r$\\n\${TJUAEUI_MSG_FILE_OR_FOLDER_IN_USE_EN}$\\r$\\n${nsisQuote(lockedFile)}$\\r$\\n$\\r$\\n\${TJUAEUI_MSG_APPLICATION_USING_IT_EN}$\\r$\\n$TjuaeUILockerListEn$\\r$\\n$\\r$\\n\${TJUAEUI_MSG_CLOSE_LISTED_RETRY_EN}$\\r$\\n$\\r$\\n\${TJUAEUI_MSG_INSTALLER_LOG_EN}:$\\r$\\n$TjuaeUISessionLogPath" /SD IDCANCEL IDRETRY tjuaeui_query_lockers
SectionEnd
`;

  writeFileSync(nsiPath, nsi, 'utf8');

  try {
    console.log(`[重启管理器界面] makensis：${makensis}`);
    console.log(`[重启管理器界面] 安装目录：${installDir}`);
    console.log(`[重启管理器界面] 锁定文件：${lockedFile}`);
    console.log('[重启管理器界面] 正在编译测试程序……');

    const compile = spawnSync(makensis, [nsiPath], { encoding: 'utf8' });
    if (compile.status !== 0) {
      process.stdout.write(compile.stdout || '');
      process.stderr.write(compile.stderr || '');
      throw new Error(`makensis 执行失败，退出码：${compile.status}`);
    }

    if (compileOnly) {
      console.log(`[重启管理器界面] 仅编译检查通过：${exePath}`);
    } else {
      locker = spawnLocker(lockedFile);
      require('node:child_process').spawnSync(
        'powershell.exe',
        ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 800'],
        {
          stdio: 'ignore',
          windowsHide: true,
        }
      );
      console.log('[重启管理器界面] 正在启动测试程序。单击“取消”结束；单击“重试”会重新检测占用进程。');
      const run = spawnSync(exePath, [], { stdio: 'inherit' });
      if (run.status !== 0) {
        throw new Error(`测试程序退出码为 ${run.status}`);
      }
    }

    if (!compileOnly && existsSync(logPath)) {
      const tail = readFileSync(logPath, 'utf8').trim().split(/\r?\n/).slice(-5).join('\n');
      if (tail) {
        console.log('[重启管理器界面] 日志末尾：');
        console.log(tail);
      }
    }
  } finally {
    if (locker) {
      try {
        locker.kill();
      } catch {}
    }
    rmSync(root, { recursive: true, force: true });
  }
}

try {
  main();
} catch (err) {
  console.error(`[重启管理器界面] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
