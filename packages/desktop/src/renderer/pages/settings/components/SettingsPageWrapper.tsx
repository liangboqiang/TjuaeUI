import classNames from 'classnames';
import React from 'react';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import {
  SettingsTabNavigateProvider,
  SettingsViewModeProvider,
} from '@/renderer/components/settings/SettingsModal/settingsViewContext';
import { isElectronDesktop } from '@/renderer/utils/platform';
import { useExtensionSettingsTabs } from '@/renderer/hooks/system/useExtensionSettingsTabs';
import { Button } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useExtI18n } from '@/renderer/hooks/system/useExtI18n';
import {
  buildSettingsNavigation,
  isSettingsNavItemActive,
  type SettingsNavItem,
  type SettingsTranslate,
} from './SettingsSider/settingsNavigation';
import './settings.css';

interface SettingsPageWrapperProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function getBuiltinSettingsNavItems(isDesktop: boolean, t: SettingsTranslate): SettingsNavItem[] {
  return buildSettingsNavigation({
    isDesktop,
    t,
    extensionTabs: [],
    resolveExtTabName: () => '',
  });
}

const SettingsPageWrapper: React.FC<SettingsPageWrapperProps> = ({ children, className, contentClassName }) => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const isDesktop = isElectronDesktop();

  const extensionTabs = useExtensionSettingsTabs();

  const { resolveExtTabName } = useExtI18n();

  const menuItems = React.useMemo(
    () =>
      buildSettingsNavigation({
        isDesktop,
        t,
        extensionTabs,
        resolveExtTabName,
      }),
    [isDesktop, t, extensionTabs, resolveExtTabName]
  );

  // Keep only horizontal padding on the scroll container — vertical padding is
  // moved to the content layer below. A sticky header inside a scroll container
  // with top padding would otherwise stick 32px down, letting content peek
  // through the gap above it.
  const containerClass = classNames(
    'settings-page-wrapper w-full min-h-full box-border overflow-y-auto',
    isMobile ? 'px-16px' : 'px-12px md:px-40px',
    className
  );

  const contentClass = classNames(
    'settings-page-content mx-auto w-full md:max-w-1024px py-14px md:py-32px',
    contentClassName
  );

  const navigateToTab = React.useCallback(
    (tabId: string) => {
      void navigate(`/settings/${tabId}`, { replace: true });
    },
    [navigate]
  );

  return (
    <SettingsViewModeProvider value='page'>
      <SettingsTabNavigateProvider value={navigateToTab}>
        <div className={containerClass}>
          {isMobile && (
            <div className='settings-mobile-top-nav'>
              {menuItems.map((item) => {
                const active = isSettingsNavItemActive(pathname, item);
                return (
                  <Button
                    key={item.path}
                    type='text'
                    htmlType='button'
                    className={classNames('settings-mobile-top-nav__item', {
                      'settings-mobile-top-nav__item--active': active,
                    })}
                    onClick={() => {
                      void navigate(`/settings/${item.path}`, { replace: true });
                    }}
                  >
                    <span className='settings-mobile-top-nav__icon'>{item.icon}</span>
                    <span className='settings-mobile-top-nav__label'>{item.label}</span>
                  </Button>
                );
              })}
            </div>
          )}
          <div className={contentClass}>{children}</div>
        </div>
      </SettingsTabNavigateProvider>
    </SettingsViewModeProvider>
  );
};

export default SettingsPageWrapper;
