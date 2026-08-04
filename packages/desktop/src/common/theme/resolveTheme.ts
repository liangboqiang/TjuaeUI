/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Theme } from './types';
import { LIGHT_THEME_ID } from './constants';

/**
 * 纯函数：按标识解析主题；不存在时回退到默认浅色主题，再回退到首项。
 */
export function resolveActiveTheme(activeId: string, themes: Theme[]): Theme {
  return themes.find((item) => item.id === activeId) ?? themes.find((item) => item.id === LIGHT_THEME_ID) ?? themes[0];
}
