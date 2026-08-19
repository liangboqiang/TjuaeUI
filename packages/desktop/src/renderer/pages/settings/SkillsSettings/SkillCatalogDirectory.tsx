import type { SkillCatalogItem, SkillCatalogPage } from '@/common/types/platform/skill';
import { Empty, Spin, Switch, Tag, Tooltip } from '@arco-design/web-react';
import { CheckOne, LinkCloud, Magic } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './SkillsHubSettings.module.css';
import { sourceTranslationKey } from './skillCatalogPresentation';

export const SkillGlyph: React.FC<{ skill: SkillCatalogItem; large?: boolean }> = ({ skill, large = false }) => {
  const content = skill.name.trim().charAt(0).toLocaleUpperCase() || 'S';
  return skill.iconUrl ? (
    <img className={large ? styles.detailIcon : styles.cardIcon} src={skill.iconUrl} alt='' />
  ) : (
    <span className={large ? styles.detailIcon : styles.cardIcon} aria-hidden='true'>
      {content}
    </span>
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
          <article
            key={key}
            className={styles.skillCard}
            tabIndex={0}
            role='button'
            onClick={() => onOpen(skill)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onOpen(skill);
            }}
          >
            <div className={styles.cardHeading}>
              <SkillGlyph skill={skill} />
              <div>
                <strong>{skill.name}</strong>
                <span>v{skill.latestVersion}</span>
              </div>
              {skill.preferences.enabled ? (
                <Tooltip content={t('settings.skillsHub.enabled')}>
                  <CheckOne className={styles.enabledMark} />
                </Tooltip>
              ) : null}
            </div>
            <p>{skill.description || t('settings.skillsHub.noDescription')}</p>
            <div className={styles.cardTags}>
              <Tag size='small'>
                <LinkCloud /> {t(sourceTranslationKey[skill.identity.source])}
              </Tag>
              {skill.categories.slice(0, 2).map((category) => (
                <Tag key={category} size='small'>
                  {category}
                </Tag>
              ))}
            </div>
            <div className={styles.cardPreferences} onClick={(event) => event.stopPropagation()}>
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
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default SkillCatalogDirectory;
