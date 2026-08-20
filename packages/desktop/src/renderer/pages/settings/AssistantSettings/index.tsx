import { ipcBridge } from '@/common';
import type {
  AssistantActivationChoice,
  AssistantActivationPlan,
  AssistantCatalogDetail,
  AssistantCatalogIdentity,
  AssistantCatalogItem,
  AssistantCatalogPage,
  AssistantCatalogSource,
  AssistantRequirementKind,
  AssistantVersionComparison,
  UpdateAssistantCatalogSettingsRequest,
} from '@/common/types/platform/assistantCatalog';
import { Button, Input, Message, Modal, Radio, Select } from '@arco-design/web-react';
import { Plus, Search } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import SettingsPageWrapper from '../components/SettingsPageWrapper';
import styles from '../SkillsSettings/SkillsHubSettings.module.css';
import AssistantActivationModal from './AssistantActivationModal';
import AssistantCatalogDetailView, { type AssistantDetailTab } from './AssistantCatalogDetailView';
import AssistantCatalogDirectory from './AssistantCatalogDirectory';
import {
  ASSISTANT_SOURCES,
  assistantCatalogRoute,
  assistantSourceTranslationKey,
} from './assistantCatalogPresentation';

type SourceFilter = 'all' | AssistantCatalogSource;
type StatusFilter = 'all' | 'enabled' | 'disabled';
type ActivationAttempt = { assistant: AssistantCatalogItem; version: string };

const describeError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const parseSource = (value?: string): AssistantCatalogSource | undefined =>
  ASSISTANT_SOURCES.includes(value as AssistantCatalogSource) ? (value as AssistantCatalogSource) : undefined;

