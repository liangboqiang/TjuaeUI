
export type ThemeAppearance = 'light' | 'dark';

/** 结构化内置主题；外观决定浅色/深色模式，令牌提供完整配色。 */
export type Theme = {
  id: string;
  name: string;
  appearance: ThemeAppearance;
  tokens: Record<string, string>;
  builtin: boolean;
  created_at: number;
  updated_at: number;
};
