; x64 architecture entry for the NSIS installer.

!include "x64.nsh"

!define TJUAEUI_TARGET_ARCH "x64"
!define TJUAEUI_RUNTIME_KEY "win32-x64"
!define TJUAEUI_EXTRACT_METHOD "7z"

!addincludedir "${PROJECT_DIR}\resources\windows"
!include "installer-common.nsh"

!macro customHeader
  !insertmacro TJUAEUI_INSTALLER_CUSTOM_HEADER
!macroend

!macro preInit
  !insertmacro TJUAEUI_INSTALLER_PREINIT
!macroend

!macro customFiles_x64
  !insertmacro TJUAEUI_LOG_EXTRACT_RESULT "7z"
!macroend

; Architecture guard. Inserted from TJUAEUI_INSTALLER_PREINIT (preInit) so it runs before any
; registry mutation, replacing the old .onVerifyInstDir placement which fired after customInit
; had already healed, cleared, or repaired an existing install's registry.
; Rejection policy is unchanged: an x64 build refuses both x86 and ARM64 machines.
!macro TJUAEUI_ASSERT_TARGET_ARCH
  Var /GLOBAL TjuaeUIActualArch
  ${If} ${IsNativeARM64}
    !insertmacro TJUAEUI_DETECT_NATIVE_ARCH $TjuaeUIActualArch
    !insertmacro TJUAEUI_FAIL_UX \
      "${TJUAEUI_E_ARCH_MISMATCH}" \
      "target=x64 actual=$TjuaeUIActualArch" \
      "${TJUAEUI_MSG_ARCH_MISMATCH_ZH}" \
      "${TJUAEUI_MSG_ARCH_MISMATCH_EN}" \
      "${TJUAEUI_MSG_ARCH_MISMATCH_ACTION_ZH}" \
      "${TJUAEUI_MSG_ARCH_MISMATCH_ACTION_EN}" \
      "target=x64 actual=$TjuaeUIActualArch" \
      "target=x64 actual=$TjuaeUIActualArch"
  ${ElseIfNot} ${RunningX64}
    !insertmacro TJUAEUI_DETECT_NATIVE_ARCH $TjuaeUIActualArch
    !insertmacro TJUAEUI_FAIL_UX \
      "${TJUAEUI_E_ARCH_MISMATCH}" \
      "target=x64 actual=$TjuaeUIActualArch" \
      "${TJUAEUI_MSG_ARCH_MISMATCH_ZH}" \
      "${TJUAEUI_MSG_ARCH_MISMATCH_EN}" \
      "${TJUAEUI_MSG_ARCH_MISMATCH_ACTION_ZH}" \
      "${TJUAEUI_MSG_ARCH_MISMATCH_ACTION_EN}" \
      "target=x64 actual=$TjuaeUIActualArch" \
      "target=x64 actual=$TjuaeUIActualArch"
  ${EndIf}
!macroend
