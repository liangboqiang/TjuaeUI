!ifndef TJUAEUI_INSTALLER_UPDATE_VERIFY_NSH
!define TJUAEUI_INSTALLER_UPDATE_VERIFY_NSH

Var /GLOBAL TjuaeUIUninstallHadErrors
Var /GLOBAL TjuaeUIUninstallLogResult
Var /GLOBAL TjuaeUIVerifyResourceResult
Var /GLOBAL TjuaeUIUpdatedAppExitWaitResult
Var /GLOBAL TjuaeUIActiveMarkerExecResult
Var /GLOBAL TjuaeUIActiveMarkerResult

!define TJUAEUI_ACTIVE_INSTALLER_MARKER "tjuaeui-installer-active.marker"

!macro TJUAEUI_BRING_UPDATED_INSTALLER_TO_FRONT
  ${If} ${isUpdated}
    BringToFront
    !insertmacro TJUAEUI_SLOG "event=updated-installer-foreground action=bring-to-front"
  ${EndIf}
!macroend

!macro TJUAEUI_WAIT_FOR_UPDATED_APP_EXIT
  ${If} ${isUpdated}
    !insertmacro TJUAEUI_SLOG "event=updated-app-exit-wait phase=start"
    StrCpy $TjuaeUIUpdatedAppExitWaitResult "0"

    nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
      $$ErrorActionPreference = 'SilentlyContinue'; \
      $$deadline = (Get-Date).AddSeconds(10); \
      $$target = [System.IO.Path]::GetFullPath((Join-Path '$INSTDIR' '${TJUAEUI_APP_EXECUTABLE_FILENAME}')); \
      do { \
        $$hits = @(Get-CimInstance -ClassName Win32_Process | Where-Object { \
          $$path = $$_.ExecutablePath; \
          if (-not $$path) { $$path = $$_.Path } \
          $$_.Name -ieq '${TJUAEUI_APP_EXECUTABLE_FILENAME}' -and $$path -and \
          [string]::Equals([System.IO.Path]::GetFullPath($$path), $$target, [System.StringComparison]::CurrentCultureIgnoreCase) \
        }); \
        if ($$hits.Count -eq 0) { exit 0 }; \
        Start-Sleep -Milliseconds 500; \
      } while ((Get-Date) -lt $$deadline); \
      exit 1 \
    }"`
    Pop $TjuaeUIUpdatedAppExitWaitResult

    ${If} $TjuaeUIUpdatedAppExitWaitResult != 0
      !insertmacro TJUAEUI_SLOG "event=updated-app-exit-wait phase=timeout action=stop"
      !insertmacro TJUAEUI_STOP_APP_PROCESSES
    ${EndIf}

    !insertmacro TJUAEUI_SLOG "event=updated-app-exit-wait phase=done result=$TjuaeUIUpdatedAppExitWaitResult"
  ${EndIf}
!macroend

!macro TJUAEUI_RECORD_ACTIVE_INSTALLER_MARKER
  nsExec::ExecToStack `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$marker = Join-Path $$env:TEMP '${TJUAEUI_ACTIVE_INSTALLER_MARKER}'; \
    if (-not (Test-Path -LiteralPath $$marker)) { Write-Output 'missing'; exit 0 }; \
    $$item = Get-Item -LiteralPath $$marker; \
    if ($$item.LastWriteTime -lt (Get-Date).AddHours(-2)) { Write-Output 'stale'; exit 0 }; \
    Write-Output 'active' \
  }"`
  Pop $TjuaeUIActiveMarkerExecResult
  Pop $TjuaeUIActiveMarkerResult
  ${If} $TjuaeUIActiveMarkerResult == "active"
    !insertmacro TJUAEUI_SLOG "event=installer-active-marker state=active"
  ${ElseIf} $TjuaeUIActiveMarkerResult == "stale"
    !insertmacro TJUAEUI_SLOG "event=installer-active-marker state=stale"
  ${Else}
    !insertmacro TJUAEUI_SLOG "event=installer-active-marker state=missing"
  ${EndIf}
!macroend

!macro TJUAEUI_WRITE_ACTIVE_INSTALLER_MARKER
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$marker = Join-Path $$env:TEMP '${TJUAEUI_ACTIVE_INSTALLER_MARKER}'; \
    Set-Content -LiteralPath $$marker -Encoding UTF8 -Value ('pid=' + $$PID + ';session=$TjuaeUISessionId;started=' + (Get-Date -Format o)) \
  }"`
  Pop $TjuaeUIActiveMarkerResult
!macroend

!macro TJUAEUI_CLEAR_ACTIVE_INSTALLER_MARKER
  !ifndef BUILD_UNINSTALLER
    nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
      $$ErrorActionPreference = 'SilentlyContinue'; \
      Remove-Item -LiteralPath (Join-Path $$env:TEMP '${TJUAEUI_ACTIVE_INSTALLER_MARKER}') -Force \
    }"`
    Pop $TjuaeUIActiveMarkerResult
  !endif
