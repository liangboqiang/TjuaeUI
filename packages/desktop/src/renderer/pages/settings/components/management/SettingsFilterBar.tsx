import classNames from 'classnames';
import React from 'react';

type SettingsFilterBarProps = {
  summary?: React.ReactNode;
  children?: React.ReactNode;
  mobileContent?: React.ReactNode;
  className?: string;
  'data-testid'?: string;
};

/** 核心管理页统一的轻量筛选与诊断条。 */
const SettingsFilterBar: React.FC<SettingsFilterBarProps> = ({
  summary,
  children,
  mobileContent,
  className,
  'data-testid': dataTestId,
}) => (
  <section
    data-testid={dataTestId}
    className={classNames(
      'flex min-h-44px flex-wrap items-center gap-8px rounded-12px border border-border-2 bg-2 px-12px py-8px',
      className
    )}
  >
    {summary ? <div className='mr-auto min-w-0 text-12px leading-20px text-t-secondary'>{summary}</div> : null}
    {children}
    {mobileContent ? <div className='w-full md:hidden'>{mobileContent}</div> : null}
  </section>
);

export default SettingsFilterBar;
