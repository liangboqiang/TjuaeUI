import type { IExtensionSettingsTab } from '@/common/adapter/ipcBridge';
import { resolveExtensionAssetUrl } from '@/renderer/utils/platform';
import {
  Communication,
  Computer,
  Earth,
  Info,
  Lightning,
  LinkCloud,
  Market,
  People,
  Puzzle,
  Speed,
  System,
  Toolkit,
} from '@icon-park/react';
import React from 'react';

export type SettingsGroupId = 'aiCore' | 'app' | 'market' | 'other';

export type SettingsNavItem = {
  id: string;
  label: string;
  icon: React.ReactElement;
  isImageIcon?: boolean;
  path: string;
  group: SettingsGroupId;
  extensionTab?: IExtensionSettingsTab;
};

export type SettingsTranslate = (key: string, options?: { defaultValue?: string }) => string;

export const SETTINGS_GROUPS: ReadonlyArray<{ id: SettingsGroupId; labelKey: string }> = [
  { id: 'aiCore', labelKey: 'settings.groupAiCore' },
  { id: 'app', labelKey: 'settings.groupApp' },
  { id: 'market', labelKey: 'settings.groupMarket' },
  { id: 'other', labelKey: 'settings.groupAbout' },
];

const SETTINGS_GROUP_LABEL_KEYS = Object.fromEntries(
  SETTINGS_GROUPS.map((group) => [group.id, group.labelKey])
) as Record<SettingsGroupId, string>;

const BUILTIN_SETTINGS_NAV = [
  {
    id: 'assistants',
    labelKey: 'settings.assistants',
    path: 'assistants',
    group: 'aiCore',
    icon: () => <People />,
  },
  {
    id: 'engine',
    labelKey: 'settings.engines',
    path: 'engine',
    group: 'aiCore',
    icon: () => <Speed />,
  },
  {
    id: 'model',
    labelKey: 'settings.model',
    path: 'model',
    group: 'aiCore',
    icon: () => <LinkCloud />,
  },
  {
    id: 'skills',
    labelKey: 'settings.skills',
    path: 'skills',
    group: 'aiCore',
    icon: () => <Lightning />,
  },
  {
    id: 'tools',
    labelKey: 'settings.tools',
    path: 'tools',
    group: 'aiCore',
    icon: () => <Toolkit />,
  },
  {
    id: 'appearance',
    labelKey: 'settings.appearancePanel',
    path: 'appearance',
    group: 'app',
    icon: () => <Computer />,
  },
  {
    id: 'webui',
    labelKey: 'settings.webui',
    path: 'webui',
    group: 'app',
    icon: (isDesktop: boolean) => (isDesktop ? <Earth /> : <Communication />),
  },
  {
    id: 'market',
    labelKey: 'settings.market',
    path: 'market',
    group: 'market',
    icon: () => <Market />,
  },
  {
    id: 'system',
    labelKey: 'settings.system',
    path: 'system',
    group: 'other',
    icon: () => <System />,
  },
  {
    id: 'about',
    labelKey: 'settings.about',
    path: 'about',
    group: 'other',
    icon: () => <Info />,
  },
] as const satisfies ReadonlyArray<{
  id: string;
  labelKey: string;
  path: string;
  group: SettingsGroupId;
  icon: (isDesktop: boolean) => React.ReactElement;
}>;

export type BuiltinSettingTab = (typeof BUILTIN_SETTINGS_NAV)[number]['id'];

export const BUILTIN_TAB_IDS: readonly BuiltinSettingTab[] = BUILTIN_SETTINGS_NAV.map((item) => item.id);

type BuildSettingsNavigationOptions = {
  isDesktop: boolean;
  t: SettingsTranslate;
  extensionTabs: IExtensionSettingsTab[];
  resolveExtTabName: (tab: IExtensionSettingsTab) => string;
};

const createExtensionItem = (
  tab: IExtensionSettingsTab,
  group: SettingsGroupId,
  resolveExtTabName: (tab: IExtensionSettingsTab) => string
): SettingsNavItem => {
  const resolvedIcon = resolveExtensionAssetUrl(tab.icon) || tab.icon;
  return {
    id: tab.id,
    label: resolveExtTabName(tab),
    icon: resolvedIcon ? <img src={resolvedIcon} alt='' className='h-full w-full object-contain' /> : <Puzzle />,
    isImageIcon: Boolean(resolvedIcon),
    path: `ext/${tab.id}`,
    group,
    extensionTab: tab,
  };
};

export const buildSettingsNavigation = ({
  isDesktop,
  t,
  extensionTabs,
  resolveExtTabName,
}: BuildSettingsNavigationOptions): SettingsNavItem[] => {
  const result: SettingsNavItem[] = BUILTIN_SETTINGS_NAV.map((item) => ({
    id: item.id,
    label: t(item.labelKey),
    icon: item.icon(isDesktop),
    path: item.path,
    group: item.group,
  }));

  const beforeMap = new Map<string, IExtensionSettingsTab[]>();
  const afterMap = new Map<string, IExtensionSettingsTab[]>();
  const unanchored: IExtensionSettingsTab[] = [];

  for (const tab of extensionTabs) {
    if (!tab.position) {
      unanchored.push(tab);
      continue;
    }

    const anchor = tab.position.relativeTo;
    if (!result.some((item) => item.id === anchor)) {
      unanchored.push(tab);
      continue;
    }

    const target = tab.position.placement === 'before' ? beforeMap : afterMap;
    const tabs = target.get(anchor) ?? [];
    tabs.push(tab);
    target.set(anchor, tabs);
  }

  for (let index = result.length - 1; index >= 0; index -= 1) {
    const builtin = result[index];
    const after = afterMap.get(builtin.id);
    if (after) {
      result.splice(index + 1, 0, ...after.map((tab) => createExtensionItem(tab, builtin.group, resolveExtTabName)));
    }

    const before = beforeMap.get(builtin.id);
    if (before) {
      result.splice(index, 0, ...before.map((tab) => createExtensionItem(tab, builtin.group, resolveExtTabName)));
    }
  }

  if (unanchored.length > 0) {
    const marketIndex = result.findIndex((item) => item.group === 'market');
    const insertIndex = marketIndex >= 0 ? marketIndex : result.length;
    result.splice(insertIndex, 0, ...unanchored.map((tab) => createExtensionItem(tab, 'app', resolveExtTabName)));
  }

  return result;
};

export const getSettingsGroupLabelKey = (group: SettingsGroupId): string => SETTINGS_GROUP_LABEL_KEYS[group];

export const isSettingsNavItemActive = (pathname: string, item: Pick<SettingsNavItem, 'path'>): boolean => {
  const itemPath = `/settings/${item.path}`;
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
};