!macroend

!macro TJUAEUI_OVERRIDE_SINGLE_INSTANCE
!macroend

!macro TJUAEUI_OVERRIDE_APP_CANNOT_BE_CLOSED_MESSAGE
  !pragma warning disable 6030
  LangString appCannotBeClosed 1033 "${TJUAEUI_MSG_APP_CANNOT_BE_CLOSED_ZH}$\r$\n$\r$\n${TJUAEUI_MSG_BLOCK_SEPARATOR}$\r$\n$\r$\n${TJUAEUI_MSG_APP_CANNOT_BE_CLOSED_EN}"
  LangString appCannotBeClosed 2052 "${TJUAEUI_MSG_APP_CANNOT_BE_CLOSED_ZH}$\r$\n$\r$\n${TJUAEUI_MSG_BLOCK_SEPARATOR}$\r$\n$\r$\n${TJUAEUI_MSG_APP_CANNOT_BE_CLOSED_EN}"
  !pragma warning default 6030
!macroend

!macro TJUAEUI_INSTALLER_CUSTOM_HEADER
  !insertmacro TJUAEUI_OVERRIDE_SINGLE_INSTANCE
  !insertmacro TJUAEUI_OVERRIDE_APP_CANNOT_BE_CLOSED_MESSAGE
!macroend

!macro TJUAEUI_RELEASE_INSTALL_DIR_OUTDIR
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  StrCpy $TjuaeUICurrentOutDir "$PLUGINSDIR"
!macroend

; Resolve the machine's real native architecture (arm64 / x64 / x86) for diagnostics.
; Backed by IsWow64Process2 (via x64.nsh), so it reports the true hardware arch even when
; the installer runs under x86/x64 emulation. Replaces the old hardcoded "non-arm64" detail.
!macro TJUAEUI_DETECT_NATIVE_ARCH _OUT
  ${If} ${IsNativeARM64}
    StrCpy ${_OUT} "arm64"
  ${ElseIf} ${RunningX64}
    StrCpy ${_OUT} "x64"
  ${Else}
    StrCpy ${_OUT} "x86"
  ${EndIf}
!macroend

!macro TJUAEUI_INSTALLER_PREINIT
  !ifdef BUILD_UNINSTALLER
    StrCpy $TjuaeUISessionId ""
    StrCpy $TjuaeUIIsUpdated "0"
    StrCpy $TjuaeUISessionLogResult ""
    StrCpy $TjuaeUISessionLogPath "$TEMP\${TJUAEUI_FALLBACK_LOG}"
    StrCpy $TjuaeUIUninstallHadErrors "0"
    StrCpy $TjuaeUIUninstallLogResult ""
    StrCpy $TjuaeUIVerifyResourceResult ""
    StrCpy $TjuaeUIUpdatedAppExitWaitResult ""
    StrCpy $TjuaeUIActiveMarkerExecResult ""
    StrCpy $TjuaeUIActiveMarkerResult ""
    StrCpy $TjuaeUIStopResult ""
    StrCpy $TjuaeUILockerListZh ""
    StrCpy $TjuaeUILockerListEn ""
  !else
    !insertmacro TJUAEUI_RELEASE_INSTALL_DIR_OUTDIR
    !insertmacro TJUAEUI_SESSION_BEGIN
    !insertmacro TJUAEUI_SLOG "event=installer-outdir-release outDir=$TjuaeUICurrentOutDir instDir=$INSTDIR"
    ; Guard target/machine architecture as early as possible: this runs before customInit's
    ; registry heal/clear/repair, so a wrong-arch installer aborts without mutating an existing
    ; correct-arch install's registry or uninstaller state (code E1040).
    !insertmacro TJUAEUI_ASSERT_TARGET_ARCH
    !insertmacro TJUAEUI_BRING_UPDATED_INSTALLER_TO_FRONT
    !insertmacro TJUAEUI_RECORD_ACTIVE_INSTALLER_MARKER
    !insertmacro TJUAEUI_WRITE_ACTIVE_INSTALLER_MARKER
  !endif
!macroend

!macro TJUAEUI_VERIFY_REQUIRED_FILE _PATH _LABEL
  ${IfNot} ${FileExists} "${_PATH}"
    !insertmacro TJUAEUI_LOG_EVENT "verify-required-file missing label=${_LABEL} path=${_PATH}"
    !insertmacro TJUAEUI_FAIL_UX \
      "${TJUAEUI_E_CORE_APP_FILES_INCOMPLETE}" \
      "verify-required-file missing label=${_LABEL} path=${_PATH}" \
      "${TJUAEUI_MSG_VERIFY_REQUIRED_FILE_ZH} ${_LABEL}" \
      "${TJUAEUI_MSG_VERIFY_REQUIRED_FILE_EN} ${_LABEL}" \
      "${TJUAEUI_MSG_VERIFY_REQUIRED_FILE_ACTION_ZH}" \
      "${TJUAEUI_MSG_VERIFY_REQUIRED_FILE_ACTION_EN}" \
      "verify-required-file missing label=${_LABEL} path=${_PATH}" \
      "verify-required-file missing label=${_LABEL} path=${_PATH}"
  ${Else}
    !insertmacro TJUAEUI_LOG_EVENT "verify-required-file ok label=${_LABEL} path=${_PATH}"
  ${EndIf}
