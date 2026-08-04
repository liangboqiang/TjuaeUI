/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ManagedEngine } from '@/renderer/utils/model/agentTypes';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EngineDiagnosticsPage from '@/renderer/pages/settings/Assets/EngineDiagnosticsPage';

const mocks = vi.hoisted(() => ({
  engines: [] as ManagedEngine[],
  start: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('@/renderer/hooks/agent/useManagedEngines', () => ({
  useManagedEngines: () => ({
    engines: mocks.engines,
    isLoading: false,
    isRefreshing: false,
    error: null,
    revalidate: mocks.revalidate,
  }),
}));

vi.mock('@/renderer/hooks/agent/useEngineDiagnostics', () => ({
  useEngineDiagnostics: () => ({
    run: null,
    isRunning: false,
    start: mocks.start,
  }),
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageHeader', () => ({
  default: ({
    title,
    description,
    actions,
  }: {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </header>
  ),
}));

const engine = (overrides: Partial<ManagedEngine>): ManagedEngine =>
  ({
    id: 'engine',
    name: 'Engine',
    agent_type: 'acp',
    agent_source: 'builtin',
    enabled: true,
    installed: true,
    status: 'online',
    sort_order: 100,
    ...overrides,
  }) as ManagedEngine;

const renderPage = () =>
  render(
    <MemoryRouter>
      <EngineDiagnosticsPage />
    </MemoryRouter>
  );

describe('EngineDiagnosticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.engines = [
      engine({
        id: 'missing-cli',
        name: 'Scanned Missing CLI',
        installed: false,
        status: 'missing',
        command: 'missing-cli',
      }),
      engine({
        id: 'installed-cli',
        name: 'Installed CLI',
        installed: true,
        status: 'online',
        command: 'installed-cli',
      }),
    ];
    mocks.start.mockResolvedValue(undefined);
  });

  it('shows uninstalled scanned candidates without management controls', () => {
    renderPage();

    expect(screen.getByText('Scanned Missing CLI')).toBeInTheDocument();
    expect(screen.getByText('Installed CLI')).toBeInTheDocument();
    expect(screen.queryByText('settings.engineManagement.editDefinition')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.engineManagement.deleteEngine')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('filters diagnostics locally and starts the existing batch probe', () => {
    renderPage();

    fireEvent.change(screen.getByTestId('engine-diagnostics-search'), {
      target: { value: 'missing' },
    });

    expect(screen.getByText('Scanned Missing CLI')).toBeInTheDocument();
    expect(screen.queryByText('Installed CLI')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('engine-diagnostics-test-all'));
    expect(mocks.start).toHaveBeenCalledWith('manual');
  });
});
