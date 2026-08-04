/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { Switch } from '@arco-design/web-react';
import { Attention, CheckOne, Info } from '@icon-park/react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PreferenceRow from './PreferenceRow';

/**
 * WebUI-only notification preference. The visible switch is the single entry
 * point for both the app preference and the browser permission prompt, so the
 * user never has to understand two separate "enable" controls.
 */
const BrowserNotificationGrant: React.FC<{
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}> = ({ enabled, onEnabledChange }) => {
  const { t } = useTranslation();
  const supported = typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext;
  const [permission, setPermission] = useState<NotificationPermission>(supported ? Notification.permission : 'denied');
  const [requesting, setRequesting] = useState(false);

  const handleToggle = useCallback(
    (checked: boolean) => {
      if (!checked) {
        onEnabledChange(false);
        return;
      }
      if (!supported || permission === 'denied') return;
      if (permission === 'granted') {
        onEnabledChange(true);
        return;
      }

      setRequesting(true);
      void Notification.requestPermission()
        .then((result) => {
          setPermission(result);
          onEnabledChange(result === 'granted');
        })
        .finally(() => setRequesting(false));
    },
    [onEnabledChange, permission, supported]
  );

  const switchChecked = supported && permission === 'granted' && enabled;
  const status = !supported
    ? {
        icon: <Info aria-hidden='true' size='15' />,
        text: t('settings.browserNotification.insecureContext'),
        className: 'border-border-2 bg-fill-1 text-t-secondary',
      }
    : permission === 'granted'
      ? {
          icon: <CheckOne aria-hidden='true' size='15' />,
          text: t('settings.browserNotification.granted'),
          className: 'border-success-2 bg-success-1 text-success-7',
        }
      : permission === 'denied'
        ? {
            icon: <Attention aria-hidden='true' size='15' />,
            text: t('settings.browserNotification.denied'),
            className: 'border-warning-3 bg-warning-1 text-warning-7',
          }
        : {
            icon: <Info aria-hidden='true' size='15' />,
            text: t('settings.browserNotification.enableHint'),
            className: 'border-primary-2 bg-primary-1 text-t-secondary',
          };

  return (
    <div data-testid='browser-notification-setting'>
      <PreferenceRow label={t('settings.notification')} description={t('settings.notificationDesc')}>
        <Switch
          checked={switchChecked}
          loading={requesting}
          disabled={!supported || permission === 'denied'}
          onChange={handleToggle}
          aria-label={t('settings.notification')}
        />
      </PreferenceRow>
      <div
        className={`mb-10px flex items-start gap-7px rounded-9px border px-10px py-8px text-11px leading-17px ${status.className}`}
        role='status'
      >
        <span className='mt-1px shrink-0'>{status.icon}</span>
        <span>{status.text}</span>
      </div>
    </div>
  );
};

export default BrowserNotificationGrant;
