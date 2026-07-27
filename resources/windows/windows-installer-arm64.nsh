; ARM64 architecture entry for the NSIS installer.

!include "x64.nsh"

!define TJUAEUI_TARGET_ARCH "arm64"
!define TJUAEUI_RUNTIME_KEY "win32-arm64"
!define TJUAEUI_EXTRACT_METHOD "zip"

!addincludedir "${PROJECT_DIR}\resources\windows"
!include "installer-common.nsh"

!macro customHeader
  !insertmacro TJUAEUI_INSTALLER_CUSTOM_HEADER
!macroend

!macro preInit
  !insertmacro TJUAEUI_INSTALLER_PREINIT
!macroend

!macro customFiles_arm64
  !insertmacro TJUAEUI_LOG_EXTRACT_RESULT "zip"
!macroend

; Architecture guard. Inserted from TJUAEUI_INSTALLER_PREINIT (preInit) so it runs before any
; registry mutation, replacing the old .onVerifyInstDir placement which fired after customInit
; had already healed, cleared, or repaired an existing install's registry.
!macro TJUAEUI_ASSERT_TARGET_ARCH
  Var /GLOBAL TjuaeUIActualArch
  ${IfNot} ${IsNativeARM64}
    !insertmacro TJUAEUI_DETECT_NATIVE_ARCH $TjuaeUIActualArch
    !insertmacro TJUAEUI_FAIL_UX \
      "${TJUAEUI_E_ARCH_MISMATCH}" \
      "target=arm64 actual=$TjuaeUIActualArch" \
      "${TJUAEUI_MSG_ARCH_MISMATCH_ZH}" \
      "${TJUAEUI_MSG_ARCH_MISMATCH_EN}" \
      "${TJUAEUI_MSG_ARCH_MISMATCH_ACTION_ZH}" \
      "${TJUAEUI_MSG_ARCH_MISMATCH_ACTION_EN}" \
      "target=arm64 actual=$TjuaeUIActualArch" \
      "target=arm64 actual=$TjuaeUIActualArch"
  ${EndIf}
!macroend
