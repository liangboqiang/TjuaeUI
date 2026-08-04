
import React from 'react';
import { useTranslation } from 'react-i18next';
import AppearanceModalContent from '@/renderer/components/settings/SettingsModal/contents/AppearanceModalContent';
import SettingsPageWrapper from '../components/SettingsPageWrapper';
import SettingsPageHeader from '../components/SettingsPageHeader';

const AppearanceSettings: React.FC = () => {
  const { t } = useTranslation();

  return (
    <SettingsPageWrapper>
      <div className='flex flex-col gap-16px'>
        <SettingsPageHeader data-testid='appearance-header' title={t('settings.appearancePanel')} />
        <AppearanceModalContent />
      </div>
    </SettingsPageWrapper>
  );
};

export default AppearanceSettings;
