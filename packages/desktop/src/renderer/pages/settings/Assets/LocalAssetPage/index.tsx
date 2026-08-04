/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AssetKind } from '@/common/types/agent/assets';
import { Button } from '@arco-design/web-react';
import { CheckOne, Left } from '@icon-park/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import SettingsPageHeader from '../../components/SettingsPageHeader';
import SettingsPageWrapper from '../../components/SettingsPageWrapper';
import LocalAssetWorkbench from './LocalAssetWorkbench';

type LocalAssetRoute = {
  kind: AssetKind;
  parentPath: string;
  titleKey: 'settings.assistants' | 'settings.engines' | 'settings.skills' | 'settings.tools';
};

const routeForPath = (pathname: string): LocalAssetRoute => {
  if (pathname.startsWith('/settings/engine')) {
    return { kind: 'engineAdapter', parentPath: '/settings/engine', titleKey: 'settings.engines' };
  }
  if (pathname.startsWith('/settings/skills')) {
    return { kind: 'skill', parentPath: '/settings/skills', titleKey: 'settings.skills' };
  }
  if (pathname.startsWith('/settings/tools')) {
    return { kind: 'mcp', parentPath: '/settings/tools', titleKey: 'settings.tools' };
  }
  return { kind: 'assistant', parentPath: '/settings/assistants', titleKey: 'settings.assistants' };
};

const LocalAssetPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { assetId } = useParams<{ assetId: string }>();
  const route = useMemo(() => routeForPath(pathname), [pathname]);

  return (
    <SettingsPageWrapper>
      <div className='flex min-h-0 flex-col gap-18px' data-testid='local-asset-page'>
        <SettingsPageHeader
          title={t(route.titleKey)}
          description={t('settings.assetWorkbench.localAssetList')}
          actions={
            assetId ? (
              <Button
                type='text'
                icon={<Left aria-hidden='true' />}
                onClick={() => navigate(route.parentPath)}
                aria-label={t('common.back')}
              >
                {t('common.back')}
              </Button>
            ) : route.kind === 'engineAdapter' ? (
              <Button
                type='outline'
                icon={<CheckOne aria-hidden='true' />}
                onClick={() => navigate('/settings/engine/diagnostics')}
                data-testid='engine-diagnostics-open'
              >
                {t('settings.engineManagement.diagnostics')}
              </Button>
            ) : undefined
          }
        />
        <LocalAssetWorkbench
          initialKind={route.kind}
          initialAssetId={assetId ? decodeURIComponent(assetId) : undefined}
          showKindSelector={false}
        />
      </div>
    </SettingsPageWrapper>
  );
};

export default LocalAssetPage;
