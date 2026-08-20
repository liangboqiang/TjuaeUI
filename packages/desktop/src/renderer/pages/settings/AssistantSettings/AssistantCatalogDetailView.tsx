import type {
  AssistantCatalogDetail,
  AssistantVersionComparison,
  UpdateAssistantCatalogSettingsRequest,
} from '@/common/types/platform/assistantCatalog';
import { Button, Empty, Select, Spin, Switch, Tabs, Tag } from '@arco-design/web-react';
import { ArrowLeft, Copy, Delete, Download, Upload } from '@icon-park/react';
import { diffLines } from 'diff';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MarkdownPreview from '@/renderer/pages/conversation/Preview/components/viewers/MarkdownViewer';
import styles from '../SkillsSettings/SkillsHubSettings.module.css';
import { AssistantGlyph } from './AssistantCatalogDirectory';
import { assistantSourceTranslationKey } from './assistantCatalogPresentation';
import AssistantSettingsWorkspace from './AssistantSettingsWorkspace';

export type AssistantDetailTab = 'overview' | 'settings' | 'versions' | 'compare';

type DiffLine = { text: string; kind: 'same' | 'added' | 'removed' };

const buildDiffSides = (base: string, target: string): { base: DiffLine[]; target: DiffLine[] } => {
  const baseLines: DiffLine[] = [];
  const targetLines: DiffLine[] = [];
  diffLines(base, target).forEach((part: { value: string; added?: boolean; removed?: boolean }) => {
    const lines = part.value.split('\n');
    if (lines.at(-1) === '') lines.pop();
    const safeLines = lines.length ? lines : [''];
    if (part.added) targetLines.push(...safeLines.map((text) => ({ text, kind: 'added' as const })));
    else if (part.removed) baseLines.push(...safeLines.map((text) => ({ text, kind: 'removed' as const })));
    else {
      baseLines.push(...safeLines.map((text) => ({ text, kind: 'same' as const })));
      targetLines.push(...safeLines.map((text) => ({ text, kind: 'same' as const })));
    }
  });
  return { base: baseLines, target: targetLines };
};

const DiffSide: React.FC<{ lines: DiffLine[] }> = ({ lines }) => (
  <pre className={styles.diffSource}>
    {lines.map((line, index) => (
      <span key={`${index}-${line.kind}`} className={styles[`diffLine_${line.kind}`]}>
        <i>{index + 1}</i>
        <code>{line.text || ' '}</code>
      </span>
    ))}
  </pre>
);

