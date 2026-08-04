import type { AssetDetail, AssetDiff, AssetFileEntry, AssetResolveStrategy } from '@/common/types/agent/assets';
import { Alert, Button, Empty, Message, Modal, Skeleton, Tag, Tooltip, Tree } from '@arco-design/web-react';
import type { TreeDataType } from '@arco-design/web-react/es/Tree/interface';
import { FileText, Refresh } from '@icon-park/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AssetFileViewer, { type AssetFileView } from '../components/AssetFileViewer';
import AssetSemanticDetail from '../components/AssetSemanticDetail';
import { localizeAssetError } from '../components/assetError';
import AssetConflictDialog from './AssetConflictDialog';
import AssetRuntimeDialog from './AssetRuntimeDialog';
import { assetApi } from './assetApi';
import {
  formatAssetFileSize,
  getRuntimeStatePresentation,
  getSyncStatePresentation,
  resolveDefaultAssetFile,
} from '../components/assetUi';

type AssetDetailPanelProps = {
  assetId?: string;
  onAssetChanged: () => Promise<void>;
};

type MutableTreeNode = TreeDataType & {
  children?: MutableTreeNode[];
};

type RecoveryState = {
  operationId: string;
  expectedLocalDigest: string;
};

type ConfirmAction = 'detach' | 'uninstall';
type RuntimeAction = 'validate' | 'tryRun' | 'activate' | 'deactivate';

const buildFileTree = (files: AssetFileEntry[]): TreeDataType[] => {
  const roots: MutableTreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let level = roots;
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const key = isFile ? `file:${file.path}` : `dir:${parts.slice(0, index + 1).join('/')}`;
      let node = level.find((entry) => entry.key === key);
      if (!node) {
        node = {
          key,
          title: isFile ? (
            <span className='flex min-w-0 items-center gap-7px'>
              <FileText aria-hidden='true' size='14' className='shrink-0 text-t-tertiary' />
              <span className='min-w-0 flex-1 truncate'>{part}</span>
              <span className='shrink-0 text-10px text-t-tertiary'>{formatAssetFileSize(file.size)}</span>
            </span>
          ) : (
            part
          ),
          isLeaf: isFile,
          children: isFile ? undefined : [],
        };
        level.push(node);
      }
      if (!isFile) {
        level = node.children ?? [];
      }
    });
  }

  return roots;
};

