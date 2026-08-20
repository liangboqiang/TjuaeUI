import TjuaeSearchInput from '@/renderer/components/base/TjuaeSearchInput';
import classNames from 'classnames';
import React from 'react';

type SettingsManagementHeaderActionsProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  action: React.ReactNode;
  className?: string;
  searchTestId?: string;
};

/** 设置管理主页共用的“搜索 + 添加”动作组。 */
const SettingsManagementHeaderActions: React.FC<SettingsManagementHeaderActionsProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  action,
  className,
  searchTestId,
}) => (
  <div className={classNames('flex min-w-0 items-center gap-8px', className)}>
    <TjuaeSearchInput
      className='w-[220px] max-w-[40vw] shrink'
      value={searchValue}
      onChange={onSearchChange}
      placeholder={searchPlaceholder}
      data-testid={searchTestId}
    />
    <div className='shrink-0'>{action}</div>
  </div>
);

export default SettingsManagementHeaderActions;
