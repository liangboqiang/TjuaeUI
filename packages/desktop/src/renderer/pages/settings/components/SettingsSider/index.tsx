import FlexFullContainer from '@/renderer/components/layout/FlexFullContainer';
import { isElectronDesktop } from '@/renderer/utils/platform';
import { useExtI18n } from '@/renderer/hooks/system/useExtI18n';
import { useExtensionSettingsTabs } from '@/renderer/hooks/system/useExtensionSettingsTabs';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Tooltip } from '@arco-design/web-react';
import { getSiderTooltipProps } from '@/renderer/utils/ui/siderTooltip';
import {
  buildSettingsNavigation,
  getSettingsGroupLabelKey,
  isSettingsNavItemActive,
  type SettingsNavItem,
} from './settingsNavigation';

export {
  BUILTIN_TAB_IDS,
  SETTINGS_GROUPS,
  buildSettingsNavigation,
  getSettingsGroupLabelKey,
  isSettingsNavItemActive,
} from './settingsNavigation';
export type { BuiltinSettingTab, SettingsGroupId, SettingsNavItem } from './settingsNavigation';

const SettingsSider: React.FC<{ collapsed?: boolean; tooltipEnabled?: boolean }> = ({
  collapsed = false,
  tooltipEnabled = false,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isDesktop = isElectronDesktop();

  const extensionTabs = useExtensionSettingsTabs();
  const { resolveExtTabName } = useExtI18n();

  const menus = useMemo(
    () =>
      buildSettingsNavigation({
        isDesktop,
        t,
        extensionTabs,
        resolveExtTabName,
      }),
    [t, isDesktop, extensionTabs, resolveExtTabName]
  );

  const siderTooltipProps = getSiderTooltipProps(tooltipEnabled);
  const navigateToSettingsItem = (item: SettingsNavItem) => {
    Promise.resolve(navigate(`/settings/${item.path}`, { replace: true })).catch((error) => {
      console.error('Navigation failed:', error);
    });
  };

  return (
    <div
      className={classNames('h-full settings-sider flex flex-col gap-2px overflow-y-auto overflow-x-hidden', {
        'settings-sider--collapsed': collapsed,
      })}
      role='navigation'
      aria-label={t('common.settings')}
    >
      {menus.map((item, index) => {
        const isSelected = isSettingsNavItemActive(pathname, item);
        const previousGroup = index > 0 ? menus[index - 1].group : undefined;
        const groupHeaderKey = previousGroup !== item.group ? getSettingsGroupLabelKey(item.group) : undefined;
        const groupHeader =
          groupHeaderKey && !collapsed ? (
            <div className='settings-sider__group-header px-12px mt-8px h-28px flex items-center text-14px font-[500] text-t-tertiary select-none'>
              {t(groupHeaderKey)}
            </div>
          ) : null;
        return (
          <React.Fragment key={item.id}>
            {groupHeader}
            <Tooltip {...siderTooltipProps} content={item.label} position='right'>
              <Button
                type='text'
                data-settings-id={item.id}
                data-settings-path={item.path}
                className={classNames(
                  'settings-sider__item !h-34px rd-8px !flex items-center gap-8px group relative overflow-hidden shrink-0 conversation-item [&.conversation-item+&.conversation-item]:mt-2px outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-6',
                  collapsed ? 'w-full justify-center px-0' : 'justify-start px-10px',
                  {
                    'hover:bg-fill-3': !isSelected,
                    '!bg-fill-3': isSelected,
                  }
                )}
                aria-current={isSelected ? 'page' : undefined}
                aria-label={item.label}
                onClick={() => navigateToSettingsItem(item)}
              >
                {/* Leading icon — 22px slot to align with main sider rows */}
                <span className='size-22px flex items-center justify-center shrink-0 line-height-0'>
                  {item.isImageIcon ? (
                    <span className='w-16px h-16px flex items-center justify-center'>{item.icon}</span>
                  ) : (
                    React.cloneElement(
                      item.icon as React.ReactElement<{
                        theme?: string;
                        size?: string | number;
                        className?: string;
                        strokeWidth?: number;
                      }>,
                      {
                        theme: 'outline',
                        size: '16',
                        strokeWidth: 3,
                        className: 'block leading-none text-t-secondary',
                      }
                    )
                  )}
                </span>
                <FlexFullContainer className='h-24px collapsed-hidden'>
                  <div className='settings-sider__item-label text-nowrap overflow-hidden inline-block w-full text-14px font-[500] lh-24px whitespace-nowrap text-t-primary'>
                    {item.label}
                  </div>
                </FlexFullContainer>
              </Button>
            </Tooltip>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default SettingsSider;
