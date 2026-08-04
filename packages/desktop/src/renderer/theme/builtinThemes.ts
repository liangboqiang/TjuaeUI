import type { Theme, ThemeAppearance } from '@/common/theme/types';
import { DARK_THEME_ID, LIGHT_THEME_ID } from '@/common/theme/constants';

type ThemePalette = {
  base: string;
  panel: string;
  raised: string;
  subtle: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  messageUser: string;
  messageTips: string;
};

export type BuiltinThemeMeta = {
  id: string;
  appearance: ThemeAppearance;
  nameKey: string;
  descriptionKey: string;
  swatches: readonly [string, string, string];
};

const T0 = 0;

function buildTokens(appearance: ThemeAppearance, palette: ThemePalette): Record<string, string> {
  const inverse = appearance === 'dark' ? '#ffffff' : '#111827';
  const overlay = appearance === 'dark' ? '#111827' : '#ffffff';
  const primaryContrast = appearance === 'dark' ? '#111827' : '#ffffff';

  return {
    '--bg-base': palette.base,
    '--bg-1': palette.base,
    '--bg-2': palette.panel,
    '--bg-3': palette.raised,
    '--bg-4': palette.subtle,
    '--bg-5': palette.subtle,
    '--bg-6': palette.raised,
    '--bg-8': palette.panel,
    '--bg-9': palette.base,
    '--bg-10': palette.raised,
    '--bg-hover': palette.subtle,
    '--bg-active': palette.raised,
    '--text-primary': palette.text,
    '--text-secondary': palette.muted,
    '--text-tertiary': palette.muted,
    '--text-quaternary': palette.muted,
    '--text-disabled': palette.muted,
    '--primary': palette.accent,
    '--primary-contrast': primaryContrast,
    '--info': palette.accent,
    '--brand': palette.accent,
    '--brand-hover': palette.accentHover,
    '--brand-light': palette.accentSoft,
    '--border-base': palette.border,
    '--border-light': palette.border,
    '--message-user-bg': palette.messageUser,
    '--message-tips-bg': palette.messageTips,
    '--workspace-btn-bg': palette.subtle,
    '--fill': palette.panel,
    '--fill-0': palette.base,
    '--fill-white-to-black': overlay,
    '--inverse': inverse,
    '--dialog-fill-0': palette.panel,
    '--text-0': palette.text,
    '--text-white': '#ffffff',
    '--border-special': palette.border,
    '--color-guid-agent-bar': palette.accentSoft,
    '--color-primary': palette.accent,
    '--color-primary-6': palette.accent,
    '--color-primary-light-1': palette.accentSoft,
    '--color-primary-light-2': palette.accentSoft,
    '--color-primary-light-3': palette.accentSoft,
    '--color-bg-1': palette.base,
    '--color-bg-2': palette.panel,
    '--color-bg-3': palette.raised,
    '--color-border-2': palette.border,
    '--color-fill-1': palette.subtle,
    '--color-fill-2': palette.raised,
    '--color-text-1': palette.text,
    '--color-text-2': palette.muted,
    '--color-text-3': palette.muted,
    '--color-text-4': palette.muted,
  };
}

function theme(
  id: string,
  name: string,
  appearance: ThemeAppearance,
  palette: ThemePalette,
  nameKey: string,
  descriptionKey: string
): Theme & BuiltinThemeMeta {
  return {
    id,
    name,
    appearance,
    tokens: buildTokens(appearance, palette),
    builtin: true,
    created_at: T0,
    updated_at: T0,
    nameKey,
    descriptionKey,
    swatches: [palette.base, palette.accent, palette.text],
  };
}

