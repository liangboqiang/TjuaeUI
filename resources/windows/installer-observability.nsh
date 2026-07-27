!ifndef TJUAEUI_INSTALLER_OBSERVABILITY_NSH
!define TJUAEUI_INSTALLER_OBSERVABILITY_NSH

!define TJUAEUI_APP_EXECUTABLE_FILENAME "TjuaeUI.exe"
!define TJUAEUI_FALLBACK_LOG "tjuaeui-installer-${VERSION}-fallback-log.jsonl"

!pragma warning disable 6001
Var /GLOBAL TjuaeUISessionId
Var /GLOBAL TjuaeUIIsUpdated
Var /GLOBAL TjuaeUISessionLogResult
Var /GLOBAL TjuaeUISessionLogPath

!macro TJUAEUI_SESSION_HEADER
  !insertmacro TJUAEUI_SLOG "event=header arch=${TJUAEUI_TARGET_ARCH} updated=$TjuaeUIIsUpdated instDir=$INSTDIR version=${VERSION} log=$TjuaeUISessionLogPath detail=customHeader"
!macroend

!macro TJUAEUI_SLOG _MESSAGE
  Push $9
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$log = '$TjuaeUISessionLogPath'; \
    if (-not $$log) { $$log = Join-Path $$env:TEMP '${TJUAEUI_FALLBACK_LOG}' }; \
    $$session = '$TjuaeUISessionId'; \
    if (-not $$session) { $$session = 'uninitialized' }; \
    $$message = '${_MESSAGE}'; \
    $$event = 'log'; \
    if ($$message -match '(^|\s)event=([^\s]+)') { $$event = $$Matches[2] } else { $$first = @($$message -split '\s+', 2)[0]; if ($$first -and $$first -notmatch '=') { $$event = $$first } }; \
    $$payload = [ordered]@{ schemaVersion = 1; ts = (Get-Date -Format o); session = $$session; version = '${VERSION}'; arch = '${TJUAEUI_TARGET_ARCH}'; updated = ('$TjuaeUIIsUpdated' -eq '1'); instDir = '$INSTDIR'; event = $$event; message = $$message }; \
    $$json = $$payload | ConvertTo-Json -Compress -Depth 8; \
    Add-Content -LiteralPath $$log -Encoding UTF8 -Value $$json \
  }"`
  Pop $9
  Pop $9
!macroend

!macro TJUAEUI_LOG_EVENT _MESSAGE
  Push $9
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$log = '$TjuaeUISessionLogPath'; \
    if (-not $$log) { $$log = Join-Path $$env:TEMP '${TJUAEUI_FALLBACK_LOG}' }; \
    $$session = '$TjuaeUISessionId'; \
    if (-not $$session) { $$session = 'uninitialized' }; \
    $$message = '${_MESSAGE}'; \
    $$event = 'log'; \
    if ($$message -match '(^|\s)event=([^\s]+)') { $$event = $$Matches[2] } else { $$first = @($$message -split '\s+', 2)[0]; if ($$first -and $$first -notmatch '=') { $$event = $$first } }; \
    $$payload = [ordered]@{ schemaVersion = 1; ts = (Get-Date -Format o); session = $$session; version = '${VERSION}'; arch = '${TJUAEUI_TARGET_ARCH}'; updated = ('$TjuaeUIIsUpdated' -eq '1'); instDir = '$INSTDIR'; event = $$event; message = $$message }; \
    $$json = $$payload | ConvertTo-Json -Compress -Depth 8; \
    Add-Content -LiteralPath $$log -Encoding UTF8 -Value $$json \
  }"`
  Pop $9
  Pop $9
!macroend

