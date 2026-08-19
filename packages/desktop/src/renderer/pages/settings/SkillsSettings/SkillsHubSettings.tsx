import { ipcBridge } from '@/common';
import type {
  SkillCatalogDetail,
  SkillCatalogFileContent,
  SkillCatalogItem,
  SkillCatalogPage,
  SkillIdentity,
  SkillSource,
  SkillVersionComparison,
} from '@/common/types/platform/skill';
import { Button, Dropdown, Empty, Input, Menu, Message, Modal, Radio, Select, Spin } from '@arco-design/web-react';
import { Plus, Search } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { useTalkToButler } from '@/renderer/hooks/assistant/useTalkToButler';
import SettingsPageWrapper from '../components/SettingsPageWrapper';
import SkillCatalogDetailView, { type BusyAction, type DetailTab } from './SkillCatalogDetailView';
import SkillCatalogDirectory from './SkillCatalogDirectory';
import styles from './SkillsHubSettings.module.css';
import { SKILL_SOURCES, skillRoute, sourceTranslationKey } from './skillCatalogPresentation';

type SourceFilter = 'all' | SkillSource;
type StatusFilter = 'all' | 'enabled' | 'autoInject';

const parseRouteSource = (value?: string): SkillSource | undefined =>
  SKILL_SOURCES.includes(value as SkillSource) ? (value as SkillSource) : undefined;

