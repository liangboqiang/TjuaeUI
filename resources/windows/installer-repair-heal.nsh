!ifndef TJUAEUI_INSTALLER_REPAIR_HEAL_NSH
!define TJUAEUI_INSTALLER_REPAIR_HEAL_NSH

Var /GLOBAL TjuaeUIRegistryInstallIsValid
Var /GLOBAL TjuaeUIInnerFailureSummary
Var /GLOBAL TjuaeUIInnerRootCode
Var /GLOBAL TjuaeUIInnerFailureReadResult

!macro TJUAEUI_READ_LAST_INNER_FAILURE
  InitPluginsDir
  StrCpy $TjuaeUIInnerRootCode ""
  StrCpy $TjuaeUIInnerFailureSummary "No specific locking process was identified. Close TjuaeUI, terminals, editors, and file managers opened in the install folder."
  nsExec::ExecToStack `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$logPath = '$TjuaeUISessionLogPath'; \
    $$summary = 'No specific locking process was identified. Close TjuaeUI, terminals, editors, and file managers opened in the install folder.'; \
    $$code = ''; \
    if ($$logPath -and (Test-Path -LiteralPath $$logPath)) { \
      $$events = @(Get-Content -LiteralPath $$logPath -ErrorAction SilentlyContinue | ForEach-Object { try { $$_ | ConvertFrom-Json } catch { $$null } } | Where-Object { $$_ }); \
      $$failure = @($$events | Where-Object { $$_.event -eq 'failure' -and $$_.updated -eq $$true } | Select-Object -Last 1)[0]; \
      if (-not $$failure) { $$failure = @($$events | Where-Object { $$_.event -eq 'failure' } | Select-Object -Last 1)[0] }; \
      if ($$failure) { \
        $$code = ([string]$$failure.code).Trim(); \
        $$phase = ([string]$$failure.phase).Trim(); \
        $$path = ([string]$$failure.failedPath).Trim(); \
        $$blocking = ''; \
        $$processes = @($$failure.blockingProcesses); \
        if ($$processes.Count -gt 0) { $$blocking = (@($$processes | ForEach-Object { if ($$_.pid) { [string]$$_.name + '(' + [string]$$_.pid + ')' } else { [string]$$_.name } }) -join ', ') }; \
        if (-not $$blocking) { $$blocking = ([string]$$failure.message).Trim() }; \
        if (-not $$blocking) { $$blocking = 'Windows did not identify a specific locking process. Close terminals, editors, and file managers opened in the install folder.' }; \
        $$parts = @('- Outer installer: previous uninstaller exited with code $R0', ('- Inner failure: ' + $$code + ' phase ' + $$phase)); \
        if ($$path) { $$parts += ('- File or folder: ' + $$path) }; \
        $$parts += ('- Blocking process: ' + $$blocking); \
        $$summary = $$parts -join [Environment]::NewLine; \
      } \
    }; \
    if (-not $$code) { $$code = '-----' }; \
    [Console]::Out.Write($$code + '|' + $$summary) \
  }"`
  Pop $TjuaeUIInnerFailureReadResult
  Pop $TjuaeUIInnerFailureReadResult
  StrCpy $TjuaeUIInnerRootCode $TjuaeUIInnerFailureReadResult 5
  ${If} $TjuaeUIInnerRootCode == "-----"
    StrCpy $TjuaeUIInnerRootCode ""
  ${EndIf}
  StrCpy $TjuaeUIInnerFailureSummary $TjuaeUIInnerFailureReadResult 4096 6
!macroend

