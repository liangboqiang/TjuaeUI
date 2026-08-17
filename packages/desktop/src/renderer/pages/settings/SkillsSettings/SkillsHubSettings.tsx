import { ipcBridge } from '@/common';
import type { MarketSkill, SkillPreferences, SkillWorkspace } from '@/common/types/platform/skill';
import { TjuaeSearchInput } from '@/renderer/components/base';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import {
  Button,
  Dropdown,
  Empty,
  Input,
  Menu,
  Message,
  Modal,
  Select,
  Spin,
  Switch,
  Tag,
  Tooltip,
} from '@arco-design/web-react';
import { Copy, FolderOpen, More, Plus, Refresh, Upload } from '@icon-park/react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import SettingsPageHeader from '../components/SettingsPageHeader';
import SettingsPageWrapper from '../components/SettingsPageWrapper';
import styles from './SkillsHubSettings.module.css';

type SkillView = 'mine' | 'market';
type BusyAction = { slug: string; action: string } | null;

const syncStateKey = {
  notInstalled: 'settings.skillsHub.syncState.notInstalled',
  synced: 'settings.skillsHub.syncState.synced',
  localChanged: 'settings.skillsHub.syncState.localChanged',
  updateAvailable: 'settings.skillsHub.syncState.updateAvailable',
  diverged: 'settings.skillsHub.syncState.diverged',
} as const;

const gitStatusKey = {
  clean: 'settings.skillsHub.gitStatus.clean',
  modified: 'settings.skillsHub.gitStatus.modified',
  conflicted: 'settings.skillsHub.gitStatus.conflicted',
  unknown: 'settings.skillsHub.gitStatus.unknown',
} as const;

type SkillsHubSettingsProps = {
  withWrapper?: boolean;
};

const matchesSearch = (name: string, description: string, query: string): boolean => {
  const normalized = query.trim().toLocaleLowerCase();
  return !normalized || `${name}\n${description}`.toLocaleLowerCase().includes(normalized);
};

const SkillIdentity: React.FC<{ name: string; version: string; categories: string[] }> = ({
  name,
  version,
  categories,
}) => (
  <div className='min-w-0'>
    <div className='flex min-w-0 items-center gap-8px'>
      <span className='truncate text-15px font-600 text-t-primary'>{name}</span>
      <span className='shrink-0 text-11px text-t-tertiary'>v{version}</span>
    </div>
    {categories.length > 0 ? (
      <div className='mt-8px flex flex-wrap gap-6px'>
        {categories.slice(0, 3).map((category) => (
          <Tag key={category} size='small' bordered={false} color='gray'>
            {category}
          </Tag>
        ))}
      </div>
    ) : null}
  </div>
);

const SkillAvatar: React.FC<{ name: string }> = ({ name }) => (
  <div className={styles.avatar} aria-hidden='true'>
    {name.trim().charAt(0).toLocaleUpperCase() || 'S'}
  </div>
);

