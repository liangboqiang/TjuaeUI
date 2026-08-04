/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { MenuItemConstructorOptions } from 'electron';
import { Menu, app } from 'electron';

type ApplicationMenuLabels = {
  edit: string;
  view: string;
  help: string;
  checkForUpdates: string;
};

const APPLICATION_MENU_LABELS: Record<string, ApplicationMenuLabels> = {
  'de-DE': { edit: 'Bearbeiten', view: 'Ansicht', help: 'Hilfe', checkForUpdates: 'Nach Updates suchen…' },
  'en-US': { edit: 'Edit', view: 'View', help: 'Help', checkForUpdates: 'Check for Updates…' },
  'es-ES': { edit: 'Editar', view: 'Ver', help: 'Ayuda', checkForUpdates: 'Buscar actualizaciones…' },
  'fa-IR': { edit: 'ویرایش', view: 'نمایش', help: 'راهنما', checkForUpdates: 'بررسی به‌روزرسانی‌ها…' },
  'fr-FR': { edit: 'Édition', view: 'Affichage', help: 'Aide', checkForUpdates: 'Rechercher des mises à jour…' },
  'ja-JP': { edit: '編集', view: '表示', help: 'ヘルプ', checkForUpdates: 'アップデートを確認…' },
  'ko-KR': { edit: '편집', view: '보기', help: '도움말', checkForUpdates: '업데이트 확인…' },
  'pt-BR': { edit: 'Editar', view: 'Exibir', help: 'Ajuda', checkForUpdates: 'Verificar atualizações…' },
  'ru-RU': { edit: 'Правка', view: 'Вид', help: 'Справка', checkForUpdates: 'Проверить обновления…' },
  'tr-TR': { edit: 'Düzenle', view: 'Görünüm', help: 'Yardım', checkForUpdates: 'Güncellemeleri denetle…' },
  'uk-UA': { edit: 'Редагування', view: 'Вигляд', help: 'Довідка', checkForUpdates: 'Перевірити оновлення…' },
  'zh-CN': { edit: '编辑', view: '视图', help: '帮助', checkForUpdates: '检查更新…' },
  'zh-TW': { edit: '編輯', view: '顯示', help: '說明', checkForUpdates: '檢查更新…' },
};

export function resolveApplicationMenuLabels(locale: string): ApplicationMenuLabels {
  const normalized = locale.replace('_', '-');
  const exact = APPLICATION_MENU_LABELS[normalized];
  if (exact) return exact;
  const language = normalized.split('-')[0]?.toLowerCase();
  const fallback = Object.entries(APPLICATION_MENU_LABELS).find(([key]) =>
    key.toLowerCase().startsWith(`${language}-`)
  );
  return fallback?.[1] ?? APPLICATION_MENU_LABELS['en-US'];
}

export function setupApplicationMenu(): void {
  const isMac = process.platform === 'darwin';
  const labels = resolveApplicationMenuLabels(app.getLocale());

  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push({
    label: labels.edit,
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      ...(isMac
        ? ([{ role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' }] as MenuItemConstructorOptions[])
        : ([{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }] as MenuItemConstructorOptions[])),
    ],
  });

  template.push({
    label: labels.view,
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      ...(!app.isPackaged ? ([{ role: 'toggleDevTools' }] as MenuItemConstructorOptions[]) : []),
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  });

  template.push({
    label: labels.help,
    submenu: [
      {
        label: labels.checkForUpdates,
        click: () => {
          ipcBridge.update.open.emit({ source: 'menu' });
        },
      },
    ],
  });

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