!macro TJUAEUI_LOG_UNINSTALLER_REPAIR _PHASE
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$log = '$TjuaeUISessionLogPath'; \
    if (-not $$log) { $$log = Join-Path $$env:TEMP '${TJUAEUI_FALLBACK_LOG}' }; \
    $$path = '$INSTDIR\${UNINSTALL_FILENAME}'; \
    $$item = Get-Item -LiteralPath $$path -ErrorAction SilentlyContinue; \
    $$version = if ($$item) { $$item.VersionInfo.ProductVersion } else { '' }; \
    $$length = if ($$item) { $$item.Length } else { '' }; \
    $$payload = [ordered]@{ schemaVersion = 1; ts = (Get-Date -Format o); session = '$TjuaeUISessionId'; version = '${VERSION}'; arch = '${TJUAEUI_TARGET_ARCH}'; updated = ('$TjuaeUIIsUpdated' -eq '1'); instDir = '$INSTDIR'; event = 'uninstaller-repair'; phase = '${_PHASE}'; path = $$path; exists = [bool]$$item; productVersion = $$version; length = $$length }; \
    Add-Content -LiteralPath $$log -Encoding UTF8 -Value ($$payload | ConvertTo-Json -Compress -Depth 8) \
  }"`
  Pop $TjuaeUIRepairLogResult
!macroend

!macro TJUAEUI_REPAIR_INSTALLED_UNINSTALLER
  Var /GLOBAL TjuaeUIInstalledUninstaller
  Var /GLOBAL TjuaeUIBundledUninstaller
  Var /GLOBAL TjuaeUIRepairLogResult

  !insertmacro TJUAEUI_LOG_UNINSTALLER_REPAIR "before"
  StrCpy $TjuaeUIInstalledUninstaller "$INSTDIR\${UNINSTALL_FILENAME}"

  InitPluginsDir
  StrCpy $TjuaeUIBundledUninstaller "$PLUGINSDIR\TjuaeUI-fixed-uninstaller.exe"
  SetOverwrite on
  File "/oname=$PLUGINSDIR\TjuaeUI-fixed-uninstaller.exe" "${UNINSTALLER_OUT_FILE}"

  ${If} ${FileExists} "$TjuaeUIInstalledUninstaller"
    ClearErrors
    CopyFiles /SILENT "$TjuaeUIBundledUninstaller" "$TjuaeUIInstalledUninstaller"
    ${If} ${Errors}
      !insertmacro TJUAEUI_LOG_UNINSTALLER_REPAIR "copy-failed-retry"
      !insertmacro TJUAEUI_STOP_APP_PROCESSES
      Sleep 1000

      ClearErrors
      CopyFiles /SILENT "$TjuaeUIBundledUninstaller" "$TjuaeUIInstalledUninstaller"
      ${If} ${Errors}
        ${If} ${FileExists} "$TjuaeUIBundledUninstaller"
          !insertmacro TJUAEUI_LOG_UNINSTALLER_REPAIR "copy-failed-using-bundled"
          !insertmacro TJUAEUI_LOG_EVENT "event=uninstaller-repair phase=copy-failed-using-bundled"
        ${Else}
          !insertmacro TJUAEUI_FAIL_BILINGUAL ${TJUAEUI_E_UNINSTALLER_COPY_OR_REBUILD_FAILED} "uninstaller-repair copy-failed-retry-bundled-missing" "${TJUAEUI_MSG_UNINSTALLER_COPY_LOCKED_EN}" "${TJUAEUI_MSG_UNINSTALLER_COPY_LOCKED_ZH}" "${TJUAEUI_MSG_UNINSTALLER_REPAIR_ACTION_EN}" "${TJUAEUI_MSG_UNINSTALLER_REPAIR_ACTION_ZH}"
        ${EndIf}
      ${Else}
        !insertmacro TJUAEUI_LOG_UNINSTALLER_REPAIR "after-copy-retry"
      ${EndIf}
    ${Else}
      !insertmacro TJUAEUI_LOG_UNINSTALLER_REPAIR "after-copy"
    ${EndIf}
  ${Else}
    ClearErrors
    CopyFiles /SILENT "$TjuaeUIBundledUninstaller" "$TjuaeUIInstalledUninstaller"
    ${If} ${Errors}
      !insertmacro TJUAEUI_FAIL_BILINGUAL ${TJUAEUI_E_UNINSTALLER_COPY_OR_REBUILD_FAILED} "uninstaller-repair rebuild-failed" "${TJUAEUI_MSG_UNINSTALLER_REBUILD_FAILED_EN}" "${TJUAEUI_MSG_UNINSTALLER_REBUILD_FAILED_ZH}" "${TJUAEUI_MSG_UNINSTALLER_REPAIR_ACTION_EN}" "${TJUAEUI_MSG_UNINSTALLER_REPAIR_ACTION_ZH}"
    ${EndIf}

    ${IfNot} ${FileExists} "$TjuaeUIInstalledUninstaller"
      !insertmacro TJUAEUI_FAIL_BILINGUAL ${TJUAEUI_E_UNINSTALLER_COPY_OR_REBUILD_FAILED} "uninstaller-repair rebuild-missing-after-copy" "${TJUAEUI_MSG_UNINSTALLER_REBUILD_MISSING_EN}" "${TJUAEUI_MSG_UNINSTALLER_REBUILD_MISSING_ZH}" "${TJUAEUI_MSG_UNINSTALLER_REPAIR_ACTION_EN}" "${TJUAEUI_MSG_UNINSTALLER_REPAIR_ACTION_ZH}"
    ${EndIf}

    !insertmacro TJUAEUI_LOG_UNINSTALLER_REPAIR "rebuilt"
    !insertmacro TJUAEUI_LOG_EVENT "event=uninstaller-repair phase=rebuilt"
  ${EndIf}
