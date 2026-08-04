import type { IExtensionSettingsTab } from '@/common/adapter/ipcBridge';
import {
  buildSettingsNavigation,
  isSettingsNavItemActive,
} from '@/renderer/pages/settings/components/SettingsSider/settingsNavigation';
import { describe, expect, it } from 'vitest';

const t = (key: string) => key;
const extension = (id: string, position?: IExtensionSettingsTab['position']): IExtensionSettingsTab =>
  ({
    id,
    name: id,
    extensionName: id,
    url: `extension://${id}`,
    position,
  }) as IExtensionSettingsTab;

describe('settings navigation registry', () => {
  it('defines the complete four-group information architecture in one order', () => {
    const items = buildSettingsNavigation({
      isDesktop: true,
      t,
      extensionTabs: [],
      resolveExtTabName: (tab) => tab.id,
    });

    expect(items.map(({ id, group }) => [id, group])).toEqual([
      ['assistants', 'aiCore'],
      ['engine', 'aiCore'],
      ['model', 'aiCore'],
      ['skills', 'aiCore'],
      ['tools', 'aiCore'],
      ['appearance', 'app'],
      ['webui', 'app'],
      ['market', 'market'],
      ['system', 'other'],
      ['about', 'other'],
    ]);
  });

  it('keeps anchored extensions in their host group and puts unanchored extensions before Market', () => {
    const items = buildSettingsNavigation({
      isDesktop: true,
      t,
      extensionTabs: [
        extension('before-skills', { relativeTo: 'skills', placement: 'before' }),
        extension('after-webui', { relativeTo: 'webui', placement: 'after' }),
        extension('unanchored'),
      ],
      resolveExtTabName: (tab) => tab.id,
    });

    expect(items.find((item) => item.id === 'before-skills')?.group).toBe('aiCore');
    expect(items.find((item) => item.id === 'after-webui')?.group).toBe('app');
    expect(items.find((item) => item.id === 'unanchored')?.group).toBe('app');
    expect(items.findIndex((item) => item.id === 'unanchored')).toBeLessThan(
      items.findIndex((item) => item.id === 'market')
    );
  });

  it('matches exact settings route segments instead of substring collisions', () => {
    const assistantItem = { path: 'assistants' };
    expect(isSettingsNavItemActive('/settings/assistants', assistantItem)).toBe(true);
    expect(isSettingsNavItemActive('/settings/assistants/editor', assistantItem)).toBe(true);
    expect(isSettingsNavItemActive('/settings/not-assistants', assistantItem)).toBe(false);
  });
});
