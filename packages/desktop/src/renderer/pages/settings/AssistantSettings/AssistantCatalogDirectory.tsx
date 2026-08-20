import type { AssistantCatalogItem, AssistantCatalogPage } from '@/common/types/platform/assistantCatalog';
import { resolveBackendAssetUrl } from '@/renderer/utils/platform';
import { Button, Empty, Spin, Switch, Tag, Tooltip } from '@arco-design/web-react';
import { CheckOne, LinkCloud } from '@icon-park/react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../SkillsSettings/SkillsHubSettings.module.css';
import { assistantSourceTranslationKey } from './assistantCatalogPresentation';

export const AssistantGlyph: React.FC<{
  assistant: AssistantCatalogItem;
  large?: boolean;
}> = ({ assistant, large = false }) => {
  const className = large ? styles.detailIcon : styles.cardIcon;
  const content = assistant.name.trim().charAt(0).toLocaleUpperCase() || 'A';
  const avatar = assistant.avatarUrl?.trim();
  const imageSource = avatar && /^(?:data:|https?:\/\/|\/)/iu.test(avatar) ? resolveBackendAssetUrl(avatar) : undefined;
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [imageSource]);

  return imageSource && !failed ? (
    <img className={className} src={imageSource} alt='' onError={() => setFailed(true)} />
  ) : (
    <span className={className} aria-hidden='true'>
      {avatar && !imageSource ? avatar : content}
    </span>
  );
};

const AssistantCatalogDirectory: React.FC<{
  page?: AssistantCatalogPage;
  loading: boolean;
  busyIdentity?: string;
  onOpen: (assistant: AssistantCatalogItem) => void;
  onEnabledChange: (assistant: AssistantCatalogItem, enabled: boolean) => void;
}> = ({ page, loading, busyIdentity, onOpen, onEnabledChange }) => {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className={styles.centerState}>
        <Spin />
      </div>
    );
  }
  if (!page?.items.length) {
    return (
      <div className={styles.centerState}>
        <Empty description={t('settings.assistantCatalog.noResults')} />
      </div>
    );
  }
  return (
    <div className={styles.directory}>
      {page.items.map((assistant) => {
        const key = `${assistant.identity.source}:${assistant.identity.namespace}:${assistant.identity.slug}`;
        return (
          <Button key={key} type='text' className={styles.skillCard} onClick={() => onOpen(assistant)}>
            <div className={styles.cardHeading}>
              <AssistantGlyph assistant={assistant} />
              <div>
                <strong>{assistant.name}</strong>
                <span>v{assistant.latestVersion}</span>
              </div>
              {assistant.preferences.enabled ? (
                <Tooltip content={t('settings.assistantCatalog.enabled')}>
                  <CheckOne className={styles.enabledMark} />
                </Tooltip>
              ) : null}
            </div>
            <p>{assistant.description || t('settings.assistantCatalog.noDescription')}</p>
            <div className={styles.cardTags}>
              <Tag size='small'>
                <LinkCloud /> {t(assistantSourceTranslationKey[assistant.identity.source])}
              </Tag>
              {assistant.system ? <Tag size='small'>{t('settings.assistantCatalog.systemAssistant')}</Tag> : null}
              {assistant.categories.slice(0, 2).map((category) => (
                <Tag key={category} size='small'>
                  {category}
                </Tag>
              ))}
            </div>
            <div className={styles.cardPreferences} onClick={(event) => event.stopPropagation()}>
              {assistant.canDisable ? (
                <label>
                  <Switch
                    size='small'
                    loading={busyIdentity === key}
                    checked={assistant.preferences.enabled}
                    onChange={(value) => onEnabledChange(assistant, value)}
                  />
                  <span>{t('settings.assistantCatalog.enabled')}</span>
                </label>
              ) : (
                <span>{t('settings.assistantCatalog.alwaysEnabled')}</span>
              )}
              <small>{t(`settings.assistantCatalog.activationStatus.${assistant.preferences.activationStatus}`)}</small>
            </div>
          </Button>
        );
      })}
    </div>
  );
};

export default AssistantCatalogDirectory;