type Props = {
  detail?: AssistantCatalogDetail;
  loading: boolean;
  failed: boolean;
  errorMessage?: string;
  busy: boolean;
  activeTab: AssistantDetailTab;
  comparison?: AssistantVersionComparison;
  comparisonLoading: boolean;
  baseVersion?: string;
  targetVersion?: string;
  onBack: () => void;
  onRetry: () => void;
  onTabChange: (tab: AssistantDetailTab) => void;
  onVersionChange: (version: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  onCompareVersions: (base: string, target: string) => void;
  onCopyToMine: () => void;
  onExport: () => void;
  onSaveSettings: (settings: Omit<UpdateAssistantCatalogSettingsRequest, 'source' | 'namespace' | 'slug'>) => void;
  onDelete: () => void;
  onPublish: () => void;
};

const VersionCompare: React.FC<
  Pick<Props, 'detail' | 'comparison' | 'comparisonLoading' | 'baseVersion' | 'targetVersion' | 'onCompareVersions'>
> = ({ detail, comparison, comparisonLoading, baseVersion, targetVersion, onCompareVersions }) => {
  const { t } = useTranslation();
  const versions = detail?.versions.map((item) => item.version) ?? [];
  const [selectedPath, setSelectedPath] = useState<string>();
  useEffect(() => setSelectedPath(comparison?.files[0]?.path), [comparison]);
  const selected = comparison?.files.find((file) => file.path === selectedPath);
  const diff = useMemo(
    () => buildDiffSides(selected?.baseContent ?? '', selected?.targetContent ?? ''),
    [selected?.baseContent, selected?.targetContent]
  );
  const run = (base: string, target: string) => {
    if (base && target && base !== target) onCompareVersions(base, target);
  };
  if (!detail) return null;
  return (
    <div className={styles.compareWorkspace}>
      <div className={styles.compareControls}>
        <label>
          <span>{t('settings.assistantCatalog.baseVersion')}</span>
          <Select
            value={baseVersion}
            options={versions.map((version) => ({ label: `v${version}`, value: version }))}
            onChange={(value) => run(value, targetVersion ?? '')}
          />
        </label>
        <span>→</span>
        <label>
          <span>{t('settings.assistantCatalog.targetVersion')}</span>
          <Select
            value={targetVersion}
            options={versions.map((version) => ({ label: `v${version}`, value: version }))}
            onChange={(value) => run(baseVersion ?? '', value)}
          />
        </label>
      </div>
      {comparisonLoading ? <Spin /> : null}
      {!comparisonLoading && comparison?.files.length === 0 ? (
        <Empty description={t('settings.assistantCatalog.compareNoChanges')} />
      ) : null}
      {comparison?.files.length ? (
        <div className={styles.compareBody}>
          <aside>
            {comparison.files.map((file) => (
              <Button
                key={file.path}
                type='text'
                className={file.path === selectedPath ? styles.fileActive : undefined}
                onClick={() => setSelectedPath(file.path)}
              >
                <span>{file.path}</span>
                <Tag size='small'>{file.status}</Tag>
              </Button>
            ))}
          </aside>
          <section>
            {selected?.binary ? (
              <Empty description={t('settings.assistantCatalog.binaryDiff')} />
            ) : (
              <div className={styles.diffColumns}>
                <div>
                  <header>v{comparison.baseVersion}</header>
                  <DiffSide lines={diff.base} />
                </div>
                <div>
                  <header>v{comparison.targetVersion}</header>
                  <DiffSide lines={diff.target} />
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
};

const AssistantCatalogDetailView: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const { detail } = props;
  const versionOptions = detail?.versions.map((item) => ({ label: `v${item.version}`, value: item.version })) ?? [];
  return (
    <main className={styles.detailMain}>
      <header className={styles.detailTopbar}>
        <Button type='text' icon={<ArrowLeft />} onClick={props.onBack}>
          {t('settings.assistantCatalog.backToList')}
        </Button>
        {detail ? (
          <div className={styles.detailActions}>
            {detail.item.identity.source === 'tjuae-hub' ? (
              <Button icon={<Copy />} onClick={props.onCopyToMine}>
                {t('settings.assistantCatalog.copyToMine')}
              </Button>
            ) : null}
            <Button icon={<Download />} onClick={props.onExport}>
              {t('settings.assistantCatalog.export')}
            </Button>
            {detail.item.identity.source === 'tjuae-hub' && detail.item.editable ? (
              <Button type='primary' icon={<Upload />} onClick={props.onPublish}>
                {t('settings.assistantCatalog.publish')}
              </Button>
            ) : null}
            {detail.item.canDelete ? (
              <Button status='danger' icon={<Delete />} onClick={props.onDelete}>
                {t('settings.assistantCatalog.delete')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>
      {props.loading ? (
        <div className={styles.centerState}>
          <Spin />
        </div>
      ) : null}
      {props.failed ? (
        <div className={styles.centerState}>
          <Empty
            description={
              <div className={styles.errorState}>
                <strong>{t('settings.assistantCatalog.fetchFailed')}</strong>
                {props.errorMessage ? <small>{props.errorMessage}</small> : null}
                <Button onClick={props.onRetry}>{t('common.retry')}</Button>
              </div>
            }
          />
        </div>
      ) : null}
      {detail ? (
        <>
          <section className={styles.detailHero}>
            <AssistantGlyph assistant={detail.item} large />
            <div className={styles.detailIdentity}>
              <div>
                <h1>{detail.item.name}</h1>
                <Tag>{t(assistantSourceTranslationKey[detail.item.identity.source])}</Tag>
              </div>
              <p>{detail.item.description || t('settings.assistantCatalog.noDescription')}</p>
              <div className={styles.detailTags}>
                {detail.item.categories.map((category) => (
                  <Tag key={category}>{category}</Tag>
                ))}
                {detail.item.tags.map((tag) => (
                  <Tag key={tag} color='gray'>
                    #{tag}
                  </Tag>
                ))}
              </div>
            </div>
            <label className={styles.versionPicker}>
              <span>{t('settings.assistantCatalog.version')}</span>
              <Select value={detail.manifest.version} options={versionOptions} onChange={props.onVersionChange} />
            </label>
          </section>
          <section className={styles.preferenceBar}>
            <label>
              <Switch
                checked={detail.item.preferences.enabled}
                loading={props.busy}
                disabled={!detail.item.canDisable}
                onChange={props.onEnabledChange}
              />
              <span>
                <strong>{t('settings.assistantCatalog.enabled')}</strong>
                <small>{t('settings.assistantCatalog.enabledHint')}</small>
              </span>
            </label>
          </section>
          <Tabs
            activeTab={props.activeTab}
            onChange={(value) => props.onTabChange(value as AssistantDetailTab)}
            className={styles.detailTabs}
          >
            <Tabs.TabPane key='overview' title={t('settings.assistantCatalog.tabs.overview')}>
              <article className={styles.readme}>
                <MarkdownPreview content={detail.readme} />
              </article>
            </Tabs.TabPane>
            <Tabs.TabPane key='settings' title={t('settings.assistantCatalog.tabs.settings')}>
              <AssistantSettingsWorkspace detail={detail} busy={props.busy} onSave={props.onSaveSettings} />
            </Tabs.TabPane>
            <Tabs.TabPane key='versions' title={t('settings.assistantCatalog.tabs.versions')}>
              <div className={styles.versionList}>
                {detail.versions.map((version) => (
                  <Button type='text' key={version.version} onClick={() => props.onVersionChange(version.version)}>
                    <span>
                      <strong>v{version.version}</strong>
                      {version.version === detail.item.latestVersion ? (
                        <Tag color='blue'>{t('settings.assistantCatalog.latest')}</Tag>
                      ) : null}
                    </span>
                    <small>{version.digest}</small>
                  </Button>
                ))}
              </div>
            </Tabs.TabPane>
            <Tabs.TabPane key='compare' title={t('settings.assistantCatalog.tabs.compare')}>
              <VersionCompare {...props} />
            </Tabs.TabPane>
          </Tabs>
        </>
      ) : null}
    </main>
  );
};

export default AssistantCatalogDetailView;
