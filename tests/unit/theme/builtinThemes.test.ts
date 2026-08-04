import { describe, expect, it } from 'vitest';
import {
  BUILTIN_THEME_GROUPS,
  BUILTIN_THEME_IDS,
  BUILTIN_THEMES,
} from '../../../packages/desktop/src/renderer/theme/builtinThemes';

const relativeLuminance = (hex: string): number => {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrastRatio = (foreground: string, background: string): number => {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].toSorted(
    (left, right) => right - left
  );

  return (lighter + 0.05) / (darker + 0.05);
};

describe('builtin theme catalog', () => {
  it('contains exactly ten light and ten dark themes with unique ids', () => {
    expect(BUILTIN_THEME_GROUPS.light).toHaveLength(10);
    expect(BUILTIN_THEME_GROUPS.dark).toHaveLength(10);
    expect(BUILTIN_THEMES).toHaveLength(20);
    expect(BUILTIN_THEME_IDS.size).toBe(20);
  });

  it('uses structured tokens without custom css or image covers', () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.tokens).toBeTruthy();
      expect('css' in theme).toBe(false);
      expect('cover' in theme).toBe(false);
    }
  });

  it('keeps semantic text and action colors readable across every built-in theme surface', () => {
    const textTokens = ['--text-secondary', '--text-tertiary', '--text-disabled'] as const;
    const actionTokens = ['--primary', '--brand-hover'] as const;
    const surfaceTokens = [
      '--bg-base',
      '--bg-2',
      '--bg-3',
      '--bg-4',
      '--brand-light',
      '--message-user-bg',
      '--message-tips-bg',
    ] as const;

    for (const theme of BUILTIN_THEMES) {
      const tokens = theme.tokens!;

      for (const textToken of textTokens) {
        for (const surfaceToken of surfaceTokens) {
          expect(
            contrastRatio(tokens[textToken], tokens[surfaceToken]),
            `${theme.id}: ${textToken} on ${surfaceToken}`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }

      for (const actionToken of actionTokens) {
        for (const surfaceToken of surfaceTokens) {
          expect(
            contrastRatio(tokens[actionToken], tokens[surfaceToken]),
            `${theme.id}: ${actionToken} on ${surfaceToken}`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }

      expect(
        contrastRatio(tokens['--primary-contrast'], tokens['--primary']),
        `${theme.id}: --primary-contrast on --primary`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