export const BUILTIN_THEMES: Array<Theme & BuiltinThemeMeta> = [
  theme(
    LIGHT_THEME_ID,
    'Porcelain',
    'light',
    {
      base: '#f7f8fb',
      panel: '#ffffff',
      raised: '#eef1f6',
      subtle: '#f1f3f7',
      border: '#d9dee8',
      text: '#1f2937',
      muted: '#606a7d',
      accent: '#4561c7',
      accentHover: '#3f5ed3',
      accentSoft: '#e8edff',
      messageUser: '#e8edff',
      messageTips: '#f0f3ff',
    },
    'settings.cssTheme.presets.porcelain',
    'settings.cssTheme.lightDescription'
  ),
  theme(
    'light-mist',
    'Morning Mist',
    'light',
    {
      base: '#f4f7f8',
      panel: '#fbfdfd',
      raised: '#e7edef',
      subtle: '#edf2f3',
      border: '#d0dadd',
      text: '#233238',
      muted: '#596a71',
      accent: '#466d77',
      accentHover: '#3f6872',
      accentSoft: '#dfecee',
      messageUser: '#dfecee',
      messageTips: '#eaf2f3',
    },
    'settings.cssTheme.presets.mist',
    'settings.cssTheme.lightDescription'
  ),
  theme(
    'light-sage',
    'Sage',
    'light',
    {
      base: '#f4f7f2',
      panel: '#fbfcfa',
      raised: '#e7eee3',
      subtle: '#edf2ea',
      border: '#d2dccd',
      text: '#263127',
      muted: '#5d695f',
      accent: '#506c53',
      accentHover: '#4d6b50',
      accentSoft: '#e0ebe0',
      messageUser: '#e0ebe0',
      messageTips: '#edf3eb',
    },
    'settings.cssTheme.presets.sage',
    'settings.cssTheme.lightDescription'
  ),
  theme(
    'light-sky',
    'Sky',
    'light',
    {
      base: '#f3f7fc',
      panel: '#fbfdff',
      raised: '#e4edf8',
      subtle: '#eaf1f9',
      border: '#cedbeb',
      text: '#1f3044',
      muted: '#56687f',
      accent: '#2f69a4',
      accentHover: '#28649f',
      accentSoft: '#dceafa',
      messageUser: '#dceafa',
      messageTips: '#eaf3fd',
    },
    'settings.cssTheme.presets.sky',
    'settings.cssTheme.lightDescription'
  ),
  theme(
    'light-lilac',
    'Lilac',
    'light',
    {
      base: '#f7f5fb',
      panel: '#fdfcff',
      raised: '#ece6f5',
      subtle: '#f1edf7',
      border: '#ddd4e9',
      text: '#30283b',
      muted: '#6b6078',
      accent: '#725995',
      accentHover: '#6c5191',
      accentSoft: '#ebe2f6',
      messageUser: '#ebe2f6',
      messageTips: '#f2edf9',
    },
    'settings.cssTheme.presets.lilac',
    'settings.cssTheme.lightDescription'
  ),
  theme(
    'light-sand',
    'Warm Sand',
    'light',
    {
      base: '#faf7f1',
      panel: '#fffdf8',
      raised: '#eee7da',
      subtle: '#f4eee3',
      border: '#ded4c4',
      text: '#382f24',
      muted: '#6e6354',
      accent: '#7f5c37',
      accentHover: '#805a32',
      accentSoft: '#f1e3d1',
      messageUser: '#f1e3d1',
      messageTips: '#f7efe4',
    },
    'settings.cssTheme.presets.sand',
    'settings.cssTheme.lightDescription'
  ),
  theme(
    'light-rose',
    'Rose',
    'light',
    {
      base: '#fbf5f7',
      panel: '#fffafb',
      raised: '#f2e3e8',
      subtle: '#f7ebef',
      border: '#e4d0d7',
      text: '#3d2930',
      muted: '#745e66',
      accent: '#924f66',
      accentHover: '#914762',
      accentSoft: '#f5dfe7',
      messageUser: '#f5dfe7',
      messageTips: '#faedf2',
    },
    'settings.cssTheme.presets.rose',
    'settings.cssTheme.lightDescription'
  ),
  theme(
    'light-mint',
    'Mint',
    'light',
    {
      base: '#f2f8f6',
      panel: '#fbfefc',
      raised: '#dfeee9',
      subtle: '#e8f3ef',
      border: '#c9ddd6',
      text: '#213630',
      muted: '#536c65',
      accent: '#356e5e',
      accentHover: '#32735f',
      accentSoft: '#d8eee7',
      messageUser: '#d8eee7',
      messageTips: '#e8f5f1',
    },
    'settings.cssTheme.presets.mint',
    'settings.cssTheme.lightDescription'
  ),
  theme(
    'light-amber',
    'Amber',
    'light',
    {
      base: '#fbf7ed',
      panel: '#fffdf7',
      raised: '#f1e6cc',
      subtle: '#f7eedb',
      border: '#e1d2af',
      text: '#392f1f',
      muted: '#726348',
      accent: '#7f5b22',
      accentHover: '#76501a',
      accentSoft: '#f5e4bd',
      messageUser: '#f5e4bd',
      messageTips: '#faefd8',
    },
    'settings.cssTheme.presets.amberLight',
    'settings.cssTheme.lightDescription'
  ),
  theme(
    'light-slate',
    'Cloud Slate',
    'light',
    {
      base: '#f4f6f8',
      panel: '#fbfcfd',
      raised: '#e5e9ee',
      subtle: '#eceff3',
      border: '#d1d7df',
      text: '#242d38',
      muted: '#5b6674',
      accent: '#516680',
      accentHover: '#4a5f78',
      accentSoft: '#e0e7ef',
      messageUser: '#e0e7ef',
      messageTips: '#eaf0f6',
    },
    'settings.cssTheme.presets.slateLight',
    'settings.cssTheme.lightDescription'
  ),
  theme(
    DARK_THEME_ID,
    'Ink',
    'dark',
    {
      base: '#15171c',
      panel: '#1c1f26',
      raised: '#282c35',
      subtle: '#22262e',
      border: '#343a46',
      text: '#edf0f5',
      muted: '#a1a9b6',
      accent: '#819bff',
      accentHover: '#91a8ff',
      accentSoft: '#29345f',
      messageUser: '#29345f',
      messageTips: '#222a40',
    },
    'settings.cssTheme.presets.ink',
    'settings.cssTheme.darkDescription'
  ),
  theme(
    'dark-graphite',
    'Graphite',
    'dark',
    {
      base: '#181818',
      panel: '#202020',
      raised: '#303030',
      subtle: '#282828',
      border: '#3a3a3a',
      text: '#f0f0f0',
      muted: '#aaaaaa',
      accent: '#a3a3a3',
      accentHover: '#b5b5b5',
      accentSoft: '#383838',
      messageUser: '#383838',
      messageTips: '#2b2b2b',
    },
    'settings.cssTheme.presets.graphite',
    'settings.cssTheme.darkDescription'
  ),
  theme(
    'dark-ocean',
    'Deep Ocean',
    'dark',
    {
      base: '#101a24',
      panel: '#162330',
      raised: '#233747',
      subtle: '#1b2c3a',
      border: '#2e4658',
      text: '#e7f0f6',
      muted: '#9bb0bf',
      accent: '#69b1da',
      accentHover: '#75bbe1',
      accentSoft: '#1f4054',
      messageUser: '#1f4054',
      messageTips: '#193446',
    },
    'settings.cssTheme.presets.ocean',
    'settings.cssTheme.darkDescription'
  ),
  theme(
    'dark-forest',
    'Pine Shadow',
    'dark',
    {
      base: '#121b17',
      panel: '#19251f',
      raised: '#283a31',
      subtle: '#203027',
      border: '#34493e',
      text: '#e7f1eb',
      muted: '#9eb1a5',
      accent: '#8ab898',
      accentHover: '#88ba97',
      accentSoft: '#274735',
      messageUser: '#274735',
      messageTips: '#20382b',
    },
    'settings.cssTheme.presets.forest',
    'settings.cssTheme.darkDescription'
  ),
  theme(
    'dark-violet',
    'Dusk Violet',
    'dark',
    {
      base: '#1a1622',
      panel: '#231e2d',
      raised: '#352d43',
      subtle: '#2c2538',
      border: '#463b57',
      text: '#f0ebf6',
      muted: '#b0a3bd',
      accent: '#af92d2',
      accentHover: '#b99ae0',
      accentSoft: '#3b2f50',
      messageUser: '#3b2f50',
      messageTips: '#302841',
    },
    'settings.cssTheme.presets.violet',
    'settings.cssTheme.darkDescription'
  ),
  theme(
    'dark-coffee',
    'Coffee',
    'dark',
    {
      base: '#1d1815',
      panel: '#27201c',
      raised: '#3b3029',
      subtle: '#312823',
      border: '#4a3d34',
      text: '#f1ebe6',
      muted: '#b5a79c',
      accent: '#c39c7a',
      accentHover: '#cda47f',
      accentSoft: '#4a3428',
      messageUser: '#4a3428',
      messageTips: '#392c25',
    },
    'settings.cssTheme.presets.coffee',
    'settings.cssTheme.darkDescription'
  ),
  theme(
    'dark-wine',
    'Wine',
    'dark',
    {
      base: '#211519',
      panel: '#2c1d22',
      raised: '#422b33',
      subtle: '#372329',
      border: '#543640',
      text: '#f5eaed',
      muted: '#bea3ac',
      accent: '#ce90a3',
      accentHover: '#d690a5',
      accentSoft: '#512c38',
      messageUser: '#512c38',
      messageTips: '#40252e',
    },
    'settings.cssTheme.presets.wine',
    'settings.cssTheme.darkDescription'
  ),
  theme(
    'dark-teal',
    'Dark Teal',
    'dark',
    {
      base: '#101c1d',
      panel: '#172627',
      raised: '#253a3b',
      subtle: '#1e3031',
      border: '#304a4c',
      text: '#e5f1f1',
      muted: '#9db2b3',
      accent: '#7bb5b5',
      accentHover: '#8bc1c1',
      accentSoft: '#214445',
      messageUser: '#214445',
      messageTips: '#1b3637',
    },
    'settings.cssTheme.presets.teal',
    'settings.cssTheme.darkDescription'
  ),
  theme(
    'dark-amber',
    'Dark Amber',
    'dark',
    {
      base: '#1d1911',
      panel: '#282217',
      raised: '#3c3322',
      subtle: '#312a1c',
      border: '#4c412b',
      text: '#f3eee2',
      muted: '#b6aa91',
      accent: '#c9a35c',
      accentHover: '#d6ad61',
      accentSoft: '#4a3a1f',
      messageUser: '#4a3a1f',
      messageTips: '#39301d',
    },
    'settings.cssTheme.presets.amberDark',
    'settings.cssTheme.darkDescription'
  ),
  theme(
    'dark-slate',
    'Night Slate',
    'dark',
    {
      base: '#14181f',
      panel: '#1b212a',
      raised: '#29323e',
      subtle: '#222a34',
      border: '#354151',
      text: '#eaf0f6',
      muted: '#9eabb9',
      accent: '#92a8c3',
      accentHover: '#95abc5',
      accentSoft: '#2c3c50',
      messageUser: '#2c3c50',
      messageTips: '#232f3f',
    },
    'settings.cssTheme.presets.slateDark',
    'settings.cssTheme.darkDescription'
  ),
];

export const BUILTIN_THEME_IDS = new Set(BUILTIN_THEMES.map((item) => item.id));

export const BUILTIN_THEME_GROUPS = {
  light: BUILTIN_THEMES.filter((item) => item.appearance === 'light'),
  dark: BUILTIN_THEMES.filter((item) => item.appearance === 'dark'),
} as const;