const AssistantSettings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const route = useParams<{ source?: string; namespace?: string; assistantName?: string }>();
  const routeSource = parseSource(route.source);
  const routeIdentity: AssistantCatalogIdentity | undefined =
    routeSource && route.assistantName
      ? {
          source: routeSource,
          namespace: decodeURIComponent(route.namespace === '~' ? '' : (route.namespace ?? '')),
          slug: decodeURIComponent(route.assistantName),
        }
      : undefined;

  const [source, setSource] = useState<SourceFilter>(routeSource ?? 'all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [busyIdentity, setBusyIdentity] = useState<string>();
  const [detailTab, setDetailTab] = useState<AssistantDetailTab>('overview');
  const [selectedVersion, setSelectedVersion] = useState<string>();
  const [baseVersion, setBaseVersion] = useState<string>();
  const [targetVersion, setTargetVersion] = useState<string>();
  const [activationPlan, setActivationPlan] = useState<AssistantActivationPlan>();
  const [activationVisible, setActivationVisible] = useState(false);
  const [activationSubmitting, setActivationSubmitting] = useState(false);
  const [activationRetrying, setActivationRetrying] = useState(false);
  const [activationError, setActivationError] = useState<string>();
  const [activationAttempt, setActivationAttempt] = useState<ActivationAttempt>();
  const [createVisible, setCreateVisible] = useState(false);
  const [createSlug, setCreateSlug] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [copyVisible, setCopyVisible] = useState(false);
  const [copySlug, setCopySlug] = useState('');
  const [publishVisible, setPublishVisible] = useState(false);
  const [publishMessage, setPublishMessage] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setSelectedVersion(undefined);
    setBaseVersion(undefined);
    setTargetVersion(undefined);
    setDetailTab('overview');
  }, [routeIdentity?.source, routeIdentity?.namespace, routeIdentity?.slug]);

  const listSources = source === 'all' ? ASSISTANT_SOURCES : [source];
  const catalogKey = ['assistant-catalog', listSources.join(','), debouncedQuery, status] as const;
  const {
    data: page,
    error,
    isLoading,
    mutate: refreshCatalog,
  } = useSWR<AssistantCatalogPage>(catalogKey, async () => {
    const pages = await Promise.all(
      listSources.map((catalogSource) =>
        ipcBridge.assistants.listCatalog.invoke({
          source: catalogSource,
          query: debouncedQuery || undefined,
          limit: 100,
        })
      )
    );
    const items = pages
      .flatMap((item) => item.items)
      .filter((item) =>
        status === 'all' ? true : status === 'enabled' ? item.preferences.enabled : !item.preferences.enabled
      )
      .sort((left, right) => left.name.localeCompare(right.name));
    return { items, total: items.length };
  });

  const detailKey = routeIdentity ? ['assistant-catalog-detail', routeIdentity, selectedVersion] : null;
  const {
    data: detail,
    error: detailError,
    isLoading: detailLoading,
    mutate: refreshDetail,
  } = useSWR<AssistantCatalogDetail>(detailKey, () =>
    ipcBridge.assistants.getCatalogDetail.invoke({ ...routeIdentity!, version: selectedVersion })
  );

  useEffect(() => {
    if (!detail) return;
    const versions = detail.versions.map((item) => item.version);
    setTargetVersion((current) => (current && versions.includes(current) ? current : detail.manifest.version));
    setBaseVersion((current) => {
      if (current && versions.includes(current) && current !== detail.manifest.version) return current;
      return versions.find((version) => version !== detail.manifest.version);
    });
  }, [detail]);

  const compareKey =
    routeIdentity && baseVersion && targetVersion && baseVersion !== targetVersion
      ? ['assistant-version-compare', routeIdentity, baseVersion, targetVersion]
      : null;
  const { data: comparison, isLoading: comparisonLoading } = useSWR<AssistantVersionComparison>(compareKey, () =>
    ipcBridge.assistants.compareCatalogVersions.invoke({
      ...routeIdentity!,
      base: baseVersion!,
      target: targetVersion!,
    })
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshCatalog(), routeIdentity ? refreshDetail() : Promise.resolve()]);
  }, [refreshCatalog, refreshDetail, routeIdentity]);

  const identityKey = (identity: AssistantCatalogIdentity) =>
    `${identity.source}:${identity.namespace}:${identity.slug}`;

  const commitActivation = useCallback(
    async (
      plan: AssistantActivationPlan,
      confirmedGroups: AssistantRequirementKind[],
      choices: AssistantActivationChoice[]
    ) => {
      setActivationSubmitting(true);
      try {
        await ipcBridge.assistants.commitActivation.invoke({
          ...plan.identity,
          planId: plan.planId,
          fingerprint: plan.fingerprint,
          confirmedGroups,
          choices,
        });
        setActivationVisible(false);
        setActivationPlan(undefined);
        setActivationError(undefined);
        setActivationAttempt(undefined);
        Message.success(t('settings.assistantCatalog.activation.enabledSuccess'));
        await refreshAll();
      } catch (activationError) {
        console.error('[AssistantCatalog] activation failed', activationError);
        setActivationError(describeError(activationError));
      } finally {
        setActivationSubmitting(false);
        setBusyIdentity(undefined);
      }
    },
    [refreshAll, t]
  );

  const prepareActivation = useCallback(
    async (attempt: ActivationAttempt, retry = false) => {
      const key = identityKey(attempt.assistant.identity);
      setBusyIdentity(key);
      setActivationAttempt(attempt);
      setActivationVisible(true);
      setActivationPlan(undefined);
      setActivationError(undefined);
      setActivationRetrying(retry);
      try {
        const plan = await ipcBridge.assistants.prepareActivation.invoke({
          ...attempt.assistant.identity,
          version: attempt.version,
        });
        setActivationPlan(plan);
        if (plan.readyWithoutChanges) await commitActivation(plan, [], []);
      } catch (prepareError) {
        console.error('[AssistantCatalog] prepare activation failed', prepareError);
        setActivationError(describeError(prepareError));
        setBusyIdentity(undefined);
      } finally {
        setActivationRetrying(false);
      }
    },
    [commitActivation]
  );

  const changeEnabled = useCallback(
    async (assistant: AssistantCatalogItem, enabled: boolean, version?: string) => {
      const key = identityKey(assistant.identity);
      setBusyIdentity(key);
      if (!enabled) {
        try {
          await ipcBridge.assistants.updateCatalogPreferences.invoke({
            ...assistant.identity,
            selectedVersion: version ?? assistant.preferences.selectedVersion ?? assistant.latestVersion,
            followLatest: assistant.preferences.followLatest,
            enabled: false,
            sortOrder: assistant.preferences.sortOrder,
          });
          Message.success(t('settings.assistantCatalog.disabledSuccess'));
          await refreshAll();
        } catch (disableError) {
          console.error('[AssistantCatalog] disable failed', disableError);
          Message.error(t('settings.assistantCatalog.actionFailed'));
        } finally {
          setBusyIdentity(undefined);
        }
        return;
      }
      await prepareActivation({
        assistant,
        version: version ?? assistant.preferences.selectedVersion ?? assistant.latestVersion,
      });
    },
    [prepareActivation, refreshAll, t]
  );

  const createAssistant = async () => {
    if (!createSlug.trim() || !createName.trim()) return;
    try {
      const created = await ipcBridge.assistants.createMine.invoke({
        slug: createSlug.trim(),
        name: createName.trim(),
        description: createDescription.trim(),
      });
      setCreateVisible(false);
      setCreateSlug('');
      setCreateName('');
      setCreateDescription('');
      await refreshCatalog();
      void navigate(assistantCatalogRoute(created.item.identity));
      Message.success(t('settings.assistantCatalog.createSuccess'));
    } catch (createError) {
      console.error('[AssistantCatalog] create failed', createError);
      Message.error(t('settings.assistantCatalog.actionFailed'));
    }
  };

  const copyToMine = async () => {
    if (!routeIdentity || !detail || !copySlug.trim()) return;
    try {
      const copied = await ipcBridge.assistants.copyToMine.invoke({
        ...routeIdentity,
        version: detail.manifest.version,
        targetSlug: copySlug.trim(),
      });
      setCopyVisible(false);
      setCopySlug('');
      await refreshCatalog();
      void navigate(assistantCatalogRoute(copied.item.identity));
      Message.success(t('settings.assistantCatalog.copySuccess'));
    } catch (copyError) {
      console.error('[AssistantCatalog] copy failed', copyError);
      Message.error(t('settings.assistantCatalog.actionFailed'));
    }
  };

  const exportCurrent = async () => {
    if (!routeIdentity || !detail) return;
    const directories = await ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory', 'createDirectory'] });
    if (!directories?.[0]) return;
    const root = directories[0].replace(/[\\/]+$/u, '');
    try {
      await ipcBridge.assistants.exportCatalog.invoke({
        ...routeIdentity,
        version: detail.manifest.version,
        outputPath: `${root}/${routeIdentity.slug}-${detail.manifest.version}.zip`,
      });
      Message.success(t('settings.assistantCatalog.exportSuccess'));
    } catch (exportError) {
      console.error('[AssistantCatalog] export failed', exportError);
      Message.error(t('settings.assistantCatalog.actionFailed'));
    }
  };

  const saveSettings = async (
    settings: Omit<UpdateAssistantCatalogSettingsRequest, 'source' | 'namespace' | 'slug'>
  ) => {
    if (!routeIdentity) return;
    setBusyIdentity(identityKey(routeIdentity));
    try {
      await ipcBridge.assistants.updateCatalogSettings.invoke({ ...routeIdentity, ...settings });
      await Promise.all([refreshDetail(), refreshCatalog()]);
      Message.success(t('settings.assistantCatalog.settingsSaved'));
    } catch (saveError) {
      console.error('[AssistantCatalog] save settings failed', saveError);
      Message.error(t('settings.assistantCatalog.actionFailed'));
    } finally {
      setBusyIdentity(undefined);
    }
  };

  const deleteCurrent = () => {
    if (!routeIdentity || routeIdentity.source !== 'mine') return;
    Modal.confirm({
      title: t('settings.assistantCatalog.deleteTitle'),
      content: t('settings.assistantCatalog.deleteConfirm'),
      okButtonProps: { status: 'danger' },
      onOk: async () => {
        await ipcBridge.assistants.deleteCatalog.invoke(routeIdentity);
        await refreshCatalog();
        Message.success(t('settings.assistantCatalog.deleteSuccess'));
        void navigate('/settings/assistants');
      },
    });
  };

  const publishCurrent = async () => {
    if (!routeIdentity || routeIdentity.source !== 'tjuae-hub' || !publishMessage.trim()) return;
    setBusyIdentity(identityKey(routeIdentity));
    try {
      await ipcBridge.assistants.publishCatalog.invoke({
        ...routeIdentity,
        message: publishMessage.trim(),
      });
      setPublishVisible(false);
      setPublishMessage('');
      await refreshAll();
      Message.success(t('settings.assistantCatalog.publishSuccess'));
    } catch (publishError) {
      console.error('[AssistantCatalog] publish failed', publishError);
      Message.error(t('settings.assistantCatalog.actionFailed'));
    } finally {
      setBusyIdentity(undefined);
    }
  };

  const currentAssistant = detail?.item;
  if (routeIdentity) {
    return (
      <SettingsPageWrapper className={styles.page} contentClassName={styles.detailPageContent}>
        <AssistantCatalogDetailView
          detail={detail}
          loading={detailLoading}
          failed={Boolean(detailError)}
          busy={Boolean(currentAssistant && busyIdentity === identityKey(currentAssistant.identity))}
          activeTab={detailTab}
          comparison={comparison}
          comparisonLoading={comparisonLoading}
          baseVersion={baseVersion}
          targetVersion={targetVersion}
          onBack={() => void navigate('/settings/assistants')}
          onTabChange={setDetailTab}
          onVersionChange={setSelectedVersion}
          onEnabledChange={(enabled) => {
            if (currentAssistant) void changeEnabled(currentAssistant, enabled, detail?.manifest.version);
          }}
          onCompareVersions={(base, target) => {
            setBaseVersion(base);
            setTargetVersion(target);
          }}
          onCopyToMine={() => {
            setCopySlug(`${routeIdentity.slug}-copy`);
            setCopyVisible(true);
          }}
          onExport={() => void exportCurrent()}
          onSaveSettings={(settings) => void saveSettings(settings)}
          onDelete={deleteCurrent}
          onPublish={() => setPublishVisible(true)}
        />
        <AssistantActivationModal
          plan={activationPlan}
          error={activationError}
          visible={activationVisible}
          submitting={activationSubmitting}
          retrying={activationRetrying}
          onCancel={() => {
            setActivationVisible(false);
            setActivationPlan(undefined);
            setActivationError(undefined);
            setActivationAttempt(undefined);
            setBusyIdentity(undefined);
          }}
          onRetry={() => {
            if (activationAttempt) void prepareActivation(activationAttempt, true);
          }}
          onCommit={(groups, choices) => {
            if (activationPlan) void commitActivation(activationPlan, groups, choices);
          }}
          onOpenSettings={(kind) => {
            const path =
              kind === 'mcp'
                ? '/settings/tools'
                : kind === 'model'
                  ? '/settings/model'
                  : kind === 'agent'
                    ? '/settings/agent'
                    : '/settings/skills';
            void navigate(path);
          }}
        />
        <Modal
          visible={copyVisible}
          title={t('settings.assistantCatalog.copyTitle')}
          okButtonProps={{ disabled: !copySlug.trim() }}
          onOk={() => void copyToMine()}
          onCancel={() => setCopyVisible(false)}
        >
          <Input value={copySlug} onChange={setCopySlug} placeholder={t('settings.assistantCatalog.slugPlaceholder')} />
        </Modal>
        <Modal
          visible={publishVisible}
          title={t('settings.assistantCatalog.publishTitle')}
          okButtonProps={{ disabled: !publishMessage.trim() }}
          onOk={() => void publishCurrent()}
          onCancel={() => setPublishVisible(false)}
        >
          <Input.TextArea
            value={publishMessage}
            onChange={setPublishMessage}
            maxLength={500}
            showWordLimit
            placeholder={t('settings.assistantCatalog.publishPlaceholder')}
          />
        </Modal>
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper className={styles.page} contentClassName={styles.directoryPageContent}>
      <header className={styles.catalogHeader}>
        <div>
          <h1>{t('settings.assistantCatalog.title')}</h1>
          <p>{t('settings.assistantCatalog.description')}</p>
        </div>
        <Button type='primary' icon={<Plus />} onClick={() => setCreateVisible(true)}>
          {t('settings.assistantCatalog.add')}
        </Button>
      </header>
      <div className={styles.catalogToolbar}>
        <Input
          allowClear
          prefix={<Search />}
          value={query}
          placeholder={t('settings.assistantCatalog.searchPlaceholder')}
          onChange={setQuery}
        />
        <Select
          value={source}
          onChange={setSource}
          options={[
            { value: 'all', label: t('settings.assistantCatalog.allSources') },
            ...ASSISTANT_SOURCES.map((item) => ({ value: item, label: t(assistantSourceTranslationKey[item]) })),
          ]}
        />
        <Radio.Group
          type='button'
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: t('settings.assistantCatalog.allStatuses') },
            { value: 'enabled', label: t('settings.assistantCatalog.enabledOnly') },
            { value: 'disabled', label: t('settings.assistantCatalog.disabledOnly') },
          ]}
        />
      </div>
      <div className={styles.directoryHeading}>
        <strong>{t('settings.assistantCatalog.loadedCount', { count: page?.total ?? 0 })}</strong>
        {error ? <span>{t('settings.assistantCatalog.fetchFailed')}</span> : null}
      </div>
      <AssistantCatalogDirectory
        page={page}
        loading={isLoading}
        busyIdentity={busyIdentity}
        onOpen={(assistant) => void navigate(assistantCatalogRoute(assistant.identity))}
        onEnabledChange={(assistant, enabled) => void changeEnabled(assistant, enabled)}
      />
      <AssistantActivationModal
        plan={activationPlan}
        error={activationError}
        visible={activationVisible}
        submitting={activationSubmitting}
        retrying={activationRetrying}
        onCancel={() => {
          setActivationVisible(false);
          setActivationPlan(undefined);
          setActivationError(undefined);
          setActivationAttempt(undefined);
          setBusyIdentity(undefined);
        }}
        onRetry={() => {
          if (activationAttempt) void prepareActivation(activationAttempt, true);
        }}
        onCommit={(groups, choices) => {
          if (activationPlan) void commitActivation(activationPlan, groups, choices);
        }}
        onOpenSettings={(kind) => {
          const path =
            kind === 'mcp'
              ? '/settings/tools'
              : kind === 'model'
                ? '/settings/model'
                : kind === 'agent'
                  ? '/settings/agent'
                  : '/settings/skills';
          void navigate(path);
        }}
      />
      <Modal
        visible={createVisible}
        title={t('settings.assistantCatalog.createTitle')}
        okButtonProps={{ disabled: !createSlug.trim() || !createName.trim() }}
        onOk={() => void createAssistant()}
        onCancel={() => setCreateVisible(false)}
      >
        <div className={styles.modalFields}>
          <Input
            value={createSlug}
            onChange={setCreateSlug}
            placeholder={t('settings.assistantCatalog.slugPlaceholder')}
          />
          <Input
            value={createName}
            onChange={setCreateName}
            placeholder={t('settings.assistantCatalog.namePlaceholder')}
          />
          <Input.TextArea
            value={createDescription}
            onChange={setCreateDescription}
            placeholder={t('settings.assistantCatalog.descriptionPlaceholder')}
          />
        </div>
      </Modal>
    </SettingsPageWrapper>
  );
};

export default AssistantSettings;
