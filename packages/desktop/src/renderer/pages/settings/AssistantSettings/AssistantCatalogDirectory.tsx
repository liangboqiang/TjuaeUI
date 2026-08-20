import type { AssistantCatalogItem, AssistantCatalogPage } from '@/common/types/platform/assistantCatalog';
import { resolveBackendAssetUrl } from '@/renderer/utils/platform';
import { Empty, Spin, Switch, Tag } from '@arco-design/web-react';
import { LinkCloud } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../SkillsSettings/SkillsHubSettings.module.css';
import { SettingsCatalogCard, SettingsCatalogGlyph } from '../components/management';
import { assistantSourceTranslationKey } from './assistantCatalogPresentation';

export const AssistantGlyph: React.FC<{
  assistant: AssistantCatalogItem;
  large?: boolean;
}> = ({ assistant, large = false }) => {
  const content = assistant.name.trim().charAt(0).toLocaleUpperCase() || 'A';
  const avatar = assistant.avatarUrl?.trim();
  const imageSource = avatar && /^(?:data:|https?:\/\/|\/)/iu.test(avatar) ? resolveBackendAssetUrl(avatar) : undefined;
  return (
    <SettingsCatalogGlyph imageUrl={imageSource} fallback={avatar && !imageSource ? avatar : content} large={large} />
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
          <SettingsCatalogCard
            key={key}
            icon={<AssistantGlyph assistant={assistant} />}
            title={assistant.name}
            version={`v${assistant.latestVersion}`}
            enabled={assistant.preferences.enabled}
            enabledLabel={t('settings.assistantCatalog.enabled')}
            description={assistant.description || t('settings.assistantCatalog.noDescription')}
            onOpen={() => onOpen(assistant)}
            tags={
              <>
                <Tag size='small'>
                  <LinkCloud /> {t(assistantSourceTranslationKey[assistant.identity.source])}
                </Tag>
                {assistant.system ? <Tag size='small'>{t('settings.assistantCatalog.systemAssistant')}</Tag> : null}
                {assistant.categories.slice(0, 2).map((category) => (
                  <Tag key={category} size='small'>
                    {category}
                  </Tag>
                ))}
              </>
            }
            footer={
              <>
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
                <small>
                  {t(`settings.assistantCatalog.activationStatus.${assistant.preferences.activationStatus}`)}
                </small>
              </>
            }
          />
        );
      })}
    </div>
  );
};

export default AssistantCatalogDirectory;
