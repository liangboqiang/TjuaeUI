/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import SystemModalContent from '@/renderer/components/settings/SettingsModal/contents/SystemModalContent';
import AboutModalContent from '@/renderer/components/settings/SettingsModal/contents/AboutModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import SettingsPageHeader from './components/SettingsPageHeader';

const SystemSettings: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const isAboutPage = location.pathname === '/settings/about';

  return (
    <SettingsPageWrapper contentClassName={isAboutPage ? 'max-w-640px' : undefined}>
      {isAboutPage ? (
        <AboutModalContent />
      ) : (
        <div className='flex flex-col gap-16px'>
          <SettingsPageHeader data-testid='system-header' title={t('settings.system')} />
          <SystemModalContent />
        </div>
      )}
    </SettingsPageWrapper>
  );
};

export default SystemSettings;
