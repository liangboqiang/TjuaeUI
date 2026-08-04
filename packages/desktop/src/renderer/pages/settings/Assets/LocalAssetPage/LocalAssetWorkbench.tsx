import type { AssetKind, AssetSummary } from '@/common/types/agent/assets';
import { TjuaeSearchInput } from '@/renderer/components/base';
import { Alert, Button, Empty, Radio, Skeleton, Tooltip } from '@arco-design/web-react';
import { Refresh } from '@icon-park/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeAssetError } from '../components/assetError';
import { ASSET_KINDS, getRuntimeStatePresentation, getSyncStatePresentation } from '../components/assetUi';
import AssetDetailPanel from './AssetDetailPanel';
import AssetPublishDialog from './AssetPublishDialog';
import { assetApi } from './assetApi';

type LocalAssetWorkbenchProps = {
  initialKind?: AssetKind;
  initialAssetId?: string;
  showKindSelector?: boolean;
};

const LocalAssetWorkbench: React.FC<LocalAssetWorkbenchProps> = ({
  initialKind = 'assistant',
  initialAssetId,
  showKindSelector = true,
}) => {
  const { t } = useTranslation();
  const [kind, setKind] = useState<AssetKind>(initialKind);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(initialAssetId);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const requestIdRef = useRef(0);

  const loadAssets = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(undefined);
    try {
      const nextAssets = await assetApi.list.invoke({ kind });
      if (requestId !== requestIdRef.current) return;
      setAssets(nextAssets);
      setSelectedAssetId((current) =>
        current && nextAssets.some((asset) => asset.id === current)
          ? current
          : initialAssetId && nextAssets.some((asset) => asset.id === initialAssetId)
            ? initialAssetId
            : nextAssets[0]?.id
      );
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setAssets([]);
      setSelectedAssetId(undefined);
      setError(loadError);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [initialAssetId, kind]);

  useEffect(() => {
    setKind(initialKind);
    setSelectedAssetId(initialAssetId);
  }, [initialAssetId, initialKind]);

  useEffect(() => {
    void loadAssets();
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadAssets]);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleAssets = useMemo(
    () =>
      normalizedSearch
        ? assets.filter((asset) =>
            [asset.displayName, asset.description, asset.id]
              .filter(Boolean)
              .join(' ')
              .toLocaleLowerCase()
              .includes(normalizedSearch)
          )
        : assets,
    [assets, normalizedSearch]
  );
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);

  useEffect(() => {
    if (selectedAssetId && visibleAssets.some((asset) => asset.id === selectedAssetId)) return;
    setSelectedAssetId(visibleAssets[0]?.id);
  }, [selectedAssetId, visibleAssets]);

  return (
    <section
      className='flex min-h-[560px] flex-col overflow-hidden rounded-12px border border-border-2 bg-1'
      data-testid='local-asset-workbench'
    >
      <div className='flex flex-col gap-10px border-b border-border-2 px-14px py-12px lg:flex-row lg:items-center lg:justify-between'>
        {showKindSelector ? (
          <Radio.Group
            type='button'
            value={kind}
            onChange={(value) => setKind(value as AssetKind)}
            aria-label={t('settings.assetWorkbench.kindLabel')}
          >
            {ASSET_KINDS.map((item) => (
              <Radio key={item.kind} value={item.kind}>
                <span className='inline-flex items-center gap-6px'>
                  {item.icon}
                  {t(item.labelKey)}
                </span>
              </Radio>
            ))}
          </Radio.Group>
        ) : (
          <span className='text-13px font-600 text-t-primary'>
            {t(ASSET_KINDS.find((item) => item.kind === kind)?.labelKey ?? 'settings.assetWorkbench.kindLabel')}
          </span>
        )}
        <div className='flex items-center gap-8px'>
          <TjuaeSearchInput
            className='min-w-0 flex-1 lg:w-220px'
            value={search}
            onChange={setSearch}
            placeholder={t('settings.assetWorkbench.searchLocalPlaceholder')}
            inputProps={{ 'aria-label': t('settings.assetWorkbench.searchLocalPlaceholder') }}
          />
          <Tooltip content={t('common.refresh')}>
            <Button
              type='text'
              icon={<Refresh aria-hidden='true' />}
              loading={isLoading}
              aria-label={t('common.refresh')}
              onClick={() => void loadAssets()}
            />
          </Tooltip>
          <AssetPublishDialog asset={selectedAsset} />
        </div>
      </div>

      {error ? (
        <div className='p-20px'>
          <Alert
            type='error'
            showIcon
            title={t('settings.assetWorkbench.localLoadError')}
            content={
              <div className='flex flex-col items-start gap-10px'>
                <span>{localizeAssetError(t, error, 'settings.assetWorkbench.localLoadError')}</span>
                <Button size='small' type='outline' onClick={() => void loadAssets()}>
                  {t('common.retry')}
                </Button>
              </div>
            }
          />
        </div>
      ) : isLoading && assets.length === 0 ? (
        <div className='grid flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]'>
          <div className='border-b border-border-2 p-16px lg:border-b-0 lg:border-r'>
            <Skeleton animation text={{ rows: 8 }} />
          </div>
          <div className='p-20px'>
            <Skeleton animation text={{ rows: 12 }} />
          </div>
        </div>
      ) : visibleAssets.length === 0 ? (
        <div className='flex min-h-420px items-center justify-center p-24px'>
          <Empty
            description={
              normalizedSearch ? t('settings.assetWorkbench.noSearchResults') : t('settings.assetWorkbench.localEmpty')
            }
          />
        </div>
      ) : (
        <div className='grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]'>
          <div
            className='max-h-260px overflow-y-auto border-b border-border-2 lg:max-h-none lg:border-b-0 lg:border-r'
            role='listbox'
            aria-label={t('settings.assetWorkbench.localAssetList')}
          >
            {visibleAssets.map((asset) => {
              const selected = asset.id === selectedAssetId;
              const syncStatus = getSyncStatePresentation(asset.syncState);
              const runtimeStatus = getRuntimeStatePresentation(asset.runtimeState);
              return (
                <Button
                  key={asset.id}
                  data-asset-id={asset.id}
                  type='text'
                  long
                  className={classNames(
                    '!h-auto !justify-start !rounded-none !border-b !border-border-1 !px-14px !py-12px !text-left last:!border-b-0',
                    selected ? '!bg-fill-2' : 'hover:!bg-fill-1'
                  )}
                  role='option'
                  aria-selected={selected}
                  onClick={() => setSelectedAssetId(asset.id)}
                >
                  <span className='flex min-w-0 flex-1 items-start gap-10px'>
                    <span className='mt-2px flex shrink-0 items-center gap-2px'>
                      <Tooltip content={t(syncStatus.labelKey)}>
                        <span
                          className={classNames(
                            'inline-flex size-18px items-center justify-center',
                            syncStatus.className
                          )}
                          aria-label={t(syncStatus.labelKey)}
                        >
                          {syncStatus.icon}
                        </span>
                      </Tooltip>
                      <Tooltip content={t(runtimeStatus.labelKey)}>
                        <span
                          className={classNames(
                            'inline-flex size-18px items-center justify-center',
                            runtimeStatus.className
                          )}
                          aria-label={t(runtimeStatus.labelKey)}
                        >
                          {runtimeStatus.icon}
                        </span>
                      </Tooltip>
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate text-13px font-600 text-t-primary'>{asset.displayName}</span>
                      <span className='mt-3px block truncate text-11px text-t-tertiary'>
                        {asset.description || asset.id}
                      </span>
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
          <AssetDetailPanel assetId={selectedAssetId} onAssetChanged={loadAssets} />
        </div>
      )}
    </section>
  );
};

export default LocalAssetWorkbench;
