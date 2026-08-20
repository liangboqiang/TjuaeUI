import type { SkillCatalogItem, SkillCatalogPage } from '@/common/types/platform/skill';
import { Empty, Spin, Switch, Tag } from '@arco-design/web-react';
import { LinkCloud, Magic } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { resolveBackendAssetUrl } from '@/renderer/utils/platform';
import { SettingsCatalogCard, SettingsCatalogGlyph } from '../components/management';
import styles from './SkillsHubSettings.module.css';
import { sourceTranslationKey } from './skillCatalogPresentation';

export const SkillGlyph: React.FC<{ skill: SkillCatalogItem; large?: boolean }> = ({ skill, large = false }) => {
  const content = skill.name.trim().charAt(0).toLocaleUpperCase() || 'S';
  return (
    <SettingsCatalogGlyph
      imageUrl={skill.iconUrl ? resolveBackendAssetUrl(skill.iconUrl) : undefined}
      fallback={content}
      large={large}
    />
  );
};

const SkillCatalogDirectory: React.FC<{
  page?: SkillCatalogPage;
  loading: boolean;
  busyIdentity?: string;
  onOpen: (skill: SkillCatalogItem) => void;
  onPreferenceChange: (skill: SkillCatalogItem, field: 'enabled' | 'autoInject', value: boolean) => void;
}> = ({ page, loading, busyIdentity, onOpen, onPreferenceChange }) => {
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
        <Empty description={t('settings.skillsHub.noSearchResults')} />
      </div>
    );
  }
  return (
    <div className={styles.directory}>
      {page.items.map((skill) => {
        const key = `${skill.identity.source}:${skill.identity.namespace}:${skill.identity.slug}`;
        const busy = key === busyIdentity;
        return (
          <SettingsCatalogCard
            key={key}
            icon={<SkillGlyph skill={skill} />}
            title={skill.name}
            version={`v${skill.latestVersion}`}
            enabled={skill.preferences.enabled}
            enabledLabel={t('settings.skillsHub.enabled')}
            description={skill.description || t('settings.skillsHub.noDescription')}
            onOpen={() => onOpen(skill)}
            tags={
              <>
                <Tag size='small'>
                  <LinkCloud /> {t(sourceTranslationKey[skill.identity.source])}
                </Tag>
                {skill.categories.slice(0, 2).map((category) => (
                  <Tag key={category} size='small'>
                    {category}
                  </Tag>
                ))}
              </>
            }
            footer={
              <>
                <label>
                  <Switch
                    size='small'
                    loading={busy}
                    checked={skill.preferences.enabled}
                    onChange={(value) => onPreferenceChange(skill, 'enabled', value)}
                  />
                  <span>{t('settings.skillsHub.enabled')}</span>
                </label>
                <label>
                  <Switch
                    size='small'
                    loading={busy}
                    disabled={!skill.preferences.enabled}
                    checked={skill.preferences.autoInject}
                    onChange={(value) => onPreferenceChange(skill, 'autoInject', value)}
                  />
                  <span>
                    <Magic /> {t('settings.skillsHub.autoInject')}
                  </span>
                </label>
              </>
            }
          />
        );
      })}
    </div>
  );
};

export default SkillCatalogDirectory;
