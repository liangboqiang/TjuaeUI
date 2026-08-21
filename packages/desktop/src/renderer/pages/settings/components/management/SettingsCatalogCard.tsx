import { Card, Tooltip } from '@arco-design/web-react';
import { CheckOne } from '@icon-park/react';
import React from 'react';
import styles from './SettingsCatalogCard.module.css';

type SettingsCatalogCardProps = {
  icon: React.ReactNode;
  title: React.ReactNode;
  version: React.ReactNode;
  description: React.ReactNode;
  badges: React.ReactNode;
  footer: React.ReactNode;
  enabled?: boolean;
  enabledLabel: React.ReactNode;
  onOpen: () => void;
  'data-testid'?: string;
};

/** 助手与技能目录共用的卡片骨架；业务开关只通过 footer 注入。 */
const SettingsCatalogCard: React.FC<SettingsCatalogCardProps> = ({
  icon,
  title,
  version,
  description,
  badges,
  footer,
  enabled,
  enabledLabel,
  onOpen,
  'data-testid': dataTestId,
}) => (
  <Card
    bordered={false}
    bodyStyle={{ padding: 0 }}
    className={styles.card}
    tabIndex={0}
    role='button'
    data-testid={dataTestId}
    onClick={onOpen}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen();
      }
    }}
  >
    <div className={styles.heading}>
      {icon}
      <div>
        <strong>{title}</strong>
        <span>{version}</span>
      </div>
      {enabled ? (
        <Tooltip content={enabledLabel}>
          <CheckOne className={styles.enabled} />
        </Tooltip>
      ) : null}
    </div>
    <p className={styles.description}>{description}</p>
    <div className={styles.badges}>{badges}</div>
    <div className={styles.footer} onClick={(event) => event.stopPropagation()}>
      {footer}
    </div>
  </Card>
);

export default SettingsCatalogCard;