const AssetDetailPanel: React.FC<AssetDetailPanelProps> = ({ assetId, onAssetChanged }) => {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<AssetDetail>();
  const [selectedPath, setSelectedPath] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [comparisonDiff, setComparisonDiff] = useState<AssetDiff>();
  const [resolveDiff, setResolveDiff] = useState<AssetDiff>();
  const [resolveVisible, setResolveVisible] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [viewerRequest, setViewerRequest] = useState<{ view: AssetFileView; id: number }>();
  const [recovery, setRecovery] = useState<RecoveryState>();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>();
  const [pendingAction, setPendingAction] = useState<ConfirmAction | 'restore'>();
  const [runtimeDialogVisible, setRuntimeDialogVisible] = useState(false);
  const [pendingRuntimeAction, setPendingRuntimeAction] = useState<RuntimeAction>();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const requestIdRef = useRef(0);

  const loadDetail = useCallback(async () => {
    if (!assetId) {
      setDetail(undefined);
      setSelectedPath(undefined);
      setViewerRequest(undefined);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(undefined);
    try {
      const nextDetail = await assetApi.detail.invoke({ assetId, source: 'local' });
      if (requestId !== requestIdRef.current) return;
      setDetail(nextDetail);
      let nextDiff: AssetDiff | undefined;
      if (nextDetail.upstream?.trackingMode === 'tracked') {
        try {
          nextDiff = await assetApi.diff.invoke({ assetId });
        } catch {
          // The local Definition remains usable when Hub is temporarily
          // unavailable. The comparison is retried on refresh.
        }
      }
      if (requestId !== requestIdRef.current) return;
      setComparisonDiff(nextDiff);
      const allFiles = new Map(nextDetail.files.map((file) => [file.path, file]));
      nextDiff?.files.forEach((file) => {
        const descriptor = file.local ?? file.remote ?? file.base;
        if (descriptor && !allFiles.has(file.path)) allFiles.set(file.path, descriptor);
      });
      setSelectedPath((current) => {
        if (current && allFiles.has(current)) return current;
        return resolveDefaultAssetFile(nextDetail)?.path;
      });
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setDetail(undefined);
      setComparisonDiff(undefined);
      setSelectedPath(undefined);
      setError(loadError);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    setRecovery(undefined);
    setConfirmAction(undefined);
    setAdvancedOpen(false);
    void loadDetail();
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadDetail]);

  const loadSemanticFile = useCallback(
    async (path: string) => {
      if (!assetId) throw new Error('asset id is required');
      return assetApi.readFile.invoke({ assetId, path, source: 'local' });
    },
    [assetId]
  );

  const visibleFiles = useMemo(() => {
    const files = new Map((detail?.files ?? []).map((file) => [file.path, file]));
    comparisonDiff?.files.forEach((file) => {
      const descriptor = file.local ?? file.remote ?? file.base;
      if (descriptor && !files.has(file.path)) files.set(file.path, descriptor);
    });
    return [...files.values()].toSorted((left, right) => left.path.localeCompare(right.path));
  }, [comparisonDiff, detail?.files]);
  const selectedFile = visibleFiles.find((file) => file.path === selectedPath);
  const treeData = useMemo(() => buildFileTree(visibleFiles), [visibleFiles]);

  const openResolve = useCallback(async () => {
    if (!assetId) return;
    setIsResolving(true);
    try {
      const nextDiff = await assetApi.diff.invoke({ assetId });
      setResolveDiff(nextDiff);
      setResolveVisible(true);
    } catch {
      Message.error(t('settings.assetWorkbench.remoteLoadError'));
    } finally {
      setIsResolving(false);
    }
  }, [assetId, t]);

  const openDiff = useCallback(async () => {
    if (!assetId) return;
    setIsLoadingDiff(true);
    try {
      const nextDiff = comparisonDiff ?? (await assetApi.diff.invoke({ assetId }));
      setComparisonDiff(nextDiff);
      const changed = nextDiff.files.find((file) => file.status !== 'unchanged');
      if (changed) setSelectedPath(changed.path);
      setViewerRequest((current) => ({ view: 'diff', id: (current?.id ?? 0) + 1 }));
      setAdvancedOpen(true);
    } catch {
      Message.error(t('settings.assetWorkbench.remoteLoadError'));
    } finally {
      setIsLoadingDiff(false);
    }
  }, [assetId, comparisonDiff, t]);

  const resolve = useCallback(
    async (strategy: AssetResolveStrategy, confirmDestructive: boolean) => {
      if (!assetId || !resolveDiff) return;
      setIsResolving(true);
      try {
        const result = await assetApi.resolve.invoke({
          assetId,
          strategy,
          expectedLocalDigest: resolveDiff.localDigest,
          expectedBaseDigest: resolveDiff.baseDigest,
          expectedRemoteDigest: resolveDiff.remoteDigest,
          idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
          confirmDestructive,
        });
        setRecovery(
          result.recoveryOperationId
            ? {
                operationId: result.recoveryOperationId,
                expectedLocalDigest: result.asset.definitionDigest,
              }
            : undefined
        );
        setResolveVisible(false);
        setResolveDiff(undefined);
        await loadDetail();
        await onAssetChanged();
        Message.success(t('settings.assetWorkbench.resolve.success'));
      } catch (resolveError) {
        Message.error(localizeAssetError(t, resolveError, 'settings.assetWorkbench.resolve.failed'));
      } finally {
        setIsResolving(false);
      }
    },
    [assetId, loadDetail, onAssetChanged, resolveDiff, t]
  );

  const runConfirmedAction = useCallback(async () => {
    if (!assetId || !confirmAction) return;
    const action = confirmAction;
    setPendingAction(action);
    try {
      if (action === 'uninstall') {
        await assetApi.uninstall.invoke({
          assetId,
          idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        });
      } else {
        await assetApi.detach.invoke({ assetId });
      }
      setConfirmAction(undefined);
      setRecovery(undefined);
      await onAssetChanged();
      if (action === 'detach') await loadDetail();
      Message.success(t('common.success'));
    } catch (actionError) {
      Message.error(localizeAssetError(t, actionError, 'settings.assetWorkbench.operationFailed'));
    } finally {
      setPendingAction(undefined);
    }
  }, [assetId, confirmAction, loadDetail, onAssetChanged, t]);

  const restoreRemoteReplacement = useCallback(async () => {
    if (!assetId || !recovery) return;
    setPendingAction('restore');
    try {
      await assetApi.restore.invoke({
        assetId,
        recoveryOperationId: recovery.operationId,
        expectedLocalDigest: recovery.expectedLocalDigest,
        idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      });
      setRecovery(undefined);
      await loadDetail();
      await onAssetChanged();
      Message.success(t('settings.assetWorkbench.resolve.restoreSuccess'));
    } catch (restoreError) {
      Message.error(localizeAssetError(t, restoreError, 'settings.assetWorkbench.resolve.restoreFailed'));
    } finally {
      setPendingAction(undefined);
    }
  }, [assetId, loadDetail, onAssetChanged, recovery, t]);

  const runRuntimeAction = useCallback(
    async (action: RuntimeAction) => {
      if (!detail) return;
      setPendingRuntimeAction(action);
      const request = {
        assetId: detail.id,
        idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        expectedDefinitionDigest: detail.definitionDigest,
        expectedOverlayVersion: detail.runtimeBinding?.overlayVersion,
      };
      try {
        switch (action) {
          case 'validate':
            await assetApi.validate.invoke(request);
            break;
          case 'tryRun':
            await assetApi.tryRun.invoke(request);
            break;
          case 'activate':
            await assetApi.activate.invoke(request);
            break;
          case 'deactivate':
            await assetApi.deactivate.invoke(request);
            break;
        }
        await loadDetail();
        await onAssetChanged();
        Message.success(t('settings.assetRuntime.lifecycleSuccess'));
      } catch (actionError) {
        Message.error(localizeAssetError(t, actionError, 'settings.assetWorkbench.operationFailed'));
      } finally {
        setPendingRuntimeAction(undefined);
      }
    },
    [detail, loadDetail, onAssetChanged, t]
  );

  if (!assetId) {
    return (
      <div className='flex min-h-420px items-center justify-center p-24px'>
        <Empty description={t('settings.assetWorkbench.selectAsset')} />
      </div>
    );
  }

  if (isLoading && !detail) {
    return (
      <div className='p-20px'>
        <Skeleton animation text={{ rows: 12 }} />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className='p-20px'>
        <Alert
          type='error'
          showIcon
          title={t('settings.assetWorkbench.detailLoadError')}
          content={
            <div className='flex flex-col items-start gap-10px'>
              {error ? <span>{t('settings.assetWorkbench.detailLoadError')}</span> : null}
              <Button size='small' type='outline' onClick={() => void loadDetail()}>
                {t('common.retry')}
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const syncStatus = getSyncStatePresentation(detail.syncState);
  const runtimeStatus = getRuntimeStatePresentation(detail.runtimeState);

  return (
    <div className='flex min-h-0 flex-col'>
      <div className='border-b border-border-2 px-16px py-14px'>
        <div className='flex items-start justify-between gap-12px'>
          <div className='min-w-0'>
            <div className='flex min-w-0 items-center gap-8px'>
              <h2 className='m-0 truncate text-17px font-700 text-t-primary'>{detail.displayName}</h2>
              <Tooltip content={t(syncStatus.labelKey)}>
                <span className={classNames('inline-flex shrink-0 items-center', syncStatus.className)}>
                  <span aria-hidden='true'>{syncStatus.icon}</span>
                </span>
              </Tooltip>
              <Tooltip content={t(runtimeStatus.labelKey)}>
                <span className={classNames('inline-flex shrink-0 items-center', runtimeStatus.className)}>
                  <span aria-hidden='true'>{runtimeStatus.icon}</span>
                </span>
              </Tooltip>
            </div>
            <p className='m-0 mt-5px text-12px leading-20px text-t-secondary'>{detail.description || detail.id}</p>
          </div>
          <Tooltip content={t('common.refresh')}>
            <Button
              type='text'
              size='small'
              icon={<Refresh aria-hidden='true' />}
              loading={isLoading}
              aria-label={t('common.refresh')}
              onClick={() => void loadDetail()}
            />
          </Tooltip>
        </div>
        <div className='mt-10px flex flex-wrap gap-6px' aria-label={t('settings.assetWorkbench.assetMetadata')}>
          <Tag bordered>{t(`settings.assetWorkbench.origins.${detail.origin}`)}</Tag>
          <Tag bordered>{t(`settings.assetWorkbench.trust.${detail.trust}`)}</Tag>
          <Tag bordered>{t(`settings.assetWorkbench.scopes.${detail.scope}`)}</Tag>
          <Tag bordered>{t(`settings.assetWorkbench.editability.${detail.editability}`)}</Tag>
          <Tag bordered>{t(runtimeStatus.labelKey)}</Tag>
          {detail.upstream ? <Tag bordered>v{detail.upstream.version}</Tag> : null}
          {detail.runtimeBinding ? (
            <Tag bordered>
              {t(`settings.assetRuntime.health.${detail.runtimeBinding.healthStatus}`)} ·{' '}
              {detail.runtimeBinding.portableRuntimeId}
            </Tag>
          ) : null}
        </div>
        {recovery ? (
          <Alert
            className='mt-10px'
            type='info'
            showIcon
            content={t('settings.assetWorkbench.resolve.recoveryAvailable')}
            action={
              <Button
                type='text'
                size='small'
                loading={pendingAction === 'restore'}
                onClick={() => void restoreRemoteReplacement()}
              >
                {t('settings.assetWorkbench.resolve.restoreAction')}
              </Button>
            }
          />
        ) : null}
        {detail.allowedActions.includes('configure') ||
        detail.allowedActions.includes('validate') ||
        detail.allowedActions.includes('tryRun') ||
        detail.allowedActions.includes('activate') ||
        detail.allowedActions.includes('deactivate') ||
        detail.allowedActions.includes('viewDiff') ||
        detail.allowedActions.includes('resolveConflict') ||
        detail.allowedActions.includes('detach') ||
        detail.allowedActions.includes('uninstall') ? (
          <div className='mt-10px flex flex-wrap gap-8px'>
            {detail.allowedActions.includes('configure') ? (
              <Button size='small' onClick={() => setRuntimeDialogVisible(true)}>
                {t('settings.assetRuntime.configureAction')}
              </Button>
            ) : null}
            {detail.allowedActions.includes('validate') ? (
              <Button
                size='small'
                loading={pendingRuntimeAction === 'validate'}
                onClick={() => void runRuntimeAction('validate')}
              >
                {t('settings.assetWorkbench.validateAction')}
              </Button>
            ) : null}
            {detail.allowedActions.includes('tryRun') ? (
              <Button
                size='small'
                loading={pendingRuntimeAction === 'tryRun'}
                onClick={() => void runRuntimeAction('tryRun')}
              >
                {t('settings.assetWorkbench.tryRunAction')}
              </Button>
            ) : null}
            {detail.allowedActions.includes('activate') ? (
              <Button
                type='primary'
                size='small'
                loading={pendingRuntimeAction === 'activate'}
                onClick={() => void runRuntimeAction('activate')}
              >
                {t('settings.assetRuntime.activateAction')}
              </Button>
            ) : null}
            {detail.allowedActions.includes('deactivate') ? (
              <Button
                size='small'
                loading={pendingRuntimeAction === 'deactivate'}
                onClick={() => void runRuntimeAction('deactivate')}
              >
                {t('settings.assetRuntime.deactivateAction')}
              </Button>
            ) : null}
            {detail.allowedActions.includes('viewDiff') ? (
              <Button size='small' loading={isLoadingDiff} onClick={() => void openDiff()}>
                {t('settings.assetWorkbench.viewDiffAction')}
              </Button>
            ) : null}
            {detail.allowedActions.includes('resolveConflict') ? (
              <Button type='primary' size='small' loading={isResolving} onClick={() => void openResolve()}>
                {t('settings.assetWorkbench.resolve.action')}
              </Button>
            ) : null}
            {detail.allowedActions.includes('detach') ? (
              <Button size='small' onClick={() => setConfirmAction('detach')}>
                {t('settings.assetWorkbench.resolve.strategies.detach.label')}
              </Button>
            ) : null}
            {detail.allowedActions.includes('uninstall') ? (
              <Button status='danger' size='small' onClick={() => setConfirmAction('uninstall')}>
                {t('settings.assetWorkbench.uninstallAction')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <AssetSemanticDetail
        assetKey={`${detail.id}:${detail.definitionDigest}`}
        kind={detail.kind}
        description={detail.description}
        runtimeId={detail.runtimeId ?? detail.runtimeBinding?.portableRuntimeId}
        entryFile={detail.entryFile}
        files={detail.files}
        version={detail.upstream?.version}
        runtimeState={t(runtimeStatus.labelKey)}
        healthState={
          detail.runtimeBinding ? t(`settings.assetRuntime.health.${detail.runtimeBinding.healthStatus}`) : undefined
        }
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
        data-testid='asset-advanced-source'
      >
        <summary className='cursor-pointer select-none px-18px py-12px text-12px font-600 text-t-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-6'>
          {t('settings.assetWorkbench.semantic.advancedSource')}
        </summary>
        {advancedOpen ? (
          <div className='grid min-h-420px grid-cols-1 border-t border-border-2 xl:grid-cols-[230px_minmax(0,1fr)]'>
            <aside className='max-h-220px overflow-y-auto border-b border-border-2 p-10px xl:max-h-none xl:border-b-0 xl:border-r'>
              <div className='px-6px pb-8px text-11px font-600 uppercase tracking-wide text-t-tertiary'>
                {t('settings.assetWorkbench.fileTree')}
              </div>
              {treeData.length > 0 ? (
                <Tree
                  blockNode
                  showLine
                  defaultExpandedKeys={treeData
                    .flatMap((node) => [node.key, ...(node.children?.map((child) => child.key) ?? [])])
                    .filter((key): key is string => typeof key === 'string' && key.startsWith('dir:'))}
                  treeData={treeData}
                  selectedKeys={selectedPath ? [`file:${selectedPath}`] : []}
                  aria-label={t('settings.assetWorkbench.fileTree')}
                  onSelect={(keys) => {
                    const key = String(keys[0] ?? '');
                    if (key.startsWith('file:')) setSelectedPath(key.slice(5));
                  }}
                />
              ) : (
                <Empty description={t('settings.assetWorkbench.noFiles')} />
              )}
            </aside>
            <AssetFileViewer
              key={`${detail.id}:${selectedFile?.path ?? ''}`}
              detail={detail}
              file={selectedFile}
              initialDiff={comparisonDiff}
              requestedView={viewerRequest?.view}
              viewRequestId={viewerRequest?.id}
              onSaved={async (nextDetail) => {
                setDetail(nextDetail);
                await onAssetChanged();
              }}
            />
          </div>
        ) : null}
      </details>
      <AssetConflictDialog
        visible={resolveVisible}
        diff={resolveDiff}
        loading={isResolving}
        onCancel={() => setResolveVisible(false)}
        onResolve={resolve}
      />
      <AssetRuntimeDialog
        visible={runtimeDialogVisible}
        asset={detail}
        onClose={() => setRuntimeDialogVisible(false)}
        onSaved={async () => {
          await loadDetail();
          await onAssetChanged();
        }}
      />
      <Modal
        visible={Boolean(confirmAction)}
        alignCenter
        focusLock
        maskClosable={!pendingAction}
        escToExit={!pendingAction}
        title={
          confirmAction === 'uninstall'
            ? t('settings.assetWorkbench.uninstallConfirmTitle')
            : t('settings.assetWorkbench.resolve.strategies.detach.label')
        }
        okText={
          confirmAction === 'uninstall'
            ? t('settings.assetWorkbench.uninstallAction')
            : t('settings.assetWorkbench.resolve.strategies.detach.label')
        }
        cancelText={t('common.cancel')}
        okButtonProps={{
          status: confirmAction === 'uninstall' ? 'danger' : undefined,
          loading: Boolean(pendingAction),
        }}
        onCancel={() => setConfirmAction(undefined)}
        onOk={() => void runConfirmedAction()}
      >
        <Alert
          type={confirmAction === 'uninstall' ? 'warning' : 'info'}
          showIcon
          content={
            confirmAction === 'uninstall'
              ? t('settings.assetWorkbench.uninstallConfirmDescription', {
                  name: detail.displayName,
                })
              : t('settings.assetWorkbench.resolve.strategies.detach.description')
          }
        />
      </Modal>
    </div>
  );
};

export default AssetDetailPanel;
