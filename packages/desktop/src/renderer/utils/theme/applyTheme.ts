/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Theme } from '@/common/theme/types';
import { configService } from '@/common/config/configService';
import { ipcBridge } from '@/common';
import { resolveActiveTheme } from '@/common/theme/resolveTheme';
import { BUILTIN_THEMES } from '@renderer/theme/builtinThemes';

const TOKENS_STYLE_ID = 'theme-tokens';

function upsertStyle(id: string, css: string | null, root: Document = document): void {
  const existing = root.getElementById(id);
  if (!css) {
    existing?.remove();
    return;
  }
  const el = (existing as HTMLStyleElement | null) ?? root.createElement('style');
  el.id = id;
  el.textContent = css;
  root.head.appendChild(el); // (re)append to keep it last in <head>
}

function tokensToCss(theme: Theme): string | null {
  const { tokens } = theme;
  if (!tokens || Object.keys(tokens).length === 0) return null;
  const body = Object.entries(tokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `:root[data-color-scheme='default'][data-theme='${theme.appearance}'] {\n${body}\n}`;
}

/** Apply a resolved theme to a document. Used by every app-chrome surface. */
export function applyTheme(theme: Theme, root: Document = document): void {
  root.documentElement.setAttribute('data-theme', theme.appearance);
  root.documentElement.setAttribute('data-theme-id', theme.id);
  root.body?.setAttribute('arco-theme', theme.appearance);
  upsertStyle(TOKENS_STYLE_ID, tokensToCss(theme), root);
  upsertStyle('theme-decoration', null, root);
}

/** Resolve `activeId` locally, apply, persist, and publish to main for cross-window broadcast. */
export async function setActiveTheme(activeId: string): Promise<void> {
  const resolved = resolveActiveTheme(activeId, BUILTIN_THEMES);
  applyTheme(resolved);
  await configService.set('theme.activeId', resolved.id);
  await ipcBridge.theme.setActive.invoke(resolved);
}
