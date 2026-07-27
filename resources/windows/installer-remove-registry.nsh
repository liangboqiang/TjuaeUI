!ifndef TJUAEUI_INSTALLER_REMOVE_REGISTRY_NSH
!define TJUAEUI_INSTALLER_REMOVE_REGISTRY_NSH

!macro TJUAEUI_CLEAR_INSTALL_REGISTRY _REASON
  DeleteRegKey SHCTX "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey SHCTX "${INSTALL_REGISTRY_KEY}"
  !insertmacro TJUAEUI_LOG_EVENT "event=registry-clear reason=${_REASON} uninstallKey=${UNINSTALL_REGISTRY_KEY} installKey=${INSTALL_REGISTRY_KEY}"
!macroend

!macro TJUAEUI_LOG_ATOMIC_REMOVE_FAILURE
  Push $9
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$log = '$TjuaeUISessionLogPath'; \
    if (-not $$log) { $$log = Join-Path $$env:TEMP '${TJUAEUI_FALLBACK_LOG}' }; \
    $$failed = '$TjuaeUIAtomicFailedPath'; \
    $$instDir = '$INSTDIR'; \
    $$oldInstallDir = '$TjuaeUIAtomicStagingDir'; \
    $$relative = $$failed; \
    if ($$failed.StartsWith($$instDir, [System.StringComparison]::CurrentCultureIgnoreCase)) { $$relative = $$failed.Substring($$instDir.Length).TrimStart('\') }; \
    $$tempCandidate = if ($$relative -and $$relative -ne $$failed) { Join-Path $$oldInstallDir $$relative } else { '' }; \
    $$kind = if ($$tempCandidate.Length -ge 260) { 'likely-long-path' } else { 'unknown' }; \
    $$payload = [ordered]@{ schemaVersion = 1; ts = (Get-Date -Format o); session = '$TjuaeUISessionId'; version = '${VERSION}'; arch = '${TJUAEUI_TARGET_ARCH}'; updated = ('$TjuaeUIIsUpdated' -eq '1'); instDir = '$INSTDIR'; event = 'remove-atomic-failed'; kind = $$kind; pathLength = $$failed.Length; tempCandidateLength = $$tempCandidate.Length; atomicFailedPath = $$failed; tempCandidate = $$tempCandidate }; \
    Add-Content -LiteralPath $$log -Encoding UTF8 -Value ($$payload | ConvertTo-Json -Compress -Depth 8) \
  }"`
  Pop $9
  Pop $9
!macroend

!macro TJUAEUI_LOG_REMOVE_FAILURE_JSON _PHASE _FATAL _FAILED_PATH _EXTRA_FIELDS
  !insertmacro TJUAEUI_LOG_JSON_EVENT "failure" "$$lockerText = '$TjuaeUILockerList'; $$processes = @(); if ($$lockerText -and $$lockerText -notlike 'Windows did not identify*' -and $$lockerText -ne 'unknown process') { $$processes = @($$lockerText -split ',\s*' | Where-Object { $$_ } | ForEach-Object { if ($$_ -match '^(.*)\(([0-9]+)\)$$') { [ordered]@{ name = $$Matches[1]; pid = [int]$$Matches[2] } } else { [ordered]@{ name = $$_; pid = $$null } } }) }; $$payload.code = '${TJUAEUI_E_INSTALL_DIR_REMOVE_OR_LOCKED}'; $$payload.phase = '${_PHASE}'; $$payload.failedPath = '${_FAILED_PATH}'; $$payload.blockingProcesses = @($$processes); if ($$lockerText -like 'TjuaeUI installer(*)') { $$payload.fallbackReason = 'installer-self-lock'; $$payload.message = 'The installer process is using the install directory as its current output directory.' } elseif ($$processes.Count -eq 0) { $$payload.fallbackReason = 'restart-manager-no-process'; $$payload.message = 'Windows did not identify a specific locking process. Close terminals, editors, and file managers opened in the install folder.' } else { $$payload.fallbackReason = ''; $$payload.message = '' }; $$payload.fatal = ('${_FATAL}' -eq '1'); ${_EXTRA_FIELDS}"
!macroend

!macro TJUAEUI_REMOVE_INSTALL_DIR
  StrCpy $TjuaeUIRemoveResidueCount "0"
  ${If} $TjuaeUIRemoveResidueRoot == ""
    StrCpy $TjuaeUIRemoveResidueRoot "$INSTDIR"
  ${EndIf}
  StrCpy $TjuaeUIRemoveFirstFailedPath ""
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'Continue'; \
    $$log = '$TjuaeUISessionLogPath'; \
    if (-not $$log) { $$log = Join-Path $$env:TEMP '${TJUAEUI_FALLBACK_LOG}' }; \
    $$path = [System.IO.Path]::GetFullPath('$TjuaeUIRemoveResidueRoot'); \
    $$firstFailedFile = '$PLUGINSDIR\tjuaeui-remove-first-failed.txt'; \
    Set-Content -LiteralPath $$firstFailedFile -Encoding UTF8 -NoNewline -Value ''; \
    function Write-InstallerLog($$message) { $$payload = [ordered]@{ schemaVersion = 1; ts = (Get-Date -Format o); session = '$TjuaeUISessionId'; version = '${VERSION}'; arch = '${TJUAEUI_TARGET_ARCH}'; updated = ('$TjuaeUIIsUpdated' -eq '1'); instDir = '$INSTDIR'; event = 'remove-log'; message = $$message }; if ($$message -match '(^|\s)event=([^\s]+)') { $$payload.event = $$Matches[2] }; Add-Content -LiteralPath $$log -Encoding UTF8 -Value ($$payload | ConvertTo-Json -Compress -Depth 8) } \
    function Convert-LongPath($$itemPath) { if ($$itemPath.StartsWith('\\')) { return '\\?\UNC\' + $$itemPath.TrimStart('\') } return '\\?\' + $$itemPath } \
    function Remove-WithRetries($$item, $$isDir) { \
      $$delays = @(200,500,1000); \
      for ($$i = 0; $$i -lt $$delays.Count; $$i++) { \
        try { \
          if ($$isDir) { [System.IO.Directory]::Delete((Convert-LongPath $$item), $$false) } else { [System.IO.File]::Delete((Convert-LongPath $$item)) } \
          return $$true \
        } catch { \
          if ($$i -lt $$delays.Count - 1) { Start-Sleep -Milliseconds $$delays[$$i] } else { Write-InstallerLog ('event=remove-resilient-leftover path=' + $$item + ' attempts=3 error=' + $$_.Exception.GetType().FullName + ': ' + $$_.Exception.Message); return $$false } \
        } \
      } \
      return $$false \
    } \
    try { \
      if (-not (Test-Path -LiteralPath $$path)) { Write-InstallerLog ('remove-longpath result=0 instDir=' + $$path); exit 0 } \
      $$failed = New-Object System.Collections.Generic.List[string]; \
      foreach ($$file in @(Get-ChildItem -LiteralPath $$path -Force -Recurse -File -ErrorAction SilentlyContinue | Sort-Object FullName -Descending)) { if (-not (Remove-WithRetries $$file.FullName $$false)) { $$failed.Add($$file.FullName) } } \
      foreach ($$dir in @(Get-ChildItem -LiteralPath $$path -Force -Recurse -Directory -ErrorAction SilentlyContinue | Sort-Object FullName -Descending)) { if (-not (Remove-WithRetries $$dir.FullName $$true)) { $$failed.Add($$dir.FullName) } } \
      if (-not (Remove-WithRetries $$path $$true)) { $$failed.Add($$path) } \
      Write-InstallerLog ('event=remove-resilient-summary failedCount=' + $$failed.Count + ' root=' + $$path); \
      if ($$failed.Count -gt 0) { Set-Content -LiteralPath $$firstFailedFile -Encoding UTF8 -NoNewline -Value $$failed[0]; exit $$failed.Count } \
      Write-InstallerLog ('remove-longpath result=0 instDir=' + $$path); \
      exit 0 \
    } catch { \
      Write-InstallerLog ('remove-longpath result=1 instDir=' + $$path + ' error=' + $$_.Exception.GetType().FullName + ': ' + $$_.Exception.Message); \
      exit 1 \
    } \
  }"`
  Pop $TjuaeUIRemoveDirResult

  ClearErrors
  SetDetailsPrint none
  FileOpen $TjuaeUIRemoveFirstFailedFile "$PLUGINSDIR\tjuaeui-remove-first-failed.txt" r
  ${IfNot} ${Errors}
    FileRead $TjuaeUIRemoveFirstFailedFile $TjuaeUIRemoveFirstFailedPath
    FileClose $TjuaeUIRemoveFirstFailedFile
  ${EndIf}
  SetDetailsPrint lastused

  ${If} $TjuaeUIRemoveDirResult == "error"
    !insertmacro TJUAEUI_LOG_EVENT "event=remove-longpath fallback=RMDir reason=no-powershell root=$INSTDIR"
    RMDir /r "$TjuaeUIRemoveResidueRoot"
    ${If} ${FileExists} "$TjuaeUIRemoveResidueRoot\*.*"
      StrCpy $TjuaeUIRemoveDirResult "1"
    ${Else}
      StrCpy $TjuaeUIRemoveDirResult "0"
    ${EndIf}
  ${EndIf}

  ${If} $TjuaeUIRemoveDirResult != 0
    StrCpy $TjuaeUIRemoveResidueCount $TjuaeUIRemoveDirResult
  ${EndIf}
!macroend

!macro customRemoveFiles
  !insertmacro TJUAEUI_LOG_EVENT "remove-start instDir=$INSTDIR"
  Var /GLOBAL TjuaeUIRemoveDirResult
  Var /GLOBAL TjuaeUIAtomicFailedPath
  Var /GLOBAL TjuaeUIAtomicRemoveSucceeded
  Var /GLOBAL TjuaeUIAtomicStagingDir
  Var /GLOBAL TjuaeUIRemoveResidueCount
  Var /GLOBAL TjuaeUIRemoveResidueRoot
  Var /GLOBAL TjuaeUIRemoveFirstFailedPath
  Var /GLOBAL TjuaeUIRemoveFirstFailedFile
  StrCpy $TjuaeUIAtomicFailedPath ""
  StrCpy $TjuaeUIAtomicRemoveSucceeded "0"
  StrCpy $TjuaeUIAtomicStagingDir ""
  StrCpy $TjuaeUIRemoveResidueCount "0"
  StrCpy $TjuaeUIRemoveResidueRoot "$INSTDIR"
  StrCpy $TjuaeUIRemoveFirstFailedPath ""

  SetOutPath $TEMP
  StrCpy $TjuaeUICurrentOutDir "$TEMP"

  ${if} ${isUpdated}
    StrCpy $TjuaeUIAtomicStagingDir "$INSTDIR.__old"
    ${If} ${FileExists} "$TjuaeUIAtomicStagingDir\*.*"
      StrCpy $TjuaeUIRemoveResidueRoot "$TjuaeUIAtomicStagingDir"
      !insertmacro TJUAEUI_LOG_EVENT "remove-stale-staging start root=$TjuaeUIRemoveResidueRoot"
      !insertmacro TJUAEUI_REMOVE_INSTALL_DIR
      StrCpy $TjuaeUIRemoveResidueRoot "$INSTDIR"
    ${EndIf}

    tjuaeui_retry_atomic_rename:
      ClearErrors
      Rename "$INSTDIR" "$TjuaeUIAtomicStagingDir"
    ${if} ${Errors}
      DetailPrint "Atomic update cleanup failed before replacing previous installation: $INSTDIR"
      StrCpy $TjuaeUIAtomicFailedPath "$INSTDIR"
      !insertmacro TJUAEUI_LOG_ATOMIC_REMOVE_FAILURE
      !insertmacro TJUAEUI_CAPTURE_FAILED_PATH_LOCKERS "$TjuaeUIAtomicFailedPath"
      ${IfNot} ${Silent}
        !insertmacro TJUAEUI_PROMPT_FAILED_PATH_LOCKERS "$TjuaeUIAtomicFailedPath" "atomic-failed" tjuaeui_retry_atomic_rename tjuaeui_cancel_atomic_rename tjuaeui_continue_atomic_failed
        tjuaeui_cancel_atomic_rename:
      ${EndIf}
      tjuaeui_continue_atomic_failed:
      !insertmacro TJUAEUI_LOG_REMOVE_FAILURE_JSON "atomic-failed" "1" "$TjuaeUIAtomicFailedPath" "$$payload.atomicFailedPath = '$TjuaeUIAtomicFailedPath'"
      !insertmacro TJUAEUI_LOG_EVENT "code=${TJUAEUI_E_INSTALL_DIR_REMOVE_OR_LOCKED} phase=atomic-failed fatal=1 degraded=none firstFailed=$TjuaeUIAtomicFailedPath atomicFailedPath=$TjuaeUIAtomicFailedPath"
      !insertmacro TJUAEUI_CLEAR_INSTALL_REGISTRY "remove-failed-before-quit"
      !insertmacro TJUAEUI_FAIL_BILINGUAL ${TJUAEUI_E_INSTALL_DIR_REMOVE_OR_LOCKED} "event=session-end result=fail code=${TJUAEUI_E_INSTALL_DIR_REMOVE_OR_LOCKED} phase=atomic-failed fatal=1 firstFailed=$TjuaeUIAtomicFailedPath lockers=$TjuaeUILockerList" "${TJUAEUI_MSG_REPLACE_LOCKED_EN}" "${TJUAEUI_MSG_REPLACE_LOCKED_ZH}" "${TJUAEUI_MSG_CLOSE_SHOWN_FILE_ACTION_EN}" "${TJUAEUI_MSG_CLOSE_SHOWN_FILE_ACTION_ZH}"
    ${else}
      !insertmacro TJUAEUI_LOG_EVENT "remove-atomic result=0 staging=$TjuaeUIAtomicStagingDir"
      StrCpy $TjuaeUIAtomicRemoveSucceeded "1"
      StrCpy $TjuaeUIRemoveResidueRoot "$TjuaeUIAtomicStagingDir"
    ${endif}
  ${endif}

  tjuaeui_retry_remove_install_dir:
    !insertmacro TJUAEUI_REMOVE_INSTALL_DIR
  ${if} $TjuaeUIRemoveDirResult != 0
    !insertmacro TJUAEUI_CAPTURE_FAILED_PATH_LOCKERS "$TjuaeUIRemoveFirstFailedPath"
    ${if} $TjuaeUIAtomicRemoveSucceeded == "1"
      ${IfNot} ${Silent}
        !insertmacro TJUAEUI_PROMPT_FAILED_PATH_LOCKERS "$TjuaeUIRemoveFirstFailedPath" "residual-delete-failed" tjuaeui_retry_remove_install_dir tjuaeui_cancel_remove_after_rm tjuaeui_continue_after_rm
        tjuaeui_cancel_remove_after_rm:
          !insertmacro TJUAEUI_LOG_REMOVE_FAILURE_JSON "residual-delete-failed" "1" "$TjuaeUIRemoveFirstFailedPath" "$$payload.residueRoot = '$TjuaeUIRemoveResidueRoot'; $$payload.failedCount = '$TjuaeUIRemoveResidueCount'; $$payload.removeDirResult = '$TjuaeUIRemoveDirResult'; $$payload.atomicSucceeded = ('$TjuaeUIAtomicRemoveSucceeded' -eq '1')"
          !insertmacro TJUAEUI_LOG_EVENT "code=${TJUAEUI_E_INSTALL_DIR_REMOVE_OR_LOCKED} phase=residual-delete-failed userAction=cancel fatal=1 residueRoot=$TjuaeUIRemoveResidueRoot failedCount=$TjuaeUIRemoveResidueCount firstFailed=$TjuaeUIRemoveFirstFailedPath removeDirResult=$TjuaeUIRemoveDirResult removeResidueCount=$TjuaeUIRemoveResidueCount atomicFailedPath=$TjuaeUIAtomicFailedPath atomicSucceeded=$TjuaeUIAtomicRemoveSucceeded"
          !insertmacro TJUAEUI_FAIL_BILINGUAL ${TJUAEUI_E_INSTALL_DIR_REMOVE_OR_LOCKED} "event=session-end result=fail code=${TJUAEUI_E_INSTALL_DIR_REMOVE_OR_LOCKED} phase=residual-delete-failed userAction=cancel fatal=1 firstFailed=$TjuaeUIRemoveFirstFailedPath lockers=$TjuaeUILockerList" "${TJUAEUI_MSG_PREVIOUS_FILE_OPEN_EN}" "${TJUAEUI_MSG_PREVIOUS_FILE_OPEN_ZH}" "${TJUAEUI_MSG_CLOSE_SHOWN_FILE_ACTION_EN}" "${TJUAEUI_MSG_CLOSE_SHOWN_FILE_ACTION_ZH}"
      ${EndIf}
      tjuaeui_continue_after_rm:
      DetailPrint `TjuaeUI previous installation had locked residual files; continuing after atomic cleanup succeeded: $INSTDIR`
      !insertmacro TJUAEUI_LOG_EVENT "code=${TJUAEUI_E_INSTALL_DIR_REMOVE_OR_LOCKED} phase=residual-delete-failed degraded=continue fatal=0 residueRoot=$TjuaeUIRemoveResidueRoot failedCount=$TjuaeUIRemoveResidueCount firstFailed=$TjuaeUIRemoveFirstFailedPath removeDirResult=$TjuaeUIRemoveDirResult removeResidueCount=$TjuaeUIRemoveResidueCount atomicFailedPath=$TjuaeUIAtomicFailedPath atomicSucceeded=$TjuaeUIAtomicRemoveSucceeded"
    ${else}
      DetailPrint `Can't safely remove previous installation without atomic cleanup proof: $INSTDIR`
      ${IfNot} ${Silent}
        !insertmacro TJUAEUI_PROMPT_FAILED_PATH_LOCKERS "$TjuaeUIRemoveFirstFailedPath" "residual-delete-failed-no-atomic-proof" tjuaeui_retry_remove_install_dir tjuaeui_cancel_remove_no_atomic tjuaeui_continue_remove_no_atomic
        tjuaeui_cancel_remove_no_atomic:
      ${EndIf}
      tjuaeui_continue_remove_no_atomic:
      !insertmacro TJUAEUI_LOG_REMOVE_FAILURE_JSON "residual-delete-failed-no-atomic-proof" "1" "$TjuaeUIRemoveFirstFailedPath" "$$payload.residueRoot = '$TjuaeUIRemoveResidueRoot'; $$payload.failedCount = '$TjuaeUIRemoveResidueCount'; $$payload.removeDirResult = '$TjuaeUIRemoveDirResult'; $$payload.atomicSucceeded = ('$TjuaeUIAtomicRemoveSucceeded' -eq '1')"
      !insertmacro TJUAEUI_LOG_EVENT "code=${TJUAEUI_E_INSTALL_DIR_REMOVE_OR_LOCKED} phase=residual-delete-failed-no-atomic-proof degraded=none fatal=1 residueRoot=$TjuaeUIRemoveResidueRoot failedCount=$TjuaeUIRemoveResidueCount firstFailed=$TjuaeUIRemoveFirstFailedPath removeDirResult=$TjuaeUIRemoveDirResult removeResidueCount=$TjuaeUIRemoveResidueCount atomicFailedPath=$TjuaeUIAtomicFailedPath atomicSucceeded=$TjuaeUIAtomicRemoveSucceeded"
      !insertmacro TJUAEUI_CLEAR_INSTALL_REGISTRY "remove-failed-before-quit"
      !insertmacro TJUAEUI_FAIL_BILINGUAL ${TJUAEUI_E_INSTALL_DIR_REMOVE_OR_LOCKED} "event=session-end result=fail code=${TJUAEUI_E_INSTALL_DIR_REMOVE_OR_LOCKED} phase=residual-delete-failed-no-atomic-proof fatal=1 firstFailed=$TjuaeUIRemoveFirstFailedPath removeDirResult=$TjuaeUIRemoveDirResult lockers=$TjuaeUILockerList" "${TJUAEUI_MSG_REMOVE_PREVIOUS_DIR_EN}" "${TJUAEUI_MSG_REMOVE_PREVIOUS_DIR_ZH}" "${TJUAEUI_MSG_CLOSE_INSTALL_DIR_ACTION_EN}" "${TJUAEUI_MSG_CLOSE_INSTALL_DIR_ACTION_ZH}"
    ${endif}
  ${else}
    !insertmacro TJUAEUI_LOG_EVENT "remove-final errors=0 instDir=$INSTDIR removeDirResult=$TjuaeUIRemoveDirResult removeResidueCount=$TjuaeUIRemoveResidueCount removeResidueRoot=$TjuaeUIRemoveResidueRoot atomicFailedPath=$TjuaeUIAtomicFailedPath atomicSucceeded=$TjuaeUIAtomicRemoveSucceeded"
  ${endif}
!macroend

!macro customUnInit
  !insertmacro TJUAEUI_LOG_EVENT "uninit instDir=$INSTDIR"
!macroend

!macro customUnInstall
  !insertmacro TJUAEUI_LOG_EVENT "uninstall-section start instDir=$INSTDIR"
!macroend

!endif
