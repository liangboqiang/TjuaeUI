import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SettingsSider from '@/renderer/pages/settings/components/SettingsSider';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => true,
  resolveExtensionAssetUrl: (value?: string) => value,
}));

vi.mock('@/renderer/hooks/system/useExtensionSettingsTabs', () => ({
  useExtensionSettingsTabs: () => [],
}));

vi.mock('@/renderer/hooks/system/useExtI18n', () => ({
  useExtI18n: () => ({ resolveExtTabName: (tab: { id: string }) => tab.id }),
}));

describe('SettingsSider information architecture', () => {
  it('renders the four groups and their canonical entries', () => {
    render(
      <MemoryRouter initialEntries={['/settings/assistants']}>
        <SettingsSider />
      </MemoryRouter>
    );

    const navigation = screen.getByRole('navigation', { name: 'common.settings' });
    expect(
      within(navigation)
        .getAllByText(/settings\.group/)
        .map((node) => node.textContent)
    ).toEqual(['settings.groupAiCore', 'settings.groupApp', 'settings.groupMarket', 'settings.groupAbout']);
    expect(within(navigation).getByRole('button', { name: 'settings.assistants' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(navigation).getByRole('button', { name: 'settings.market' })).toHaveAttribute(
      'data-settings-path',
      'market'
    );
  });
});