!macroend

!macro TJUAEUI_VERIFY_CORE_APP_FILES
  !insertmacro TJUAEUI_LOG_EVENT "verify-install start instDir=$INSTDIR"
  !insertmacro TJUAEUI_VERIFY_REQUIRED_FILE "$INSTDIR\TjuaeUI.exe" "TjuaeUI.exe"
  !insertmacro TJUAEUI_VERIFY_REQUIRED_FILE "$INSTDIR\ffmpeg.dll" "ffmpeg.dll"
  !insertmacro TJUAEUI_VERIFY_REQUIRED_FILE "$INSTDIR\libEGL.dll" "libEGL.dll"
  !insertmacro TJUAEUI_VERIFY_REQUIRED_FILE "$INSTDIR\libGLESv2.dll" "libGLESv2.dll"
  !insertmacro TJUAEUI_VERIFY_REQUIRED_FILE "$INSTDIR\d3dcompiler_47.dll" "d3dcompiler_47.dll"
  !insertmacro TJUAEUI_VERIFY_REQUIRED_FILE "$INSTDIR\dxcompiler.dll" "dxcompiler.dll"
  !insertmacro TJUAEUI_VERIFY_REQUIRED_FILE "$INSTDIR\dxil.dll" "dxil.dll"
  !insertmacro TJUAEUI_VERIFY_REQUIRED_FILE "$INSTDIR\vk_swiftshader.dll" "vk_swiftshader.dll"
  !insertmacro TJUAEUI_VERIFY_REQUIRED_FILE "$INSTDIR\vulkan-1.dll" "vulkan-1.dll"
  !insertmacro TJUAEUI_VERIFY_REQUIRED_FILE "$INSTDIR\resources\app.asar" "resources\app.asar"
!macroend

!macro TJUAEUI_VERIFY_BUNDLED_TJUAECORE_RESOURCES _RUNTIME_KEY
  InitPluginsDir
  File "/oname=$PLUGINSDIR\verify-bundled-tjuaecore-install.ps1" "${PROJECT_DIR}\resources\windows\support\verify-bundled-tjuaecore-install.ps1"
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\verify-bundled-tjuaecore-install.ps1" -InstallDir "$INSTDIR" -RuntimeKey "${_RUNTIME_KEY}" -LogPath "$TjuaeUISessionLogPath"`
  Pop $TjuaeUIVerifyResourceResult

  ${If} $TjuaeUIVerifyResourceResult != 0
    !insertmacro TJUAEUI_FAIL_UX \
      "${TJUAEUI_E_BUNDLED_TJUAECORE_INCOMPLETE}" \
      "event=session-end result=fail code=${TJUAEUI_E_BUNDLED_TJUAECORE_INCOMPLETE} detail=bundled-tjuaecore-incomplete runtime=${_RUNTIME_KEY} result=$TjuaeUIVerifyResourceResult" \
      "${TJUAEUI_MSG_BUNDLED_TJUAECORE_INCOMPLETE_ZH}" \
      "${TJUAEUI_MSG_BUNDLED_TJUAECORE_INCOMPLETE_EN}" \
      "${TJUAEUI_MSG_BUNDLED_TJUAECORE_INCOMPLETE_ACTION_ZH}" \
      "${TJUAEUI_MSG_BUNDLED_TJUAECORE_INCOMPLETE_ACTION_EN}" \
      "bundled-tjuaecore-incomplete runtime=${_RUNTIME_KEY} result=$TjuaeUIVerifyResourceResult instDir=$INSTDIR" \
      "bundled-tjuaecore-incomplete runtime=${_RUNTIME_KEY} result=$TjuaeUIVerifyResourceResult instDir=$INSTDIR"
  ${EndIf}
!macroend

!macro customInstall
  !insertmacro TJUAEUI_VERIFY_CORE_APP_FILES
  !insertmacro TJUAEUI_VERIFY_BUNDLED_TJUAECORE_RESOURCES "${TJUAEUI_RUNTIME_KEY}"
  !insertmacro TJUAEUI_LOG_EVENT "verify-install ok instDir=$INSTDIR"
  !insertmacro TJUAEUI_CLEAR_ACTIVE_INSTALLER_MARKER
  !insertmacro TJUAEUI_SESSION_SUCCESS
!macroend

!endif