const SkillsHubSettings: React.FC<SkillsHubSettingsProps> = ({ withWrapper = true }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useLayoutContext()?.isMobile ?? false;
  const [activeView, setActiveView] = useState<SkillView>('mine');
  const [activeMarket, setActiveMarket] = useState('tjuae-hub');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<BusyAction>(null);
  const [copySource, setCopySource] = useState<SkillWorkspace | null>(null);
  const [copySlug, setCopySlug] = useState('');
  const [createMode, setCreateMode] = useState<'manual' | 'butler' | null>(null);
  const [createSlug, setCreateSlug] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [cloneVisible, setCloneVisible] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [publishSource, setPublishSource] = useState<SkillWorkspace | null>(null);
  const [forkRepositoryUrl, setForkRepositoryUrl] = useState('');
  const [publishMessage, setPublishMessage] = useState('');

  const {
    data: installed = [],
    error: installedError,
    isLoading: installedLoading,
    mutate: refreshInstalled,
  } = useSWR<SkillWorkspace[]>('skills.workspaces', () => ipcBridge.fs.listAvailableSkills.invoke());
  const {
    data: market = [],
    error: marketError,
    isLoading: marketLoading,
    mutate: refreshMarket,
  } = useSWR<MarketSkill[]>('skills.market', () => ipcBridge.fs.listMarketSkills.invoke());

  const filteredInstalled = useMemo(
    () => installed.filter((skill) => matchesSearch(skill.name, skill.description, query)),
    [installed, query]
  );
  const markets = useMemo(
    () => Array.from(new Map(market.map((skill) => [skill.market.id, skill.market])).values()),
    [market]
  );
  const filteredMarket = useMemo(
    () =>
      market.filter((skill) => skill.market.id === activeMarket && matchesSearch(skill.name, skill.description, query)),
    [activeMarket, market, query]
  );

  const refresh = useCallback(async () => {
    await Promise.all([refreshInstalled(), refreshMarket()]);
  }, [refreshInstalled, refreshMarket]);

  const runAction = useCallback(
    async (slug: string, action: string, operation: () => Promise<unknown>, successMessage: string) => {
      setBusy({ slug, action });
      try {
        await operation();
        Message.success(successMessage);
        await refresh();
      } catch (error) {
        console.error(`[SkillsHub] ${action} failed`, error);
        Message.error(t('settings.skillsHub.actionFailed'));
      } finally {
        setBusy(null);
      }
    },
    [refresh, t]
  );

  const openSkill = useCallback(
    (slug: string) => {
      void navigate(`/settings/skills/detail/${encodeURIComponent(slug)}`);
    },
    [navigate]
  );

  const compareSkill = useCallback(
    (marketId: string, slug: string) => {
      void navigate(`/settings/skills/detail/${encodeURIComponent(slug)}`, {
        state: { marketComparison: { marketId, slug } },
      });
    },
    [navigate]
  );

  const importSkill = useCallback(async () => {
    const paths = await ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory'] });
    const source = paths?.[0];
    if (!source) return;
    await runAction(
      source,
      'import',
      () => ipcBridge.fs.importSkill.invoke({ skill_path: source }),
      t('settings.skillsHub.importSuccess')
    );
  }, [runAction, t]);

  const confirmCreate = useCallback(async () => {
    const slug = createSlug.trim().toLocaleLowerCase();
    const name = createName.trim();
    const description = createDescription.trim();
    if (!slug || !name || !description) return;
    setBusy({ slug, action: 'create' });
    try {
      const created = await ipcBridge.fs.createSkill.invoke({ slug, name, description });
      Message.success(t('settings.skillsHub.createSuccess'));
      setCreateMode(null);
      setCreateSlug('');
      setCreateName('');
      setCreateDescription('');
      await refresh();
      openSkill(created.slug);
    } catch (error) {
      console.error('[SkillsHub] create failed', error);
      Message.error(t('settings.skillsHub.actionFailed'));
    } finally {
      setBusy(null);
    }
  }, [createDescription, createName, createSlug, openSkill, refresh, t]);

  const confirmClone = useCallback(async () => {
    const repositoryUrl = cloneUrl.trim();
    if (!repositoryUrl) return;
    setBusy({ slug: repositoryUrl, action: 'clone' });
    try {
      const created = await ipcBridge.fs.cloneSkill.invoke({ repositoryUrl });
      Message.success(t('settings.skillsHub.cloneSuccess'));
      setCloneVisible(false);
      setCloneUrl('');
      await refresh();
      openSkill(created.slug);
    } catch (error) {
      console.error('[SkillsHub] clone failed', error);
      Message.error(t('settings.skillsHub.actionFailed'));
    } finally {
      setBusy(null);
    }
  }, [cloneUrl, openSkill, refresh, t]);

  const updatePreferences = useCallback(
    async (skill: SkillWorkspace, patch: Partial<SkillPreferences>) => {
      const next = { ...skill.preferences, ...patch };
      await runAction(
        skill.slug,
        'preferences',
        () => ipcBridge.fs.updateSkillPreferences.invoke({ slug: skill.slug, ...next }),
        t('settings.skillsHub.preferencesSaved')
      );
    },
    [runAction, t]
  );

  const confirmDelete = useCallback(
    (skill: SkillWorkspace) => {
      Modal.confirm({
        title: t('settings.skillsHub.deleteConfirmTitle'),
        content: t('settings.skillsHub.deleteConfirmContent', { name: skill.name }),
        okButtonProps: { status: 'danger' },
        onOk: () =>
          runAction(
            skill.slug,
            'delete',
            () => ipcBridge.fs.deleteSkill.invoke({ skill_name: skill.slug }),
            t('settings.skillsHub.deleteSuccess')
          ),
      });
    },
    [runAction, t]
  );

  const showCopy = useCallback((skill: SkillWorkspace) => {
    setCopySource(skill);
    setCopySlug(`${skill.slug}-copy`);
  }, []);

  const confirmCopy = useCallback(async () => {
    if (!copySource || !copySlug.trim()) return;
    const source = copySource;
    const targetSlug = copySlug.trim().toLocaleLowerCase();
    await runAction(
      source.slug,
      'copy',
      () => ipcBridge.fs.copySkill.invoke({ slug: source.slug, targetSlug }),
      t('settings.skillsHub.copySuccess')
    );
    setCopySource(null);
  }, [copySlug, copySource, runAction, t]);

  const confirmPublish = useCallback(async () => {
    if (
      !publishSource ||
      publishSource.source.kind !== 'market' ||
      !forkRepositoryUrl.trim() ||
      !publishMessage.trim()
    ) {
      return;
    }
    setBusy({ slug: publishSource.slug, action: 'publish' });
    try {
      const result = await ipcBridge.fs.publishMarketSkill.invoke({
        marketId: publishSource.source.marketId,
        slug: publishSource.slug,
        forkRepositoryUrl: forkRepositoryUrl.trim(),
        message: publishMessage.trim(),
      });
      Message.success(t('settings.skillsHub.publishSuccess'));
      setPublishSource(null);
      setForkRepositoryUrl('');
      setPublishMessage('');
      await ipcBridge.shell.openExternal.invoke(result.compareUrl);
      await refresh();
    } catch (error) {
      console.error('[SkillsHub] publish failed', error);
      Message.error(t('settings.skillsHub.actionFailed'));
    } finally {
      setBusy(null);
    }
  }, [forkRepositoryUrl, publishMessage, publishSource, refresh, t]);

  const installedCards = filteredInstalled.map((skill) => {
    const pending = busy?.slug === skill.slug;
    const source = skill.source;
    const marketEntry =
      source.kind === 'market'
        ? market.find(
            (entry) =>
              entry.market.id === source.marketId &&
              entry.market.repository === source.repository &&
              entry.path === source.path
          )
        : undefined;
    const menu = (
      <Menu>
        {source.kind === 'market' ? (
          <Menu.Item key='compare' onClick={() => compareSkill(source.marketId, skill.slug)}>
            {t('settings.skillsHub.compare')}
          </Menu.Item>
        ) : null}
        {source.kind === 'market' &&
        marketEntry &&
        (marketEntry.syncState === 'localChanged' || marketEntry.syncState === 'diverged') ? (
          <Menu.Item key='publish' onClick={() => setPublishSource(skill)}>
            {t('settings.skillsHub.publish')}
          </Menu.Item>
        ) : null}
        <Menu.Item key='copy' onClick={() => showCopy(skill)}>
          <span className='flex items-center gap-8px'>
            <Copy size={15} /> {t('settings.skillsHub.copy')}
          </span>
        </Menu.Item>
        <Menu.Item key='reveal' onClick={() => void ipcBridge.shell.showItemInFolder.invoke(skill.path)}>
          <span className='flex items-center gap-8px'>
            <FolderOpen size={15} /> {t('conversation.history.openInExplorer')}
          </span>
        </Menu.Item>
        <Menu.Item key='delete' onClick={() => confirmDelete(skill)}>
          <span className='text-danger'>{t('common.delete')}</span>
        </Menu.Item>
      </Menu>
    );

    return (
      <article
        key={skill.id}
        className={styles.card}
        data-testid={`skill-card-${skill.slug}`}
        onClick={() => openSkill(skill.slug)}
      >
        <div className='flex min-w-0 items-start gap-12px'>
          <SkillAvatar name={skill.name} />
          <div className='min-w-0 flex-1'>
            <SkillIdentity name={skill.name} version={skill.version} categories={skill.categories} />
            <p className={styles.description}>{skill.description}</p>
          </div>
          <Dropdown trigger='click' position='br' droplist={menu}>
            <Button
              type='text'
              shape='circle'
              size='mini'
              icon={<More size={17} />}
              aria-label={t('common.more')}
              onClick={(event) => event.stopPropagation()}
            />
          </Dropdown>
        </div>
        <div className={styles.cardFooter} onClick={(event) => event.stopPropagation()}>
          <span className='text-11px text-t-tertiary'>
            {marketEntry
              ? t(syncStateKey[marketEntry.syncState])
              : source.kind === 'market'
                ? t('settings.skillsHub.sourceMarket')
                : t('settings.skillsHub.sourceLocal')}
            {' · '}
            {t(gitStatusKey[skill.gitStatus])}
          </span>
          <div className='flex items-center gap-14px'>
            <Tooltip content={t('settings.skillsHub.autoInjectHint')}>
              <span className='flex items-center gap-6px text-12px text-t-secondary'>
                {t('settings.skillsHub.autoInject')}
                <Switch
                  size='small'
                  checked={skill.preferences.autoInject}
                  disabled={pending || !skill.preferences.enabled}
                  onChange={(checked) => void updatePreferences(skill, { autoInject: checked })}
                />
              </span>
            </Tooltip>
            <span className='flex items-center gap-6px text-12px text-t-secondary'>
              {t('common.enable')}
              <Switch
                size='small'
                checked={skill.preferences.enabled}
                loading={pending && busy?.action === 'preferences'}
                disabled={pending}
                onChange={(checked) =>
                  void updatePreferences(skill, {
                    enabled: checked,
                    autoInject: checked ? skill.preferences.autoInject : false,
                  })
                }
              />
            </span>
          </div>
        </div>
      </article>
    );
  });

  const marketCards = filteredMarket.map((skill) => {
    const pending = busy?.slug === skill.slug;
    const local = installed.find((item) => item.id === skill.id);
    const action = !skill.installed ? (
      <Button
        size='small'
        type='primary'
        loading={pending}
        onClick={(event) => {
          event.stopPropagation();
          void runAction(
            skill.slug,
            'install',
            () => ipcBridge.fs.installMarketSkill.invoke({ marketId: skill.market.id, slug: skill.slug }),
            t('settings.skillsHub.installSuccess')
          );
        }}
      >
        {t('settings.skillsHub.install')}
      </Button>
    ) : skill.syncState === 'updateAvailable' ? (
      <div className='flex items-center gap-8px'>
        <Button
          size='small'
          type='text'
          onClick={(event) => {
            event.stopPropagation();
            compareSkill(skill.market.id, skill.slug);
          }}
        >
          {t('settings.skillsHub.compare')}
        </Button>
        <Button
          size='small'
          type='primary'
          icon={<Upload size={14} />}
          loading={pending}
          onClick={(event) => {
            event.stopPropagation();
            void runAction(
              skill.slug,
              'update',
              () => ipcBridge.fs.updateMarketSkill.invoke({ marketId: skill.market.id, slug: skill.slug }),
              t('settings.skillsHub.updateSuccess')
            );
          }}
        >
          {t('settings.skillsHub.update')}
        </Button>
      </div>
    ) : skill.syncState === 'localChanged' || skill.syncState === 'diverged' ? (
      <Button
        size='small'
        type='outline'
        onClick={(event) => {
          event.stopPropagation();
          compareSkill(skill.market.id, skill.slug);
        }}
      >
        {t('settings.skillsHub.compare')}
      </Button>
    ) : (
      <Button
        size='small'
        type='outline'
        onClick={(event) => {
          event.stopPropagation();
          openSkill(skill.slug);
        }}
      >
        {t('settings.skillsHub.open')}
      </Button>
    );

    return (
      <article
        key={skill.id}
        className={styles.card}
        data-testid={`market-skill-card-${skill.slug}`}
        onClick={() => local && openSkill(skill.slug)}
      >
        <div className='flex min-w-0 items-start gap-12px'>
          <SkillAvatar name={skill.name} />
          <div className='min-w-0 flex-1'>
            <SkillIdentity name={skill.name} version={skill.version} categories={skill.categories} />
            <p className={styles.description}>{skill.description}</p>
          </div>
        </div>
        <div className={styles.cardFooter}>
          <span className='text-11px text-t-tertiary'>
            {skill.installed
              ? `${t(syncStateKey[skill.syncState])} · ${t('settings.skillsHub.installedVersion', {
                  version: skill.installedVersion,
                })}`
              : t('settings.skillsHub.remoteMarket')}
          </span>
          {action}
        </div>
      </article>
    );
  });

  const content = (
    <div className='flex flex-col gap-18px' data-testid='skills-settings'>
      <SettingsPageHeader
        title={t('settings.skillsHub.title')}
        description={t('settings.skillsHub.description')}
        activeTab={activeView}
        onTabChange={(key) => setActiveView(key as SkillView)}
        tabs={[
          { key: 'mine', label: t('settings.skillsHub.mySkills'), count: installed.length },
          { key: 'market', label: t('settings.skillsHub.market'), count: market.length },
        ]}
        actions={
          <>
            <TjuaeSearchInput
              value={query}
              onChange={setQuery}
              placeholder={t('settings.skillsHub.searchPlaceholder')}
              className={isMobile ? 'w-160px' : 'w-260px'}
            />
            {activeView === 'market' ? (
              <Select
                value={activeMarket}
                onChange={setActiveMarket}
                size='small'
                className='w-130px'
                aria-label={t('settings.skillsHub.marketSource')}
              >
                {markets.length > 0 ? (
                  markets.map((marketInfo) => (
                    <Select.Option key={marketInfo.id} value={marketInfo.id}>
                      {marketInfo.name}
                    </Select.Option>
                  ))
                ) : (
                  <Select.Option value='tjuae-hub'>TjuaeHub</Select.Option>
                )}
              </Select>
            ) : null}
            <Tooltip content={t('common.refresh')}>
              <Button type='text' shape='circle' icon={<Refresh size={16} />} onClick={() => void refresh()} />
            </Tooltip>
            {activeView === 'mine' ? (
              <Dropdown
                trigger='click'
                position='br'
                droplist={
                  <Menu>
                    <Menu.Item key='new' onClick={() => setCreateMode('manual')}>
                      {t('settings.skillsHub.addNew')}
                    </Menu.Item>
                    <Menu.Item key='butler' onClick={() => setCreateMode('butler')}>
                      {t('settings.skillsHub.addWithButler')}
                    </Menu.Item>
                    <Menu.Item key='import' onClick={() => void importSkill()}>
                      {t('settings.skillsHub.importFolder')}
                    </Menu.Item>
                    <Menu.Item key='clone' onClick={() => setCloneVisible(true)}>
                      {t('settings.skillsHub.cloneGit')}
                    </Menu.Item>
                  </Menu>
                }
              >
                <Button type='primary' size='small' icon={<Plus size={15} />}>
                  {t('settings.skillsHub.addSkill')}
                </Button>
              </Dropdown>
            ) : null}
          </>
        }
      />

      {(activeView === 'mine' ? installedError : marketError) ? (
        <div className='rounded-12px border border-danger-3 bg-danger-1 px-16px py-12px text-13px text-danger'>
          {t('settings.skillsHub.fetchError')}
        </div>
      ) : (activeView === 'mine' ? installedLoading : marketLoading) ? (
        <div className='flex min-h-240px items-center justify-center'>
          <Spin />
        </div>
      ) : (activeView === 'mine' ? installedCards : marketCards).length > 0 ? (
        <div className={styles.grid}>{activeView === 'mine' ? installedCards : marketCards}</div>
      ) : (
        <Empty
          description={
            activeView === 'mine' ? t('settings.skillsHub.noSkills') : t('settings.skillsHub.noSearchResults')
          }
        />
      )}

      <Modal
        title={t('settings.skillsHub.copyTitle')}
        visible={Boolean(copySource)}
        onCancel={() => setCopySource(null)}
        onOk={() => void confirmCopy()}
        okButtonProps={{ disabled: !copySlug.trim(), loading: busy?.action === 'copy' }}
      >
        <p className='mt-0 text-13px text-t-secondary'>{t('settings.skillsHub.copyDescription')}</p>
        <Input value={copySlug} onChange={setCopySlug} placeholder={t('settings.skillsHub.copyPlaceholder')} />
      </Modal>

      <Modal
        title={t('settings.skillsHub.publishTitle')}
        visible={Boolean(publishSource)}
        onCancel={() => setPublishSource(null)}
        onOk={() => void confirmPublish()}
        okText={t('settings.skillsHub.publish')}
        okButtonProps={{
          disabled: !forkRepositoryUrl.trim() || !publishMessage.trim(),
          loading: busy?.action === 'publish',
        }}
      >
        <div className='flex flex-col gap-12px'>
          <p className='m-0 text-13px text-t-secondary'>{t('settings.skillsHub.publishHint')}</p>
          <Input
            value={forkRepositoryUrl}
            onChange={setForkRepositoryUrl}
            placeholder={t('settings.skillsHub.forkUrlPlaceholder')}
          />
          <Input.TextArea
            value={publishMessage}
            onChange={setPublishMessage}
            autoSize={{ minRows: 3, maxRows: 6 }}
            placeholder={t('settings.skillsHub.publishMessagePlaceholder')}
          />
        </div>
      </Modal>

      <Modal
        title={createMode === 'butler' ? t('settings.skillsHub.addWithButler') : t('settings.skillsHub.addNew')}
        visible={createMode != null}
        onCancel={() => setCreateMode(null)}
        onOk={() => void confirmCreate()}
        okButtonProps={{
          disabled: !createSlug.trim() || !createName.trim() || !createDescription.trim(),
          loading: busy?.action === 'create',
        }}
      >
        <div className='flex flex-col gap-12px'>
          {createMode === 'butler' ? (
            <p className='m-0 text-13px text-t-secondary'>{t('settings.skillsHub.butlerCreateHint')}</p>
          ) : null}
          <Input value={createSlug} onChange={setCreateSlug} placeholder={t('settings.skillsHub.slugPlaceholder')} />
          <Input value={createName} onChange={setCreateName} placeholder={t('settings.skillsHub.namePlaceholder')} />
          <Input.TextArea
            value={createDescription}
            onChange={setCreateDescription}
            autoSize={{ minRows: 3, maxRows: 6 }}
            placeholder={t('settings.skillsHub.descriptionPlaceholder')}
          />
        </div>
      </Modal>

      <Modal
        title={t('settings.skillsHub.cloneGit')}
        visible={cloneVisible}
        onCancel={() => setCloneVisible(false)}
        onOk={() => void confirmClone()}
        okButtonProps={{ disabled: !cloneUrl.trim(), loading: busy?.action === 'clone' }}
      >
        <Input value={cloneUrl} onChange={setCloneUrl} placeholder={t('settings.skillsHub.gitUrlPlaceholder')} />
      </Modal>
    </div>
  );

  return withWrapper ? <SettingsPageWrapper>{content}</SettingsPageWrapper> : content;
};

export default SkillsHubSettings;
