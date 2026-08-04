import { isBackendHttpError } from '@/common/adapter/httpBridge';
import type {
  AssetFile,
  AssetKind,
  AssetSyncState,
  AssetTrust,
  MarketAsset,
  MarketPackage,
  MarketPresenceState,
} from '@/common/types/agent/assets';
import { uuid } from '@/common/utils';
import MarkdownView from '@/renderer/components/Markdown';
import { TjuaeSearchInput } from '@/renderer/components/base';
import { Alert, Button, Empty, Message, Radio, Select, Skeleton, Tag, Tooltip } from '@arco-design/web-react';
import { Download, FileText, FolderOpen, Refresh } from '@icon-park/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ASSET_KINDS,
  formatAssetFileSize,
  getMarketStatusPresentation,
  resolveDefaultMarketAssetFile,
} from '../components/assetUi';
import { localizeAssetError } from '../components/assetError';
import AssetSemanticDetail from '../components/AssetSemanticDetail';
import { marketApi } from './marketApi';

type TrustFilter = 'all' | AssetTrust;
type PresenceFilter = 'all' | MarketPresenceState;
type SyncFilter = 'all' | AssetSyncState;

const TRUST_FILTERS: readonly AssetTrust[] = ['official', 'verified', 'community'];
const PRESENCE_FILTERS: readonly MarketPresenceState[] = ['notInstalled', 'installed'];
const SYNC_FILTERS: readonly AssetSyncState[] = [
  'synced',
  'localModified',
  'remoteUpdated',
  'diverged',
  'conflict',
  'upstreamRemoved',
  'incompatible',
  'revoked',
  'remoteUnknown',
];

const filterSelectClass = 'min-w-120px';

const localAssetRoute = (asset: MarketAsset): string => {
  const localAssetId = encodeURIComponent(asset.local?.localAssetId ?? '');

  switch (asset.kind) {
    case 'assistant':
      return `/settings/assistants/assets/${localAssetId}`;
    case 'engineAdapter':
      return `/settings/engine/assets/${localAssetId}`;
    case 'skill':
      return `/settings/skills/assets/${localAssetId}`;
    case 'mcp':
      return `/settings/tools/assets/${localAssetId}`;
  }
};

