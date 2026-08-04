/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import BrowserNotificationGrant from '@/renderer/components/settings/SettingsModal/contents/SystemModalContent/BrowserNotificationGrant';

const setNotification = (permission: NotificationPermission | null, secure = true) => {
  Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true });
  if (permission === null) {
    delete (globalThis as unknown as { Notification?: unknown }).Notification;
  } else {
    (globalThis as unknown as { Notification: unknown }).Notification = {
      permission,
      requestPermission: vi.fn(() => Promise.resolve('granted')),
    };
  }
};

afterEach(() => {
  cleanup();
});

describe('BrowserNotificationGrant', () => {
  const renderSetting = (enabled = true, onEnabledChange = vi.fn()) =>
    render(<BrowserNotificationGrant enabled={enabled} onEnabledChange={onEnabledChange} />);

  it('shows a single disabled-looking preference switch and guidance when permission is default', () => {
    setNotification('default');
    renderSetting();
    expect(screen.getByText('settings.browserNotification.enableHint')).toBeInTheDocument();
    expect(screen.queryByText('settings.browserNotification.enable')).not.toBeInTheDocument();
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('shows the granted state when already granted', () => {
    setNotification('granted');
    renderSetting();
    expect(screen.getByText('settings.browserNotification.granted')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('shows the denied state when permission is denied', () => {
    setNotification('denied');
    renderSetting();
    expect(screen.getByText('settings.browserNotification.denied')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('shows the insecure-context hint when not a secure context', () => {
    setNotification('default', false);
    renderSetting();
    expect(screen.getByText('settings.browserNotification.insecureContext')).toBeInTheDocument();
  });

  it('requests permission through the main switch and enables notifications after grant', async () => {
    setNotification('default');
    const onEnabledChange = vi.fn();
    const requestSpy = (globalThis as unknown as { Notification: { requestPermission: ReturnType<typeof vi.fn> } })
      .Notification.requestPermission;
    renderSetting(false, onEnabledChange);
    await userEvent.click(screen.getByRole('switch'));
    expect(requestSpy).toHaveBeenCalled();
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });
});