!macro TJUAEUI_LOG_JSON_EVENT _EVENT _JSON_FIELDS
  Push $9
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$log = '$TjuaeUISessionLogPath'; \
    if (-not $$log) { $$log = Join-Path $$env:TEMP '${TJUAEUI_FALLBACK_LOG}' }; \
    $$session = '$TjuaeUISessionId'; \
    if (-not $$session) { $$session = 'uninitialized' }; \
    $$payload = [ordered]@{ schemaVersion = 1; ts = (Get-Date -Format o); session = $$session; version = '${VERSION}'; arch = '${TJUAEUI_TARGET_ARCH}'; updated = ('$TjuaeUIIsUpdated' -eq '1'); instDir = '$INSTDIR'; event = '${_EVENT}' }; \
    ${_JSON_FIELDS}; \
    $$json = $$payload | ConvertTo-Json -Compress -Depth 8; \
    Add-Content -LiteralPath $$log -Encoding UTF8 -Value $$json \
  }"`
  Pop $9
  Pop $9
!macroend

!macro TJUAEUI_SESSION_BEGIN
  ${GetParameters} $R9
  ClearErrors
  ${GetOptions} $R9 "--installer-log=" $R8
  ${IfNot} ${Errors}
    StrCpy $TjuaeUISessionLogPath $R8
  ${EndIf}
  ClearErrors
  ${GetOptions} $R9 "--installer-session=" $R8
  ${IfNot} ${Errors}
    StrCpy $TjuaeUISessionId $R8
  ${EndIf}

  ${If} $TjuaeUISessionLogPath == ""
    nsExec::ExecToStack `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$$id = '$TjuaeUISessionId'; if (-not $$id) { $$id = [guid]::NewGuid().ToString('N').Substring(0,12) }; $$stamp = Get-Date -Format 'yyyyMMdd'; $$name = 'tjuaeui-installer-${VERSION}-' + $$stamp + '-log.jsonl'; $$log = Join-Path $$env:TEMP $$name; [Console]::Out.Write($$id + '|' + $$log)"`
    Pop $TjuaeUISessionLogResult
    Pop $TjuaeUISessionLogResult
    StrCpy $TjuaeUISessionId $TjuaeUISessionLogResult 12
    StrCpy $TjuaeUISessionLogPath $TjuaeUISessionLogResult 1024 13
  ${ElseIf} $TjuaeUISessionId == ""
    nsExec::ExecToStack `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "[Console]::Out.Write([guid]::NewGuid().ToString('N').Substring(0,12))"`
    Pop $TjuaeUISessionLogResult
    Pop $TjuaeUISessionLogResult
    StrCpy $TjuaeUISessionId $TjuaeUISessionLogResult
  ${EndIf}

  ClearErrors
  ${GetOptions} $R9 "--updated" $R8
  StrCpy $TjuaeUIIsUpdated "0"
  ${IfNot} ${Errors}
    StrCpy $TjuaeUIIsUpdated "1"
  ${EndIf}

  !insertmacro TJUAEUI_SLOG "event=session-begin detail=preInit"
!macroend

!macro TJUAEUI_LOG_EXTRACT_RESULT _METHOD
  ${IfNot} ${FileExists} "$INSTDIR\TjuaeUI.exe"
    !insertmacro TJUAEUI_FAIL_UX \
      "${TJUAEUI_E_EXTRACT_FAILED}" \
      "event=extract result=fail method=${_METHOD} missing=TjuaeUI.exe" \
      "${TJUAEUI_MSG_EXTRACT_FAILED_ZH}" \
      "${TJUAEUI_MSG_EXTRACT_FAILED_EN}" \
      "${TJUAEUI_MSG_EXTRACT_FAILED_ACTION_ZH}" \
      "${TJUAEUI_MSG_EXTRACT_FAILED_ACTION_EN}" \
      "extract result=fail method=${_METHOD} missing=TjuaeUI.exe instDir=$INSTDIR" \
      "extract result=fail method=${_METHOD} missing=TjuaeUI.exe instDir=$INSTDIR"
  ${Else}
    !insertmacro TJUAEUI_SLOG "event=extract result=ok method=${_METHOD} detail=customFiles_${TJUAEUI_TARGET_ARCH}"
  ${EndIf}
!macroend

!macro TJUAEUI_SESSION_SUCCESS
  !insertmacro TJUAEUI_SLOG "event=session-end result=success detail=customInstall"
!macroend

!endif
