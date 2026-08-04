/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import WebuiModalContent from '@/renderer/components/settings/SettingsModal/contents/WebuiModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import SettingsPageHeader from './components/SettingsPageHeader';

const WebuiSettings: React.FC = () => {
  const { t } = useTranslation();

  return (
    <SettingsPageWrapper>
      <div className='flex flex-col gap-16px'>
        <SettingsPageHeader data-testid='webui-header' title={t('settings.webui')} />
        <WebuiModalContent />
      </div>
    </SettingsPageWrapper>
  );
};

export default WebuiSettings;
