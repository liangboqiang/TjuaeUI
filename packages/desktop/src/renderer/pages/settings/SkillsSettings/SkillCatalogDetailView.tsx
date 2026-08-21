import type {
  SkillCatalogDetail,
  SkillCatalogFile,
  SkillCatalogFileContent,
  SkillVersionComparison,
} from '@/common/types/platform/skill';
import { Button, Empty, Input, Select, Spin, Switch, Tabs, Tag, Tooltip } from '@arco-design/web-react';
import { ArrowLeft, Copy, Delete, Download, FolderClose, Magic, Save, Upload } from '@icon-park/react';
import { diffLines } from 'diff';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MarkdownPreview from '@/renderer/pages/conversation/Preview/components/viewers/MarkdownViewer';
import CatalogDetailHero, { type CatalogProfileDraft } from '../components/CatalogDetailHero';
import styles from './SkillsHubSettings.module.css';
import { compactBytes, sourceTranslationKey } from './skillCatalogPresentation';
import { SkillGlyph } from './SkillCatalogDirectory';

export type DetailTab = 'overview' | 'files' | 'versions' | 'compare';
export type BusyAction = 'preferences' | 'copy' | 'export' | 'save' | 'delete' | 'publishVersion' | null;

type FileTreeNode = {
  name: string;
  path: string;
  file?: SkillCatalogFile;
  children: FileTreeNode[];
};