!macroend

!macro TJUAEUI_HEAL_INSTALL_REGISTRY
  Var /GLOBAL TjuaeUIRegInstallLocation
  Var /GLOBAL TjuaeUIRegUninstallString
  Var /GLOBAL TjuaeUIRegInstallExe

  StrCpy $TjuaeUIRegistryInstallIsValid "0"

  ReadRegStr $TjuaeUIRegInstallLocation SHCTX "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ReadRegStr $TjuaeUIRegUninstallString SHCTX "${UNINSTALL_REGISTRY_KEY}" "UninstallString"

  ${If} $TjuaeUIRegInstallLocation == ""
    !insertmacro TJUAEUI_LOG_EVENT "event=registry-heal phase=missing-install-location uninstallString=$TjuaeUIRegUninstallString"
    !insertmacro TJUAEUI_CLEAR_INSTALL_REGISTRY "missing-install-location"
  ${Else}
    StrCpy $TjuaeUIRegInstallExe "$TjuaeUIRegInstallLocation\${TJUAEUI_APP_EXECUTABLE_FILENAME}"
    ${If} ${FileExists} "$TjuaeUIRegInstallExe"
      StrCpy $INSTDIR "$TjuaeUIRegInstallLocation"
      StrCpy $TjuaeUIRegistryInstallIsValid "1"
      !insertmacro TJUAEUI_LOG_EVENT "event=registry-heal phase=valid-install-location instDir=$INSTDIR uninstallString=$TjuaeUIRegUninstallString"
    ${Else}
      !insertmacro TJUAEUI_LOG_EVENT "event=registry-heal phase=stale-install-location installLocation=$TjuaeUIRegInstallLocation uninstallString=$TjuaeUIRegUninstallString"
      !insertmacro TJUAEUI_CLEAR_INSTALL_REGISTRY "stale-install-location"
    ${EndIf}
  ${EndIf}
!macroend

!macro TJUAEUI_LOG_UNINSTALL_RESULT _ROOT_KEY _HAD_ERRORS
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$log = '$TjuaeUISessionLogPath'; \
    if (-not $$log) { $$log = Join-Path $$env:TEMP '${TJUAEUI_FALLBACK_LOG}' }; \
    $$payload = [ordered]@{ schemaVersion = 1; ts = (Get-Date -Format o); session = '$TjuaeUISessionId'; version = '${VERSION}'; arch = '${TJUAEUI_TARGET_ARCH}'; updated = ('$TjuaeUIIsUpdated' -eq '1'); instDir = '$INSTDIR'; event = 'uninstall-result'; root = '${_ROOT_KEY}'; launchErrors = '${_HAD_ERRORS}'; exitCode = '$R0' }; \
    Add-Content -LiteralPath $$log -Encoding UTF8 -Value ($$payload | ConvertTo-Json -Compress -Depth 8) \
  }"`
  Pop $TjuaeUIUninstallLogResult