const RemoteMarketPane: React.FC = () => {
  const { t } = useTranslation();
  const [kind, setKind] = useState<AssetKind>('assistant');
  const [search, setSearch] = useState('');
  const [trustFilter, setTrustFilter] = useState<TrustFilter>('all');
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>('all');
  const [syncFilter, setSyncFilter] = useState<SyncFilter>('all');
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [packages, setPackages] = useState<MarketPackage[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingAssetId, setPendingAssetId] = useState<string>();
  const [selectedPath, setSelectedPath] = useState<string>();
  const [remoteView, setRemoteView] = useState<'preview' | 'source'>('preview');
  const [remoteFile, setRemoteFile] = useState<AssetFile>();
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [fileError, setFileError] = useState<unknown>();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<unknown>();
  const requestIdRef = useRef(0);
  const fileRequestIdRef = useRef(0);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());

  const loadAssets = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(undefined);
    try {
      const index = await marketApi.listAssets.invoke({ kind, search });
      if (requestId !== requestIdRef.current) return;
      setAssets(index.assets);
      setPackages(index.packages);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setAssets([]);
      setPackages([]);
      setSelectedId(undefined);
      setError(loadError);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [kind, search]);

  const visibleAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          (trustFilter === 'all' || asset.trust === trustFilter) &&
          (presenceFilter === 'all' || asset.presenceState === presenceFilter) &&
          (syncFilter === 'all' || asset.syncState === syncFilter)
      ),
    [assets, presenceFilter, syncFilter, trustFilter]
  );

  useEffect(() => {
    setSelectedId((current) =>
      current && visibleAssets.some((asset) => asset.id === current) ? current : visibleAssets[0]?.id
    );
  }, [visibleAssets]);

  const refreshMarket = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await marketApi.refresh.invoke({});
      await loadAssets();
      Message.success(t('common.refreshSuccess'));
    } catch (refreshError) {
      Message.error(localizeAssetError(t, refreshError, 'settings.assetWorkbench.remoteLoadError'));
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAssets, t]);

  const runAssetOperation = useCallback(
    async (asset: MarketAsset, action: 'install' | 'sync') => {
      const operation = action === 'sync' ? marketApi.sync : marketApi.install;
      setPendingAssetId(asset.id);
      try {
        const result = await operation.invoke({
          remoteAssetId: asset.id,
          idempotencyKey: `market-${uuid(36)}`,
        });
        if (result.state === 'failed' || result.state === 'rolledBack') {
          Message.error(t('settings.assetWorkbench.operationFailed'));
          return;
        }
        await loadAssets();
        Message.success(
          t(action === 'install' ? 'settings.assetWorkbench.installSuccess' : 'settings.assetWorkbench.syncSuccess')
        );
      } catch (operationError) {
        Message.error(localizeAssetError(t, operationError, 'settings.assetWorkbench.operationFailed'));
      } finally {
        setPendingAssetId(undefined);
      }
    },
    [loadAssets, t]
  );

  const openLocalCopy = useCallback((asset: MarketAsset) => {
    window.location.hash = localAssetRoute(asset);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAssets();
    }, 250);
    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [loadAssets]);

  const selectedAsset = useMemo(
    () => visibleAssets.find((asset) => asset.id === selectedId),
    [selectedId, visibleAssets]
  );
  const selectedPackage = useMemo(
    () => packages.find((entry) => entry.name === selectedAsset?.packageName),
    [packages, selectedAsset?.packageName]
  );

  const loadSemanticFile = useCallback(
    async (path: string) => {
      if (!selectedAsset) throw new Error('remote asset is required');
      return marketApi.readFile.invoke({ remoteAssetId: selectedAsset.id, path });
    },
    [selectedAsset]
  );

  useEffect(() => {
    setAdvancedOpen(false);
    setSelectedPath((current) => {
      if (current && selectedAsset?.files.some((file) => file.path === current)) return current;
      return selectedAsset ? resolveDefaultMarketAssetFile(selectedAsset)?.path : undefined;
    });
  }, [selectedAsset]);

  useEffect(() => {
    setRemoteView('preview');
    const requestId = ++fileRequestIdRef.current;
    setRemoteFile(undefined);
    setFileError(undefined);
    if (!selectedAsset || !selectedPath) {
      setIsFileLoading(false);
      return;
    }
    setIsFileLoading(true);
    void marketApi.readFile
      .invoke({ remoteAssetId: selectedAsset.id, path: selectedPath })
      .then((file) => {
        if (requestId === fileRequestIdRef.current) setRemoteFile(file);
      })
      .catch((readError) => {
        if (requestId === fileRequestIdRef.current) setFileError(readError);
      })
      .finally(() => {
        if (requestId === fileRequestIdRef.current) setIsFileLoading(false);
      });
    return () => {
      fileRequestIdRef.current += 1;
    };
  }, [selectedAsset, selectedPath]);

  const focusOption = useCallback(
    (nextIndex: number) => {
      const nextAsset = visibleAssets[nextIndex];
      if (!nextAsset) return;
      setSelectedId(nextAsset.id);
      window.requestAnimationFrame(() => optionRefs.current.get(nextAsset.id)?.focus());
    },
    [visibleAssets]
  );

  const handleAssetListKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || visibleAssets.length === 0) return;
      event.preventDefault();
      const currentIndex = Math.max(
        0,
        visibleAssets.findIndex((asset) => asset.id === selectedId)
      );
      if (event.key === 'Home') return focusOption(0);
      if (event.key === 'End') return focusOption(visibleAssets.length - 1);
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      focusOption((currentIndex + offset + visibleAssets.length) % visibleAssets.length);
    },
    [focusOption, selectedId, visibleAssets]
  );

  const endpointUnavailable = isBackendHttpError(error) && [404, 501, 503].includes(error.status);
  const hasActiveFilter =
    Boolean(search.trim()) || trustFilter !== 'all' || presenceFilter !== 'all' || syncFilter !== 'all';

  return (
    <section
      className='flex min-h-[560px] flex-col overflow-hidden rounded-12px border border-border-2 bg-1 text-t-primary'
      data-testid='remote-market'
      data-theme-aware='true'
      aria-label={t('settings.assetWorkbench.remoteMarket')}
    >
      <div className='flex flex-col gap-10px border-b border-border-2 px-14px py-12px'>
        <div className='flex flex-col gap-10px lg:flex-row lg:items-center lg:justify-between'>
          <Radio.Group
            type='button'
            value={kind}
            onChange={(value) => setKind(value as AssetKind)}
            aria-label={t('settings.assetWorkbench.kindLabel')}
          >
            {ASSET_KINDS.map((item) => (
              <Radio key={item.kind} value={item.kind} data-testid={`market-kind-${item.kind}`}>
                <span className='inline-flex items-center gap-6px'>
                  {item.icon}
                  {t(item.labelKey)}
                </span>
              </Radio>
            ))}
          </Radio.Group>
          <div className='flex min-w-0 items-center gap-8px'>
            <TjuaeSearchInput
              className='min-w-0 flex-1 lg:w-240px'
              value={search}
              onChange={setSearch}
              placeholder={t('settings.assetWorkbench.searchRemotePlaceholder')}
              inputProps={{ 'aria-label': t('settings.assetWorkbench.searchRemotePlaceholder') }}
            />
            <Tooltip content={t('common.refresh')}>
              <Button
                type='text'
                icon={<Refresh aria-hidden='true' />}
                loading={isRefreshing}
                aria-label={t('common.refresh')}
                onClick={() => void refreshMarket()}
              />
            </Tooltip>
          </div>
        </div>

        <div
          className='flex flex-wrap items-center gap-8px'
          role='group'
          aria-label={t('settings.assetWorkbench.filters.label')}
          data-testid='market-filters'
        >
          <label className='inline-flex items-center gap-6px text-11px text-t-secondary'>
            <span>{t('settings.assetWorkbench.filters.trust')}</span>
            <Select
              size='small'
              className={filterSelectClass}
              value={trustFilter}
              aria-label={t('settings.assetWorkbench.filters.trust')}
              onChange={(value) => setTrustFilter(value as TrustFilter)}
            >
              <Select.Option value='all'>{t('settings.assetWorkbench.filters.all')}</Select.Option>
              {TRUST_FILTERS.map((value) => (
                <Select.Option key={value} value={value}>
                  {t(`settings.assetWorkbench.trust.${value}`)}
                </Select.Option>
              ))}
            </Select>
          </label>
          <label className='inline-flex items-center gap-6px text-11px text-t-secondary'>
            <span>{t('settings.assetWorkbench.filters.installation')}</span>
            <Select
              size='small'
              className={filterSelectClass}
              value={presenceFilter}
              aria-label={t('settings.assetWorkbench.filters.installation')}
              onChange={(value) => {
                const next = value as PresenceFilter;
                setPresenceFilter(next);
                if (next === 'notInstalled') setSyncFilter('all');
              }}
            >
              <Select.Option value='all'>{t('settings.assetWorkbench.filters.all')}</Select.Option>
              {PRESENCE_FILTERS.map((value) => (
                <Select.Option key={value} value={value}>
                  {t(`settings.assetWorkbench.presenceStates.${value}`)}
                </Select.Option>
              ))}
            </Select>
          </label>
          <label className='inline-flex items-center gap-6px text-11px text-t-secondary'>
            <span>{t('settings.assetWorkbench.filters.sync')}</span>
            <Select
              size='small'
              className={filterSelectClass}
              value={syncFilter}
              aria-label={t('settings.assetWorkbench.filters.sync')}
              onChange={(value) => {
                const next = value as SyncFilter;
                setSyncFilter(next);
                if (next !== 'all') setPresenceFilter('installed');
              }}
            >
              <Select.Option value='all'>{t('settings.assetWorkbench.filters.all')}</Select.Option>
              {SYNC_FILTERS.map((value) => (
                <Select.Option key={value} value={value}>
                  {t(`settings.assetWorkbench.syncStates.${value}`)}
                </Select.Option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      {isLoading && assets.length === 0 ? (
        <div className='grid flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]'>
          <div className='border-b border-border-2 p-16px lg:border-b-0 lg:border-r'>
            <Skeleton animation text={{ rows: 8 }} />
          </div>
          <div className='p-20px'>
            <Skeleton animation text={{ rows: 12 }} />
          </div>
        </div>
      ) : error ? (
        <div className='flex min-h-420px flex-col items-center justify-center gap-14px p-24px'>
          {endpointUnavailable ? (
            <Empty description={t('settings.assetWorkbench.remoteUnavailable')} />
          ) : (
            <Alert
              className='max-w-560px'
              type='error'
              showIcon
              title={t('settings.assetWorkbench.remoteLoadError')}
              content={localizeAssetError(t, error, 'settings.assetWorkbench.remoteLoadError')}
            />
          )}
          <Button type='outline' size='small' onClick={() => void loadAssets()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : assets.length === 0 || visibleAssets.length === 0 ? (
        <div className='flex min-h-420px items-center justify-center p-24px'>
          <Empty
            description={t(
              hasActiveFilter ? 'settings.assetWorkbench.noSearchResults' : 'settings.assetWorkbench.remoteEmpty'
            )}
          />
        </div>
      ) : (
        <div
          className='grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]'
          data-testid='market-workspace'
        >
          <div
            className='max-h-260px overflow-y-auto border-b border-border-2 lg:max-h-none lg:border-b-0 lg:border-r'
            role='listbox'
            aria-label={t('settings.assetWorkbench.remoteAssetList')}
            data-testid='market-asset-list'
            onKeyDown={handleAssetListKeyDown}
          >
            {visibleAssets.map((asset) => {
              const selected = asset.id === selectedId;
              const status = getMarketStatusPresentation(asset);
              return (
                <Button
                  key={asset.id}
                  ref={(element) => {
                    const button = element as HTMLButtonElement | null;
                    if (button) optionRefs.current.set(asset.id, button);
                    else optionRefs.current.delete(asset.id);
                  }}
                  type='text'
                  long
                  className={classNames(
                    '!h-auto !w-full !items-start !justify-start !gap-10px !rounded-none !border-0 !border-b !border-border-1 !px-14px !py-12px !text-left last:!border-b-0 focus-visible:!outline focus-visible:!outline-2 focus-visible:!outline-primary-6',
                    selected ? '!bg-fill-2' : '!bg-transparent hover:!bg-fill-1'
                  )}
                  role='option'
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setSelectedId(asset.id)}
                >
                  <span
                    className={classNames(
                      'mt-1px inline-flex min-w-0 shrink-0 items-center gap-4px text-10px font-500',
                      status.className
                    )}
                    aria-label={t(status.labelKey)}
                  >
                    {status.icon}
                    <span>{t(status.labelKey)}</span>
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='flex items-center gap-6px'>
                      <span className='min-w-0 flex-1 truncate text-13px font-600 text-t-primary'>
                        {asset.displayName}
                      </span>
                      <span className='shrink-0 text-10px text-t-tertiary'>v{asset.version}</span>
                    </span>
                    <span className='mt-3px block truncate text-11px text-t-tertiary'>{asset.description}</span>
                  </span>
                </Button>
              );
            })}
          </div>

          {selectedAsset ? (
            <div className='min-h-0 overflow-y-auto' data-testid='market-detail'>
              <div className='border-b border-border-2 px-16px py-14px'>
                <div className='flex flex-col gap-12px sm:flex-row sm:items-start sm:justify-between'>
                  <div className='min-w-0'>
                    <h2 className='m-0 text-17px font-700 text-t-primary'>{selectedAsset.displayName}</h2>
                    <p className='m-0 mt-5px text-12px leading-20px text-t-secondary'>{selectedAsset.description}</p>
                  </div>
                  <div className='flex shrink-0 flex-wrap items-center gap-8px'>
                    <Tag
                      className={
                        selectedAsset.compatibility.compatible
                          ? '!border-success-2 !bg-success-1 !text-success-6'
                          : '!border-danger-2 !bg-danger-1 !text-danger-6'
                      }
                    >
                      {t(
                        selectedAsset.compatibility.compatible
                          ? 'settings.assetWorkbench.compatible'
                          : 'settings.assetWorkbench.incompatible'
                      )}
                    </Tag>
                    {selectedAsset.presenceState === 'installed' && selectedAsset.local ? (
                      <Button
                        type={selectedAsset.allowedActions.includes('sync') ? 'outline' : 'primary'}
                        size='small'
                        icon={<FolderOpen aria-hidden='true' />}
                        disabled={Boolean(pendingAssetId)}
                        onClick={() => openLocalCopy(selectedAsset)}
                      >
                        {t('settings.assetWorkbench.openLocalCopy')}
                      </Button>
                    ) : null}
                    {selectedAsset.presenceState === 'notInstalled' &&
                    selectedAsset.allowedActions.includes('install') ? (
                      <Button
                        type='primary'
                        size='small'
                        icon={<Download aria-hidden='true' />}
                        loading={pendingAssetId === selectedAsset.id}
                        disabled={!selectedAsset.compatibility.compatible || Boolean(pendingAssetId)}
                        onClick={() => void runAssetOperation(selectedAsset, 'install')}
                      >
                        {t('settings.assetWorkbench.installToLocal')}
                      </Button>
                    ) : null}
                    {selectedAsset.presenceState === 'installed' && selectedAsset.allowedActions.includes('sync') ? (
                      <Button
                        type='primary'
                        size='small'
                        icon={<Refresh aria-hidden='true' />}
                        loading={pendingAssetId === selectedAsset.id}
                        disabled={!selectedAsset.compatibility.compatible || Boolean(pendingAssetId)}
                        onClick={() => void runAssetOperation(selectedAsset, 'sync')}
                      >
                        {t('settings.assetWorkbench.syncLocalCopy')}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {selectedAsset.status !== 'active' ? (
                  <Alert
                    className='mt-12px'
                    type={selectedAsset.status === 'revoked' ? 'error' : 'warning'}
                    showIcon
                    title={t(`settings.assetWorkbench.assetStatuses.${selectedAsset.status}`)}
                    content={t(`settings.assetWorkbench.lifecycleWarnings.${selectedAsset.status}`)}
                  />
                ) : null}
                <div className='mt-10px flex flex-wrap gap-6px'>
                  <Tag bordered>v{selectedAsset.version}</Tag>
                  <Tag bordered>{selectedAsset.author}</Tag>
                  <Tag bordered>{t(`settings.assetWorkbench.trust.${selectedAsset.trust}`)}</Tag>
                  <Tag
                    bordered
                    className={
                      selectedAsset.status === 'revoked'
                        ? '!border-danger-2 !text-danger-6'
                        : selectedAsset.status === 'deprecated'
                          ? '!border-warning-2 !text-warning-6'
                          : undefined
                    }
                  >
                    {t(`settings.assetWorkbench.assetStatuses.${selectedAsset.status}`)}
                  </Tag>
                </div>

                <details
                  className='mt-12px border-t border-border-1 pt-10px text-12px'
                  data-testid='market-advanced-info'
                >
                  <summary className='cursor-pointer select-none font-600 text-t-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-6'>
                    {t('settings.assetWorkbench.advancedInfo')}
                  </summary>
                  <dl className='mt-10px grid grid-cols-[minmax(110px,auto)_minmax(0,1fr)] gap-x-12px gap-y-8px'>
                    <dt className='text-t-tertiary'>{t('settings.assetWorkbench.metadata.package')}</dt>
                    <dd className='m-0 break-all font-mono text-t-primary'>{selectedAsset.packageName}</dd>
                    <dt className='text-t-tertiary'>{t('settings.assetWorkbench.metadata.revision')}</dt>
                    <dd className='m-0 break-all font-mono text-t-primary'>{selectedAsset.sourceRevision}</dd>
                    <dt className='text-t-tertiary'>{t('settings.assetWorkbench.metadata.digest')}</dt>
                    <dd className='m-0 break-all font-mono text-t-primary'>{selectedAsset.definitionDigest}</dd>
                    <dt className='text-t-tertiary'>{t('settings.assetWorkbench.metadata.compatibility')}</dt>
                    <dd className='m-0 text-t-primary'>{selectedAsset.compatibility.tjuae}</dd>
                    <dt className='text-t-tertiary'>{t('settings.assetWorkbench.metadata.license')}</dt>
                    <dd className='m-0 text-t-primary'>{selectedAsset.license}</dd>
                    <dt className='text-t-tertiary'>{t('settings.assetWorkbench.metadata.status')}</dt>
                    <dd className='m-0 text-t-primary'>
                      {t(`settings.assetWorkbench.assetStatuses.${selectedAsset.status}`)}
                    </dd>
                    <dt className='text-t-tertiary'>{t('settings.assetWorkbench.metadata.reviewStatus')}</dt>
                    <dd className='m-0 text-t-primary'>
                      {selectedPackage
                        ? t(`settings.assetWorkbench.reviewStatuses.${selectedPackage.reviewStatus}`)
                        : t('settings.assetWorkbench.metadata.none')}
                    </dd>
                    <dt className='text-t-tertiary'>{t('settings.assetWorkbench.metadata.dependencies')}</dt>
                    <dd className='m-0 text-t-primary'>
                      {selectedAsset.dependencies.length > 0
                        ? selectedAsset.dependencies.join(', ')
                        : t('settings.assetWorkbench.metadata.none')}
                    </dd>
                    <dt className='text-t-tertiary'>{t('settings.assetWorkbench.metadata.packageDependencies')}</dt>
                    <dd className='m-0 text-t-primary'>
                      {selectedPackage && Object.keys(selectedPackage.dependencies).length > 0
                        ? Object.entries(selectedPackage.dependencies)
                            .map(([name, range]) => `${name} ${range}`)
                            .join(', ')
                        : t('settings.assetWorkbench.metadata.none')}
                    </dd>
                  </dl>
                </details>
              </div>

              <AssetSemanticDetail
                assetKey={`${selectedAsset.id}:${selectedAsset.definitionDigest}`}
                kind={selectedAsset.kind}
                description={selectedAsset.description}
                runtimeId={selectedAsset.runtimeId}
                entryFile={selectedAsset.entryFile}
                files={selectedAsset.files}
                dependencies={selectedAsset.dependencies}
                version={selectedAsset.version}
                runtimeState={t(`settings.assetWorkbench.presenceStates.${selectedAsset.presenceState}`)}
                healthState={t(`settings.assetWorkbench.assetStatuses.${selectedAsset.status}`)}
                loadFile={loadSemanticFile}
                onOpenFile={(path) => {
                  setSelectedPath(path);
                  setAdvancedOpen(true);
                }}
              />

              <details
                className='border-t border-border-2'
                open={advancedOpen}
                onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
                data-testid='market-advanced-source'
              >
                <summary className='cursor-pointer select-none px-18px py-12px text-12px font-600 text-t-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-6'>
                  {t('settings.assetWorkbench.semantic.advancedSource')}
                </summary>
                {advancedOpen ? (
                  <div className='grid min-h-420px grid-cols-1 border-t border-border-2 xl:grid-cols-[230px_minmax(0,1fr)]'>
                    <div className='border-b border-border-2 p-12px xl:border-b-0 xl:border-r'>
                      <div className='px-4px pb-8px text-11px font-600 uppercase tracking-wide text-t-tertiary'>
                        {t('settings.assetWorkbench.fileTree')}
                      </div>
                      <ul className='m-0 flex list-none flex-col p-0' role='list'>
                        {selectedAsset.files.map((file) => (
                          <li key={file.path} className='border-b border-border-1 last:border-b-0'>
                            <Button
                              type='text'
                              long
                              aria-current={selectedPath === file.path ? 'true' : undefined}
                              aria-label={file.path}
                              className={classNames(
                                '!h-auto !w-full !min-w-0 !items-center !justify-start !gap-7px !rounded-none !border-0 !px-4px !py-8px !text-left focus-visible:!outline focus-visible:!outline-2 focus-visible:!outline-primary-6',
                                selectedPath === file.path ? '!bg-fill-2' : '!bg-transparent hover:!bg-fill-1'
                              )}
                              onClick={() => setSelectedPath(file.path)}
                            >
                              <FileText aria-hidden='true' size='14' className='shrink-0 text-t-tertiary' />
                              <span className='min-w-0 flex-1 truncate text-12px text-t-primary'>{file.path}</span>
                              <span className='shrink-0 text-10px text-t-tertiary'>
                                {formatAssetFileSize(file.size)}
                              </span>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className='flex min-h-300px min-w-0 flex-col'>
                      <div className='flex items-center justify-between gap-12px border-b border-border-2 px-12px py-10px'>
                        <div className='min-w-0 truncate font-mono text-12px font-600 text-t-primary'>
                          {selectedPath}
                        </div>
                        <Radio.Group
                          type='button'
                          size='small'
                          value={remoteView}
                          onChange={(value) => setRemoteView(value as 'preview' | 'source')}
                          aria-label={t('settings.assetWorkbench.viewMode')}
                        >
                          <Radio value='preview'>{t('settings.assetWorkbench.views.preview')}</Radio>
                          <Radio value='source'>{t('settings.assetWorkbench.views.source')}</Radio>
                        </Radio.Group>
                      </div>
                      <div className='min-h-0 flex-1 overflow-auto'>
                        {isFileLoading ? (
                          <div className='p-16px'>
                            <Skeleton animation text={{ rows: 12 }} />
                          </div>
                        ) : fileError ? (
                          <div className='p-16px'>
                            {isBackendHttpError(fileError) && fileError.code === 'ASSET_BINARY_FILE' ? (
                              <Empty description={t('settings.assetWorkbench.binaryFile')} />
                            ) : (
                              <Alert
                                type='error'
                                showIcon
                                title={t('settings.assetWorkbench.fileLoadError')}
                                content={localizeAssetError(t, fileError, 'settings.assetWorkbench.fileLoadError')}
                              />
                            )}
                          </div>
                        ) : !remoteFile ? (
                          <div className='flex min-h-300px items-center justify-center p-24px'>
                            <Empty description={t('settings.assetWorkbench.selectFile')} />
                          </div>
                        ) : remoteView === 'preview' &&
                          (remoteFile.mediaType === 'text/markdown' ||
                            remoteFile.path.toLowerCase().endsWith('.md')) ? (
                          <div className='p-16px'>
                            <MarkdownView>{remoteFile.content}</MarkdownView>
                          </div>
                        ) : (
                          <pre className='m-0 min-h-300px overflow-auto whitespace-pre-wrap break-words bg-fill-1 p-14px font-mono text-12px leading-20px text-t-primary'>
                            {remoteFile.content}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </details>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
};

export default RemoteMarketPane;