const SkillsHubSettings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const talkToButler = useTalkToButler();
  const route = useParams<{ source?: string; namespace?: string; skillName?: string }>();
  const routeSource = parseRouteSource(route.source);
  const routeIdentity: SkillIdentity | undefined =
    routeSource && route.skillName
      ? {
          source: routeSource,
          namespace: decodeURIComponent(route.namespace === '~' ? '' : (route.namespace ?? '')),
          slug: decodeURIComponent(route.skillName),
        }
      : undefined;
  const [source, setSource] = useState<SourceFilter>(routeSource ?? 'all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [selectedVersion, setSelectedVersion] = useState<string>();
  const [selectedFilePath, setSelectedFilePath] = useState<string>();
  const [baseVersion, setBaseVersion] = useState<string>();
  const [targetVersion, setTargetVersion] = useState<string>();
  const [busy, setBusy] = useState<BusyAction>(null);
  const [busyIdentity, setBusyIdentity] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createSlug, setCreateSlug] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySlug, setCopySlug] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishSlug, setPublishSlug] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setSelectedVersion(undefined);
    setSelectedFilePath(undefined);
    setBaseVersion(undefined);
    setTargetVersion(undefined);
    setDetailTab('overview');
  }, [routeIdentity?.source, routeIdentity?.namespace, routeIdentity?.slug]);

  const catalogRequest = useMemo(
    () => ({
      sources: source === 'all' ? undefined : [source],
      q: debouncedQuery.trim() || undefined,
      enabled: status === 'enabled' ? true : undefined,
      autoInject: status === 'autoInject' ? true : undefined,
      limit: 80,
    }),
    [debouncedQuery, source, status]
  );
  const catalogKey = ['skill-catalog', catalogRequest] as const;
  const {
    data: page,
    error,
    isLoading,
    mutate: refreshCatalog,
  } = useSWR<SkillCatalogPage>(catalogKey, () => ipcBridge.fs.listSkillCatalog.invoke(catalogRequest));

  const detailKey = routeIdentity ? (['skill-detail', routeIdentity, selectedVersion] as const) : null;
  const {
    data: detail,
    error: detailError,
    isLoading: detailLoading,
    mutate: refreshDetail,
  } = useSWR<SkillCatalogDetail>(detailKey, () =>
    ipcBridge.fs.getSkillCatalogDetail.invoke({ ...routeIdentity!, version: selectedVersion })
  );

  useEffect(() => {
    if (!detail) return;
    if (routeIdentity && skillRoute(routeIdentity) !== skillRoute(detail.skill.identity)) {
      void navigate(skillRoute(detail.skill.identity), { replace: true });
      return;
    }
    setSelectedFilePath((value) => value ?? detail.files[0]?.path);
    const versions = detail.versions.map((item) => item.version);
    setTargetVersion((value) => (value && versions.includes(value) ? value : detail.selectedVersion));
    setBaseVersion((value) => {
      if (value && versions.includes(value) && value !== detail.selectedVersion) return value;
      return versions.find((version) => version !== detail.selectedVersion);
    });
  }, [detail, navigate, routeIdentity]);

  const fileKey =
    routeIdentity && selectedFilePath && detail
      ? (['skill-file', routeIdentity, detail.selectedVersion, selectedFilePath] as const)
      : null;
  const {
    data: selectedFile,
    isLoading: selectedFileLoading,
    mutate: refreshFile,
  } = useSWR<SkillCatalogFileContent>(fileKey, () =>
    ipcBridge.fs.getSkillCatalogFile.invoke({
      ...routeIdentity!,
      version: detail!.selectedVersion,
      path: selectedFilePath!,
    })
  );

  const compareKey =
    routeIdentity && baseVersion && targetVersion && baseVersion !== targetVersion
      ? (['skill-compare', routeIdentity, baseVersion, targetVersion] as const)
      : null;
  const { data: comparison, isLoading: comparisonLoading } = useSWR<SkillVersionComparison>(compareKey, () =>
    ipcBridge.fs.compareSkillVersions.invoke({ ...routeIdentity!, base: baseVersion!, target: targetVersion! })
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshCatalog(), routeIdentity ? refreshDetail() : Promise.resolve()]);
  }, [refreshCatalog, refreshDetail, routeIdentity]);

  const run = useCallback(
    async <T,>(action: BusyAction, operation: () => Promise<T>, success: string): Promise<T | undefined> => {
      setBusy(action);
      try {
        const result = await operation();
        Message.success(success);
        await refreshAll();
        return result;
      } catch (operationError) {
        console.error(`[SkillCatalog] ${action ?? 'operation'} failed`, operationError);
        Message.error(t('settings.skillsHub.actionFailed'));
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [refreshAll, t]
  );

  const savePreferences = useCallback(
    async (
      skill: SkillCatalogItem,
      field: 'enabled' | 'autoInject',
      value: boolean,
      versionOverride?: { selectedVersion: string; followLatest: boolean }
    ) => {
      const key = `${skill.identity.source}:${skill.identity.namespace}:${skill.identity.slug}`;
      setBusyIdentity(key);
      const enabled = field === 'enabled' ? value : skill.preferences.enabled;
      const autoInject = enabled && (field === 'autoInject' ? value : skill.preferences.autoInject);
      const nextPreferences = {
        ...skill.preferences,
        selectedVersion: versionOverride?.selectedVersion ?? skill.preferences.selectedVersion ?? skill.latestVersion,
        followLatest: versionOverride?.followLatest ?? skill.preferences.followLatest,
        enabled,
        autoInject,
      };
      const previousPage = page;
      const previousDetail = detail;
      if (page) {
        await refreshCatalog(
          {
            ...page,
            items: page.items.map((item) =>
              skillRoute(item.identity) === skillRoute(skill.identity)
                ? { ...item, preferences: nextPreferences }
                : item
            ),
          },
          { revalidate: false }
        );
      }
      if (detail && skillRoute(detail.skill.identity) === skillRoute(skill.identity)) {
        await refreshDetail(
          { ...detail, skill: { ...detail.skill, preferences: nextPreferences } },
          { revalidate: false }
        );
      }
      try {
        await ipcBridge.fs.updateSkillPreferences.invoke({
          ...skill.identity,
          selectedVersion: nextPreferences.selectedVersion,
          followLatest: nextPreferences.followLatest,
          enabled,
          autoInject,
        });
        void Promise.all([refreshCatalog(), routeIdentity ? refreshDetail() : Promise.resolve()]);
        Message.success(t('settings.skillsHub.preferencesSaved'));
      } catch (preferenceError) {
        if (previousPage) await refreshCatalog(previousPage, { revalidate: false });
        if (previousDetail) await refreshDetail(previousDetail, { revalidate: false });
        console.error('[SkillCatalog] preference update failed', preferenceError);
        Message.error(t('settings.skillsHub.actionFailed'));
      } finally {
        setBusyIdentity(undefined);
      }
    },
    [detail, page, refreshCatalog, refreshDetail, routeIdentity, t]
  );

  const saveDetailPreference = useCallback(
    (field: 'enabled' | 'autoInject', value: boolean) => {
      if (!detail) return;
      const preferenceVersion = detail.skill.preferences.selectedVersion ?? detail.skill.latestVersion;
      setBusy('preferences');
      void savePreferences(detail.skill, field, value, {
        selectedVersion: detail.selectedVersion,
        followLatest: preferenceVersion === detail.selectedVersion && detail.skill.preferences.followLatest,
      }).finally(() => setBusy(null));
    },
    [detail, savePreferences]
  );

  const confirmCreate = useCallback(() => {
    void run(
      'save',
      () =>
        ipcBridge.fs.createSkill.invoke({
          slug: createSlug.trim(),
          name: createName.trim(),
          description: createDescription.trim(),
        }),
      t('settings.skillsHub.createSuccess')
    ).then((result) => {
      if (!result) return;
      setCreateOpen(false);
      void navigate(skillRoute(result.identity));
    });
  }, [createDescription, createName, createSlug, navigate, run, t]);

  const importZip = useCallback(async () => {
    const files = await ipcBridge.dialog.showOpen.invoke({
      properties: ['openFile'],
      filters: [{ name: 'Skill ZIP', extensions: ['zip'] }],
    });
    if (!files?.[0]) return;
    const result = await run(
      'save',
      () => ipcBridge.fs.importSkill.invoke({ archivePath: files[0] }),
      t('settings.skillsHub.importSuccess')
    );
    if (result) void navigate(skillRoute(result.identity));
  }, [navigate, run, t]);

  const handleAddAction = useCallback(
    (key: string) => {
      if (key === 'import') {
        void importZip();
      } else if (key === 'manual') {
        setCreateOpen(true);
      } else if (key === 'chat') {
        void talkToButler({ prompt: t('settings.talkToButler.prompt.addSkill') });
      }
    },
    [importZip, t, talkToButler]
  );

  const exportCurrent = useCallback(async () => {
    if (!detail || !routeIdentity) return;
    const directories = await ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory', 'createDirectory'] });
    if (!directories?.[0]) return;
    const root = directories[0].replace(/[\\/]+$/u, '');
    await run(
      'export',
      () =>
        ipcBridge.fs.exportSkill.invoke({
          ...routeIdentity,
          version: detail.selectedVersion,
          outputPath: `${root}/${detail.skill.identity.slug}-${detail.selectedVersion}.zip`,
        }),
      t('settings.skillsHub.exportSuccess')
    );
  }, [detail, routeIdentity, run, t]);

  if (routeIdentity) {
    return (
      <SettingsPageWrapper className={styles.page} contentClassName={styles.detailPageContent}>
        <SkillCatalogDetailView
          detail={detail}
          loading={detailLoading}
          failed={detailError != null}
          busy={busy}
          activeTab={detailTab}
          selectedFilePath={selectedFilePath}
          selectedFile={selectedFile}
          selectedFileLoading={selectedFileLoading}
          comparison={comparison}
          comparisonLoading={comparisonLoading}
          baseVersion={baseVersion}
          targetVersion={targetVersion}
          onBack={() => void navigate('/settings/skills')}
          onTabChange={setDetailTab}
          onVersionChange={(version) => {
            setSelectedVersion(version);
            setSelectedFilePath(undefined);
          }}
          onPreferenceChange={saveDetailPreference}
          onCopy={() => {
            setCopySlug(`${routeIdentity.slug}-copy`);
            setCopyOpen(true);
          }}
          onPublish={() => {
            setPublishSlug(routeIdentity.slug);
            setPublishOpen(true);
          }}
          onExport={() => void exportCurrent()}
          onDelete={() =>
            Modal.confirm({
              title: t('settings.skillsHub.deleteConfirmTitle'),
              content: t('settings.skillsHub.deleteConfirmContent', { name: detail?.skill.name }),
              okButtonProps: { status: 'danger' },
              onOk: async () => {
                const deleted = await run(
                  'delete',
                  () => ipcBridge.fs.deleteSkill.invoke(routeIdentity),
                  t('settings.skillsHub.deleteSuccess')
                );
                if (deleted) void navigate('/settings/skills');
              },
            })
          }
          onOpenFile={setSelectedFilePath}
          onSaveFile={(content) => {
            if (!selectedFilePath) return;
            void run(
              'save',
              () => ipcBridge.fs.saveSkillCatalogFile.invoke({ ...routeIdentity, path: selectedFilePath, content }),
              t('settings.skillsHub.saveSuccess')
            ).then(() => refreshFile());
          }}
          onCompareVersions={(base, target) => {
            setBaseVersion(base);
            setTargetVersion(target);
          }}
        />
        <Modal
          title={t('settings.skillsHub.copyTitle')}
          visible={copyOpen}
          onCancel={() => setCopyOpen(false)}
          onOk={() => {
            if (!detail) return;
            void run(
              'copy',
              () =>
                ipcBridge.fs.copySkillToMine.invoke({
                  ...routeIdentity,
                  version: detail.selectedVersion,
                  targetSlug: copySlug.trim(),
                }),
              t('settings.skillsHub.copySuccess')
            ).then((result) => {
              if (!result) return;
              setCopyOpen(false);
              void navigate(skillRoute(result.identity));
            });
          }}
        >
          <p>{t('settings.skillsHub.copyDescription')}</p>
          <Input value={copySlug} onChange={setCopySlug} placeholder={t('settings.skillsHub.copyPlaceholder')} />
        </Modal>
        <Modal
          title={t('settings.skillsHub.publishTitle')}
          visible={publishOpen}
          onCancel={() => setPublishOpen(false)}
          onOk={() => {
            if (!detail) return;
            void run(
              'copy',
              () =>
                ipcBridge.fs.publishSkillToTjuaeHub.invoke({
                  ...routeIdentity,
                  version: detail.selectedVersion,
                  targetSlug: publishSlug.trim(),
                }),
              t('settings.skillsHub.publishSuccess')
            ).then((result) => {
              if (!result) return;
              setPublishOpen(false);
            });
          }}
        >
          <p>{t('settings.skillsHub.publishHint')}</p>
          <Input value={publishSlug} onChange={setPublishSlug} placeholder={t('settings.skillsHub.slugPlaceholder')} />
        </Modal>
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper className={styles.page} contentClassName={styles.directoryPageContent}>
      <section className={styles.catalogHeader}>
        <div>
          <h1>{t('settings.skillsHub.title')}</h1>
          <p>{t('settings.skillsHub.catalogDescription')}</p>
        </div>
        <div className={styles.topActions}>
          <Dropdown
            trigger='click'
            droplist={
              <Menu onClickMenuItem={handleAddAction}>
                <Menu.Item key='import'>{t('settings.skillsHub.importSkill')}</Menu.Item>
                <Menu.Item key='manual'>{t('settings.skillsHub.addManually')}</Menu.Item>
                <Menu.Item key='chat'>{t('settings.talkToButler.addViaChat')}</Menu.Item>
              </Menu>
            }
          >
            <Button type='primary' icon={<Plus />}>
              {t('settings.skillsHub.addSkill')}
            </Button>
          </Dropdown>
        </div>
      </section>
      <section className={styles.catalogToolbar}>
        <Input
          prefix={<Search />}
          value={query}
          onChange={setQuery}
          allowClear
          placeholder={t('settings.skillsHub.searchPlaceholder')}
        />
        <Select
          value={source}
          onChange={(value) => setSource(value as SourceFilter)}
          options={[
            { label: t('settings.skillsHub.allSources'), value: 'all' },
            ...SKILL_SOURCES.map((item) => ({ label: t(sourceTranslationKey[item]), value: item })),
          ]}
        />
        <Radio.Group
          type='button'
          value={status}
          onChange={(value) => setStatus(value as StatusFilter)}
          options={[
            { label: t('settings.skillsHub.allStatuses'), value: 'all' },
            { label: t('settings.skillsHub.enabledOnly'), value: 'enabled' },
            { label: t('settings.skillsHub.autoInjectOnly'), value: 'autoInject' },
          ]}
        />
      </section>
      <div className={styles.directoryHeading}>
        <strong>{isLoading ? <Spin dot /> : t('settings.skillsHub.skillCount', { count: page?.total ?? 0 })}</strong>
        <span>{t('settings.skillsHub.autoInjectHint')}</span>
      </div>
      {error ? (
        <div className={styles.centerState}>
          <Empty description={t('settings.skillsHub.fetchError')} />
        </div>
      ) : (
        <SkillCatalogDirectory
          page={page}
          loading={isLoading}
          busyIdentity={busyIdentity}
          onOpen={(skill) => void navigate(skillRoute(skill.identity))}
          onPreferenceChange={(skill, field, value) => void savePreferences(skill, field, value)}
        />
      )}
      <Modal
        title={t('settings.skillsHub.addNew')}
        visible={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={confirmCreate}
      >
        <div className={styles.modalFields}>
          <Input value={createSlug} onChange={setCreateSlug} placeholder={t('settings.skillsHub.slugPlaceholder')} />
          <Input value={createName} onChange={setCreateName} placeholder={t('settings.skillsHub.namePlaceholder')} />
          <Input.TextArea
            value={createDescription}
            onChange={setCreateDescription}
            placeholder={t('settings.skillsHub.descriptionPlaceholder')}
          />
        </div>
      </Modal>
    </SettingsPageWrapper>
  );
};

export default SkillsHubSettings;