!macroend

!macro TJUAEUI_HANDLE_UNINSTALL_RESULT _ROOT_KEY _LABEL_PREFIX
  ${If} ${Errors}
    StrCpy $TjuaeUIUninstallHadErrors "1"
  ${Else}
    StrCpy $TjuaeUIUninstallHadErrors "0"
  ${EndIf}

  !insertmacro TJUAEUI_LOG_UNINSTALL_RESULT "${_ROOT_KEY}" "$TjuaeUIUninstallHadErrors"

  ${If} $TjuaeUIUninstallHadErrors == "1"
    DetailPrint `Uninstall was not successful. Not able to launch uninstaller!`
    Return
  ${EndIf}

  ${If} $R0 != 0
      DetailPrint `Uninstall was not successful. Uninstaller error code: $R0.`
      !insertmacro TJUAEUI_READ_LAST_INNER_FAILURE
      ${If} $TjuaeUILockerList != ""
        StrCpy $TjuaeUIInnerFailureSummary "- Failure: previous uninstaller failed with exit code $R0$\r$\n- File or folder: $INSTDIR$\r$\n- Blocking process: $TjuaeUILockerList"
      ${EndIf}
      !insertmacro TJUAEUI_LOG_EVENT "event=old-uninstaller-failed action=report exitCode=$R0 lockers=$TjuaeUILockerList uninstallerDetail=$TjuaeUIInnerFailureSummary"
      ${If} $TjuaeUIInnerRootCode != ""
        !insertmacro TJUAEUI_FAIL_ROOTED_BILINGUAL_DIAGNOSTICS "$TjuaeUIInnerRootCode" ${TJUAEUI_E_OLD_UNINSTALL_FAILED} "old-uninstaller exitCode=$R0 lockers=$TjuaeUILockerList uninstallerDetail=$TjuaeUIInnerFailureSummary" "${TJUAEUI_MSG_OLD_UNINSTALL_FAILED_EN}" "${TJUAEUI_MSG_OLD_UNINSTALL_FAILED_ZH}" "${TJUAEUI_MSG_OLD_UNINSTALL_ACTION_EN}" "${TJUAEUI_MSG_OLD_UNINSTALL_ACTION_ZH}" "$TjuaeUIInnerFailureSummary" "$TjuaeUIInnerFailureSummary"
      ${Else}
        !insertmacro TJUAEUI_FAIL_BILINGUAL_DIAGNOSTICS ${TJUAEUI_E_OLD_UNINSTALL_FAILED} "old-uninstaller exitCode=$R0 lockers=$TjuaeUILockerList uninstallerDetail=$TjuaeUIInnerFailureSummary" "${TJUAEUI_MSG_OLD_UNINSTALL_FAILED_EN}" "${TJUAEUI_MSG_OLD_UNINSTALL_FAILED_ZH}" "${TJUAEUI_MSG_OLD_UNINSTALL_ACTION_EN}" "${TJUAEUI_MSG_OLD_UNINSTALL_ACTION_ZH}" "$TjuaeUIInnerFailureSummary" "$TjuaeUIInnerFailureSummary"
      ${EndIf}
  ${EndIf}
!macroend

!macro customInit
  !insertmacro TJUAEUI_HEAL_INSTALL_REGISTRY
  ${If} $TjuaeUIRegistryInstallIsValid == "1"
    !insertmacro TJUAEUI_REPAIR_INSTALLED_UNINSTALLER
  ${EndIf}
!macroend

!macro customUnInstallCheck
  !insertmacro TJUAEUI_HANDLE_UNINSTALL_RESULT "SHELL_CONTEXT" "shctx"
!macroend

!macro customUnInstallCheckCurrentUser
  !insertmacro TJUAEUI_HANDLE_UNINSTALL_RESULT "HKEY_CURRENT_USER" "hkcu"
!macroend

!endif