const sortFileTree = (nodes: FileTreeNode[]): FileTreeNode[] => {
  const sortedNodes = nodes.toSorted((left, right) => {
    const leftFolder = left.children.length > 0 && !left.file;
    const rightFolder = right.children.length > 0 && !right.file;
    if (leftFolder !== rightFolder) return leftFolder ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
  sortedNodes.forEach((node) => {
    node.children = sortFileTree(node.children);
  });
  return sortedNodes;
};

const buildFileTree = (files: SkillCatalogFile[]): FileTreeNode[] => {
  const root: FileTreeNode = { name: '', path: '', children: [] };
  files.forEach((file) => {
    const parts = file.path.replaceAll('\\', '/').split('/').filter(Boolean);
    let parent = root;
    parts.forEach((name, index) => {
      const path = parts.slice(0, index + 1).join('/');
      let node = parent.children.find((item) => item.name === name);
      if (!node) {
        node = { name, path, children: [] };
        parent.children.push(node);
      }
      if (index === parts.length - 1) node.file = file;
      parent = node;
    });
  });
  return sortFileTree(root.children);
};

const FileTreeNodes: React.FC<{
  nodes: FileTreeNode[];
  depth?: number;
  selectedFilePath?: string;
  onOpenFile: (path: string) => void;
}> = ({ nodes, depth = 0, selectedFilePath, onOpenFile }) => (
  <>
    {nodes.map((node) =>
      node.children.length > 0 && !node.file ? (
        <details key={node.path} className={styles.fileFolder} open>
          <summary style={{ paddingLeft: 9 + depth * 14 }} title={node.path}>
            <FolderClose size={14} />
            <span>{node.name}</span>
          </summary>
          <FileTreeNodes
            nodes={node.children}
            depth={depth + 1}
            selectedFilePath={selectedFilePath}
            onOpenFile={onOpenFile}
          />
        </details>
      ) : (
        <Button
          key={node.path}
          type='text'
          title={node.path}
          className={node.path === selectedFilePath ? styles.fileActive : undefined}
          style={{ paddingLeft: 13 + depth * 14 }}
          onClick={() => onOpenFile(node.path)}
        >
          <span>{node.name}</span>
          <small>{compactBytes(node.file?.size ?? 0)}</small>
        </Button>
      )
    )}
  </>
);

type DiffLine = { text: string; kind: 'same' | 'added' | 'removed' };

const splitDiffLines = (value: string): string[] => {
  const lines = value.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines.length ? lines : [''];
};

const buildDiffSides = (base: string, target: string): { base: DiffLine[]; target: DiffLine[] } => {
  const baseLines: DiffLine[] = [];
  const targetLines: DiffLine[] = [];
  diffLines(base, target).forEach((part: { value: string; added?: boolean; removed?: boolean }) => {
    const lines = splitDiffLines(part.value);
    if (part.added) {
      targetLines.push(...lines.map((text) => ({ text, kind: 'added' as const })));
    } else if (part.removed) {
      baseLines.push(...lines.map((text) => ({ text, kind: 'removed' as const })));
    } else {
      baseLines.push(...lines.map((text) => ({ text, kind: 'same' as const })));
      targetLines.push(...lines.map((text) => ({ text, kind: 'same' as const })));
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
  detail?: SkillCatalogDetail;
  loading: boolean;
  failed: boolean;
  busy: BusyAction;
  activeTab: DetailTab;
  selectedFilePath?: string;
  selectedFile?: SkillCatalogFileContent;
  selectedFileLoading: boolean;
  comparison?: SkillVersionComparison;
  comparisonLoading: boolean;
  comparisonFailed: boolean;
  baseVersion?: string;
  targetVersion?: string;
  categoryOptions: string[];
  onBack: () => void;
  onTabChange: (tab: DetailTab) => void;
  onVersionChange: (version: string) => void;
  onPreferenceChange: (field: 'enabled' | 'autoInject', value: boolean) => void;
  onCopy: () => void;
  onPublish: () => void;
  onPublishVersion: () => void;
  onExport: () => void;
  onDelete: () => void;
  onOpenFile: (path: string) => void;
  onSaveFile: (content: string) => void;
  onSaveProfile: (draft: CatalogProfileDraft) => Promise<boolean>;
  onCompareVersions: (base: string, target: string) => void;
};

const FileWorkspace: React.FC<
  Pick<
    Props,
    'detail' | 'selectedFilePath' | 'selectedFile' | 'selectedFileLoading' | 'busy' | 'onOpenFile' | 'onSaveFile'
  >
> = ({ detail, selectedFilePath, selectedFile, selectedFileLoading, busy, onOpenFile, onSaveFile }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const fileTree = useMemo(() => buildFileTree(detail?.files ?? []), [detail?.files]);
  useEffect(() => setDraft(selectedFile?.content ?? ''), [selectedFile?.content, selectedFile?.path]);
  const dirty = selectedFile != null && draft !== selectedFile.content;
  if (!detail) return null;
  return (
    <div className={styles.fileWorkspace}>
      <aside className={styles.fileRail}>
        <div className={styles.fileRailTitle}>
          <strong>{t('settings.skillsHub.tabs.files')}</strong>
          <span>{detail.files.length}</span>
        </div>
        <div className={styles.fileTree}>
          <FileTreeNodes nodes={fileTree} selectedFilePath={selectedFilePath} onOpenFile={onOpenFile} />
        </div>
      </aside>
      <section className={styles.fileEditor}>
        {!selectedFilePath ? <Empty description={t('settings.skillsHub.chooseFile')} /> : null}
        {selectedFileLoading ? <Spin /> : null}
        {selectedFile ? (
          <>
            <header>
              <div>
                <strong>{selectedFile.path}</strong>
                <span>{compactBytes(selectedFile.size)}</span>
              </div>
              {selectedFile.editable ? (
                <Button
                  type='primary'
                  size='small'
                  icon={<Save />}
                  disabled={!dirty}
                  loading={busy === 'save'}
                  onClick={() => onSaveFile(draft)}
                >
                  {t('common.save')}
                </Button>
              ) : (
                <Tag>{t('settings.skillsHub.readOnly')}</Tag>
              )}
            </header>
            {selectedFile.editable ? (
              <Input.TextArea className={styles.fileTextArea} value={draft} onChange={setDraft} />
            ) : (
              <pre className={styles.fileSource}>{selectedFile.content}</pre>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
};

const VersionCompare: React.FC<
  Pick<
    Props,
    | 'detail'
    | 'comparison'
    | 'comparisonLoading'
    | 'comparisonFailed'
    | 'baseVersion'
    | 'targetVersion'
    | 'onCompareVersions'
  >
> = ({ detail, comparison, comparisonLoading, comparisonFailed, baseVersion, targetVersion, onCompareVersions }) => {
  const { t } = useTranslation();
  const versions = detail?.versions.map((item) => item.version) ?? [];
  const [selectedPath, setSelectedPath] = useState<string>();
  useEffect(() => setSelectedPath(comparison?.files[0]?.path), [comparison]);
  const selected = comparison?.files.find((file) => file.path === selectedPath);
  const diff = useMemo(
    () => buildDiffSides(selected?.baseContent ?? '', selected?.targetContent ?? ''),
    [selected?.baseContent, selected?.targetContent]
  );
  if (!detail) return null;
  const changeBase = (base: string) => {
    const target = targetVersion === base ? versions.find((version) => version !== base) : targetVersion;
    if (target) onCompareVersions(base, target);
  };
  const changeTarget = (target: string) => {
    const base = baseVersion === target ? versions.find((version) => version !== target) : baseVersion;
    if (base) onCompareVersions(base, target);
  };
  return (
    <div className={styles.compareWorkspace}>
      <div className={styles.compareControls}>
        <label>
          <span>{t('settings.skillsHub.baseVersion')}</span>
          <Select
            value={baseVersion}
            options={versions.map((version) => ({
              label: `v${version}`,
              value: version,
              disabled: version === targetVersion,
            }))}
            onChange={changeBase}
          />
        </label>
        <span>→</span>
        <label>
          <span>{t('settings.skillsHub.targetVersion')}</span>
          <Select
            value={targetVersion}
            options={versions.map((version) => ({
              label: `v${version}`,
              value: version,
              disabled: version === baseVersion,
            }))}
            onChange={changeTarget}
          />
        </label>
      </div>
      {comparisonLoading ? (
        <div className={styles.centerState}>
          <Spin />
        </div>
      ) : null}
      {!comparisonLoading && comparisonFailed ? <Empty description={t('settings.catalogCompareFailed')} /> : null}
      {!comparisonLoading && comparison?.files.length === 0 ? (
        <Empty description={t('settings.skillsHub.compareNoChanges')} />
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
              <Empty description={t('settings.skillsHub.binaryDiff')} />
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

const SkillCatalogDetailView: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const { detail } = props;
  const versionOptions = useMemo(
    () => detail?.versions.map((item) => ({ label: `v${item.version}`, value: item.version })) ?? [],
    [detail?.versions]
  );
  return (
    <main className={styles.detailMain}>
      <header className={styles.detailTopbar}>
        <Button type='text' icon={<ArrowLeft />} onClick={props.onBack}>
          {t('settings.skillsHub.detailBackToList')}
        </Button>
        {detail ? (
          <div className={styles.detailActions}>
            {detail.skill.canCopyToMine ? (
              <Button icon={<Copy />} loading={props.busy === 'copy'} onClick={props.onCopy}>
                {t('settings.skillsHub.copyToMine')}
              </Button>
            ) : null}
            {detail.skill.editable && detail.selectedVersion === detail.skill.latestVersion ? (
              <Button
                type='primary'
                icon={<Upload />}
                loading={props.busy === 'publishVersion'}
                onClick={props.onPublishVersion}
              >
                {t('settings.skillsHub.publishVersion')}
              </Button>
            ) : null}
            {detail.skill.canPublishToTjuaeHub ? (
              <Button icon={<Upload />} onClick={props.onPublish}>
                {t('settings.skillsHub.publish')}
              </Button>
            ) : null}
            <Button icon={<Download />} loading={props.busy === 'export'} onClick={props.onExport}>
              {t('settings.skillsHub.export')}
            </Button>
            {detail.skill.identity.source === 'mine' ? (
              <Tooltip content={t('settings.skillsHub.deleteConfirmTitle')}>
                <Button
                  status='danger'
                  type='text'
                  icon={<Delete />}
                  loading={props.busy === 'delete'}
                  onClick={props.onDelete}
                />
              </Tooltip>
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
          <Empty description={t('settings.skillsHub.detailNotFound')} />
        </div>
      ) : null}
      {detail ? (
        <>
          <CatalogDetailHero
            identityKey={`${detail.skill.identity.source}:${detail.skill.identity.namespace}:${detail.skill.identity.slug}`}
            glyph={<SkillGlyph skill={detail.skill} large />}
            name={detail.skill.name}
            description={detail.skill.description}
            categories={detail.skill.categories}
            categoryOptions={props.categoryOptions}
            sourceLabel={t(sourceTranslationKey[detail.skill.identity.source])}
            versionLabel={t('settings.skillsHub.version')}
            version={detail.selectedVersion}
            versionOptions={versionOptions}
            editable={detail.skill.editable && detail.selectedVersion === detail.skill.latestVersion}
            saving={props.busy === 'save'}
            noDescription={t('settings.skillsHub.noDescription')}
            onVersionChange={props.onVersionChange}
            onSave={(draft: CatalogProfileDraft) => props.onSaveProfile(draft)}
          />
          <section className={styles.preferenceBar}>
            <label>
              <Switch
                checked={detail.skill.preferences.enabled}
                loading={props.busy === 'preferences'}
                onChange={(value) => props.onPreferenceChange('enabled', value)}
              />
              <span>
                <strong>{t('settings.skillsHub.enabled')}</strong>
                <small>{t('settings.skillsHub.enabledHint')}</small>
              </span>
            </label>
            <label>
              <Switch
                checked={detail.skill.preferences.autoInject}
                disabled={!detail.skill.preferences.enabled}
                loading={props.busy === 'preferences'}
                onChange={(value) => props.onPreferenceChange('autoInject', value)}
              />
              <span>
                <strong>
                  <Magic /> {t('settings.skillsHub.autoInject')}
                </strong>
                <small>{t('settings.skillsHub.autoInjectHint')}</small>
              </span>
            </label>
          </section>
          <Tabs
            activeTab={props.activeTab}
            onChange={(key) => props.onTabChange(key as DetailTab)}
            className={styles.detailTabs}
          >
            <Tabs.TabPane key='overview' title={t('settings.skillsHub.tabs.overview')}>
              <article className={styles.readme}>
                <MarkdownPreview content={detail.readme} />
              </article>
            </Tabs.TabPane>
            <Tabs.TabPane key='files' title={`${t('settings.skillsHub.tabs.files')} · ${detail.files.length}`}>
              <FileWorkspace {...props} />
            </Tabs.TabPane>
            <Tabs.TabPane key='versions' title={t('settings.skillsHub.tabs.versions')}>
              <div className={styles.versionList}>
                {detail.versions.map((version) => (
                  <Button
                    type='text'
                    key={version.version}
                    aria-current={version.version === detail.selectedVersion ? 'true' : undefined}
                    className={version.version === detail.selectedVersion ? styles.versionSelected : undefined}
                    onClick={() => props.onVersionChange(version.version)}
                  >
                    <span>
                      <strong>v{version.version}</strong>
                      {version.version === detail.skill.latestVersion ? (
                        <Tag color='blue'>{t('settings.skillsHub.latestVersion')}</Tag>
                      ) : null}
                    </span>
                    <small>{version.contentHash ?? ''}</small>
                  </Button>
                ))}
              </div>
            </Tabs.TabPane>
            <Tabs.TabPane key='compare' title={t('settings.skillsHub.versionCompare')}>
              <VersionCompare {...props} />
            </Tabs.TabPane>
          </Tabs>
        </>
      ) : null}
    </main>
  );
};

export default SkillCatalogDetailView;
