import { Skeleton } from '@arco-design/web-react';
import classNames from 'classnames';
import React from 'react';

type SettingsManagementListProps = {
  children?: React.ReactNode;
  empty?: boolean;
  emptyText?: React.ReactNode;
  loading?: boolean;
  className?: string;
  'data-testid'?: string;
};

/** 设置管理页统一列表容器，集中空状态、骨架和行间距。 */
const SettingsManagementList: React.FC<SettingsManagementListProps> = ({
  children,
  empty,
  emptyText,
  loading,
  className,
  'data-testid': dataTestId,
}) => (
  <div
    data-testid={dataTestId}
    className={classNames('flex flex-col gap-8px rounded-16px border border-border-2 bg-2 p-8px md:p-10px', className)}
  >
    {loading ? (
      <div className='space-y-10px px-8px py-10px' aria-busy='true'>
        <Skeleton text={{ rows: 3, width: ['72%', '88%', '64%'] }} animation />
      </div>
    ) : empty ? (
      <div className='py-20px text-center text-12px leading-20px text-t-secondary'>{emptyText}</div>
    ) : (
      children
    )}
  </div>
);

export default SettingsManagementList;
