/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

// 统一主题管理上下文
import type { PropsWithChildren } from 'react';
import React, { createContext, useCallback, useContext } from 'react';
import type { Theme, ThemeAppearance } from '@/common/theme/types';
import useTheme from '@renderer/hooks/system/useTheme';
import { LIGHT_THEME_ID, DARK_THEME_ID } from '@/common/theme/constants';
import useFontScale from '@renderer/hooks/ui/useFontScale';
import useFontSizes from '@renderer/hooks/ui/useFontSizes';
import type { FontSizeKey, FontSizes } from '@/common/config/fontSizes';

interface ThemeContextValue {
  // 当前主题的浅色/深色外观
  theme: ThemeAppearance;
  // 供现有调用方使用的浅色/深色快捷切换
  setTheme: (appearance: ThemeAppearance) => Promise<void>;
  // 当前结构化主题及其选择器
  activeTheme: Theme | null;
  // 配置中保存的主题标识
  activeId: string | null;
  selectTheme: (id: string) => Promise<void>;
  // 全局字体缩放
  fontScale: number;
  setFontScale: (scale: number) => Promise<void>;
  // 各区域字号（像素）
  fontSizes: FontSizes;
  setFontSize: (key: FontSizeKey, px: number) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [activeTheme, selectTheme, activeId] = useTheme();
  const [fontScale, setFontScale] = useFontScale();
  const { fontSizes, setFontSize } = useFontSizes();
  const theme: ThemeAppearance = activeTheme?.appearance ?? 'light';
  const setTheme = useCallback(
    (appearance: ThemeAppearance) => selectTheme(appearance === 'dark' ? DARK_THEME_ID : LIGHT_THEME_ID),
    [selectTheme]
  );

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, activeTheme, activeId, selectTheme, fontScale, setFontScale, fontSizes, setFontSize }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
};
