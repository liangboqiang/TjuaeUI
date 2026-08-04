/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingsPageHeader from '../../components/SettingsPageHeader';
import SettingsPageWrapper from '../../components/SettingsPageWrapper';
import RemoteMarketPane from './RemoteMarketPane';

type MarketPageProps = {
  withWrapper?: boolean;
};

const MarketPage: React.FC<MarketPageProps> = ({ withWrapper = true }) => {
  const { t } = useTranslation();

  const content = (
    <div className='flex min-h-0 flex-col gap-18px' data-testid='asset-market-page'>
      <SettingsPageHeader
        data-testid='asset-market-header'
        title={t('settings.market')}
        description={t('settings.marketDescription')}
      />
      <RemoteMarketPane />
    </div>
  );

  return withWrapper ? <SettingsPageWrapper>{content}</SettingsPageWrapper> : content;
};

export default MarketPage;
