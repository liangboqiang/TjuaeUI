/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 系统设置桥接模块
 * System Settings Bridge Module
 *
 * 负责���理系统级设置的读写操作（如关闭到托盘）
 * Handles read/write operations for system-level settings (e.g. close to tray)
 */

import { ipcBridge } from '@/common';
import { changeLanguage } from '@process/services/i18n';
import { createOrUpdateTray, destroyTray, setCloseToTrayEnabled } from '@process/utils/tray';
import { readCloseToTraySetting, writeCloseToTraySetting } from '@process/utils/closeToTraySetting';

type LanguageChangeListener = () => void;
let _languageChangeListener: LanguageChangeListener | null = null;

/**
 * 注册语言变更监听器（供主进程 index.ts 使用）
 * Register a listener for language changes (used by main process index.ts)
 */
export function onLanguageChanged(listener: LanguageChangeListener): void {
  _languageChangeListener = listener;
}

export function initSystemSettingsBridge(): void {
  ipcBridge.systemSettings.getCloseToTray.provider(async () => readCloseToTraySetting());

  ipcBridge.systemSettings.setCloseToTray.provider(async ({ enabled }) => {
    await writeCloseToTraySetting(enabled);
    setCloseToTrayEnabled(enabled);
    if (enabled) {
      createOrUpdateTray();
    } else {
      destroyTray();
    }
  });

  // 语言变更通知，同步主进程 i18n 并通知托盘重建
  // Language change notification, sync main process i18n and notify tray rebuild
  ipcBridge.systemSettings.changeLanguage.provider(async ({ language }) => {
    // Broadcast to all renderers FIRST (desktop + WebUI) for real-time sync.
    // This must happen before the potentially slow main-process i18n switch.
    ipcBridge.systemSettings.languageChanged.emit({ language });
    _languageChangeListener?.();

    // Update main process i18n (non-blocking – don't let a hang here block the provider)
    changeLanguage(language).catch((error) => {
      console.error('[SystemSettings] Main process changeLanguage failed:', error);
    });
  });
}
