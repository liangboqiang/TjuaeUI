import { Tag } from '@arco-design/web-react';
import classNames from 'classnames';
import React from 'react';

export type SettingsStatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

type SettingsStatusProps = {
  label: React.ReactNode;
  tone?: SettingsStatusTone;
  'data-testid'?: string;
};

const toneColor: Record<SettingsStatusTone, 'green' | 'gold' | 'red' | 'gray' | 'arcoblue'> = {
  success: 'green',
  warning: 'gold',
  danger: 'red',
  neutral: 'gray',
  info: 'arcoblue',
};

/** 管理页统一状态标签；颜色只表达语义，不承担唯一信息。 */
const SettingsStatus: React.FC<SettingsStatusProps> = ({ label, tone = 'neutral', 'data-testid': dataTestId }) => (
  <Tag
    data-testid={dataTestId}
    size='small'
    color={toneColor[tone]}
    className={classNames('flex-shrink-0', tone === 'neutral' && '!border-border-2 !bg-fill-2 !text-t-primary')}
  >
    {label}
  </Tag>
);

export default SettingsStatus;
