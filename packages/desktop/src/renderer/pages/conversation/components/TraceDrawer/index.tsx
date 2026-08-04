import { ipcBridge } from '@/common';
import type {
  ConversationTraceDetailResponse,
  ConversationTraceRuntimeAssetRef,
  ConversationTraceRuntimeAssetSnapshot,
  ConversationTraceSpan,
  ConversationTraceSpanKind,
  ConversationTraceStatus,
  ConversationTraceSummary,
} from '@/common/types/conversationTrace';
import { dispatchChatMessageJump } from '@/renderer/utils/chat/chatMinimapEvents';
import { Button, Drawer, Empty, Select, Spin, Tag, Tooltip, Typography } from '@arco-design/web-react';
import { Analysis, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type TraceDrawerProps = {
  conversationId: string;
};

type ActiveTraceDetailRequest = {
  conversationId: string;
  traceId: string;
  generation: number;
};

type ActiveTraceListRequest = {
  conversationId: string;
  generation: number;
};

type PendingTraceLivePatch = {
  conversationId: string;
  traceId: string;
  trace: ConversationTraceSummary;
  spans: ConversationTraceSpan[];
  runtimeAssetSnapshot?: ConversationTraceRuntimeAssetSnapshot;
};

const statusColor: Record<ConversationTraceStatus, 'blue' | 'green' | 'red' | 'orange' | 'gray'> = {
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
  cancelled: 'orange',
  interrupted: 'gray',
};

const toMilliseconds = (timestamp: number) => (timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp);

const formatDuration = (durationMs: number | null) => {
  if (durationMs === null) return '—';
  if (durationMs < 1000) return `${durationMs} ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1000);
  return `${minutes} m ${seconds} s`;
};

const selectNewerTraceSummary = (current: ConversationTraceSummary, incoming: ConversationTraceSummary) =>
  incoming.updated_at > current.updated_at
    ? incoming
    : incoming.updated_at < current.updated_at || (current.status !== 'running' && incoming.status === 'running')
      ? current
      : incoming;

const upsertTrace = (items: ConversationTraceSummary[], trace: ConversationTraceSummary) => {
  const current = items.find((item) => item.trace_id === trace.trace_id);
  const nextTrace = current ? selectNewerTraceSummary(current, trace) : trace;
  return [nextTrace, ...items.filter((item) => item.trace_id !== trace.trace_id)]
    .toSorted((left, right) => right.started_at - left.started_at)
    .slice(0, 100);
};

const upsertSpan = (spans: ConversationTraceSpan[], span: ConversationTraceSpan) => {
  const current = spans.find((item) => item.span_id === span.span_id);
  const nextSpan =
    !current || span.updated_at > current.updated_at
      ? span
      : span.updated_at < current.updated_at || (current.status !== 'running' && span.status === 'running')
        ? current
        : span;
  return [...spans.filter((item) => item.span_id !== span.span_id), nextSpan].toSorted(
    (left, right) => left.started_at - right.started_at
  );
};

const mergeTraceSummary = (current: ConversationTraceSummary, incoming: ConversationTraceSummary) =>
  selectNewerTraceSummary(current, incoming);

export const mergeDetailWithLivePatch = (
  detail: ConversationTraceDetailResponse,
  patch: PendingTraceLivePatch | undefined
) => {
  if (!patch || patch.conversationId !== detail.trace.conversation_id || patch.traceId !== detail.trace.trace_id) {
    return detail;
  }
  return {
    trace: mergeTraceSummary(detail.trace, patch.trace),
    spans: patch.spans.reduce(upsertSpan, detail.spans),
    runtime_asset_snapshot: patch.runtimeAssetSnapshot ?? detail.runtime_asset_snapshot,
  };
};

const TraceDrawer: React.FC<TraceDrawerProps> = ({ conversationId }) => {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<ConversationTraceSummary[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string>();
  const [detail, setDetail] = useState<ConversationTraceDetailResponse>();
  const traceItemsRef = useRef<ConversationTraceSummary[]>([]);
  const selectedTraceIdRef = useRef<string | undefined>(undefined);
  const traceListRequestGenerationRef = useRef(0);
  const traceDetailRequestGenerationRef = useRef(0);
  const activeTraceListRequestRef = useRef<ActiveTraceListRequest | undefined>(undefined);
  const pendingTraceListPatchesRef = useRef<ConversationTraceSummary[]>([]);
  const activeTraceDetailRequestRef = useRef<ActiveTraceDetailRequest | undefined>(undefined);
  const pendingTraceLivePatchRef = useRef<PendingTraceLivePatch | undefined>(undefined);

  const statusLabel = useCallback(
    (status: ConversationTraceStatus) => {
      const keys: Record<ConversationTraceStatus, string> = {
        running: 'conversation.trace.status.running',
        succeeded: 'conversation.trace.status.succeeded',
        failed: 'conversation.trace.status.failed',
        cancelled: 'conversation.trace.status.cancelled',
        interrupted: 'conversation.trace.status.interrupted',
      };
      return t(keys[status]);
    },
    [t]
  );

  const spanKindLabel = useCallback(
    (kind: ConversationTraceSpanKind) => {
      const keys: Record<ConversationTraceSpanKind, string> = {
        thinking: 'conversation.trace.spanKind.thinking',
        tool: 'conversation.trace.spanKind.tool',
        permission: 'conversation.trace.spanKind.permission',
      };
      return t(keys[kind]);
    },
    [t]
  );

  const loadDetail = useCallback(
    async (traceId: string) => {
      const requestGeneration = ++traceDetailRequestGenerationRef.current;
      activeTraceDetailRequestRef.current = {
        conversationId,
        traceId,
        generation: requestGeneration,
      };
      pendingTraceLivePatchRef.current = undefined;
      try {
        const nextDetail = await ipcBridge.conversation.getTrace.invoke({
          conversation_id: conversationId,
          trace_id: traceId,
        });
        if (requestGeneration !== traceDetailRequestGenerationRef.current) return false;
        if (nextDetail.trace.conversation_id !== conversationId || nextDetail.trace.trace_id !== traceId) {
          throw new Error('Trace detail response does not match the active request');
        }
        setDetail(mergeDetailWithLivePatch(nextDetail, pendingTraceLivePatchRef.current));
        activeTraceDetailRequestRef.current = undefined;
        pendingTraceLivePatchRef.current = undefined;
        return true;
      } catch (loadError) {
        if (requestGeneration !== traceDetailRequestGenerationRef.current) return false;
        activeTraceDetailRequestRef.current = undefined;
        pendingTraceLivePatchRef.current = undefined;
        throw loadError;
      }
    },
    [conversationId]
  );

  const loadTraces = useCallback(async () => {
    const requestGeneration = ++traceListRequestGenerationRef.current;
    activeTraceListRequestRef.current = {
      conversationId,
      generation: requestGeneration,
    };
    pendingTraceListPatchesRef.current = [];
    traceDetailRequestGenerationRef.current += 1;
    activeTraceDetailRequestRef.current = undefined;
    pendingTraceLivePatchRef.current = undefined;
    setLoading(true);
    setError(false);
    try {
      const response = await ipcBridge.conversation.listTraces.invoke({
        conversation_id: conversationId,
        limit: 100,
      });
      if (requestGeneration !== traceListRequestGenerationRef.current) return;
      const activeRequest = activeTraceListRequestRef.current;
      const pendingPatches =
        activeRequest?.conversationId === conversationId && activeRequest.generation === requestGeneration
          ? pendingTraceListPatchesRef.current
          : [];
      const nextItems = pendingPatches.reduce(upsertTrace, response.items);
      activeTraceListRequestRef.current = undefined;
      pendingTraceListPatchesRef.current = [];
      traceItemsRef.current = nextItems;
      setItems(nextItems);
      const nextTraceId =
        nextItems.find((item) => item.trace_id === selectedTraceIdRef.current)?.trace_id ??
        response.items[0]?.trace_id ??
        nextItems[0]?.trace_id;
      selectedTraceIdRef.current = nextTraceId;
      setSelectedTraceId(nextTraceId);
      if (nextTraceId) {
        await loadDetail(nextTraceId);
      } else {
        traceDetailRequestGenerationRef.current += 1;
        setDetail(undefined);
      }
    } catch (loadError) {
      if (requestGeneration !== traceListRequestGenerationRef.current) return;
      activeTraceListRequestRef.current = undefined;
      pendingTraceListPatchesRef.current = [];
      console.error('Failed to load conversation traces:', loadError);
      setError(true);
    } finally {
      if (requestGeneration === traceListRequestGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [conversationId, loadDetail]);

  useEffect(() => {
    traceListRequestGenerationRef.current += 1;
    traceDetailRequestGenerationRef.current += 1;
    activeTraceListRequestRef.current = undefined;
    pendingTraceListPatchesRef.current = [];
    activeTraceDetailRequestRef.current = undefined;
    pendingTraceLivePatchRef.current = undefined;
    traceItemsRef.current = [];
    selectedTraceIdRef.current = undefined;
    setItems([]);
    setSelectedTraceId(undefined);
    setDetail(undefined);
    setError(false);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    if (!visible) return;
    void loadTraces();
  }, [loadTraces, visible]);

  useEffect(
    () =>
      ipcBridge.conversation.traceUpdated.on((event) => {
        if (event.conversation_id !== conversationId) return;
        const nextItems = upsertTrace(traceItemsRef.current, event.trace);
        traceItemsRef.current = nextItems;
        setItems(nextItems);
        const activeListRequest = activeTraceListRequestRef.current;
        if (
          activeListRequest?.conversationId === event.conversation_id &&
          activeListRequest.generation === traceListRequestGenerationRef.current
        ) {
          pendingTraceListPatchesRef.current = upsertTrace(pendingTraceListPatchesRef.current, event.trace);
        }
        const activeTraceId = selectedTraceIdRef.current;
        if (!activeTraceId) {
          selectedTraceIdRef.current = event.trace_id;
          setSelectedTraceId(event.trace_id);
        }
        if (activeTraceId === event.trace_id || (!activeTraceId && visible)) {
          const activeRequest = activeTraceDetailRequestRef.current;
          if (
            activeRequest?.generation === traceDetailRequestGenerationRef.current &&
            activeRequest.conversationId === event.conversation_id &&
            activeRequest.traceId === event.trace_id
          ) {
            const currentPatch = pendingTraceLivePatchRef.current;
            pendingTraceLivePatchRef.current = {
              conversationId: event.conversation_id,
              traceId: event.trace_id,
              trace: currentPatch ? mergeTraceSummary(currentPatch.trace, event.trace) : event.trace,
              spans: event.span ? upsertSpan(currentPatch?.spans ?? [], event.span) : (currentPatch?.spans ?? []),
              runtimeAssetSnapshot: event.runtime_asset_snapshot ?? currentPatch?.runtimeAssetSnapshot,
            };
            return;
          }
          setDetail((current) => {
            const currentMatchesEvent =
              current?.trace.conversation_id === event.conversation_id && current.trace.trace_id === event.trace_id;
            return {
              trace: currentMatchesEvent ? mergeTraceSummary(current.trace, event.trace) : event.trace,
              spans: event.span
                ? upsertSpan(currentMatchesEvent ? current.spans : [], event.span)
                : currentMatchesEvent
                  ? current.spans
                  : [],
              runtime_asset_snapshot:
                event.runtime_asset_snapshot ?? (currentMatchesEvent ? current.runtime_asset_snapshot : undefined),
            };
          });
        }
      }),
    [conversationId, visible]
  );

  const traceOptions = useMemo(
    () =>
      items.map((trace) => ({
        value: trace.trace_id,
        label: `${new Date(toMilliseconds(trace.started_at)).toLocaleString(i18n.language)} · ${statusLabel(trace.status)}`,
      })),
    [i18n.language, items, statusLabel]
  );

  const selectTrace = useCallback(
    (traceId: string) => {
      traceListRequestGenerationRef.current += 1;
      activeTraceListRequestRef.current = undefined;
      pendingTraceListPatchesRef.current = [];
      selectedTraceIdRef.current = traceId;
      setSelectedTraceId(traceId);
      setDetail(undefined);
      setLoading(true);
      setError(false);
      void loadDetail(traceId)
        .then((applied) => {
          if (applied) setLoading(false);
        })
        .catch((loadError) => {
          console.error('Failed to load trace detail:', loadError);
          setError(true);
          setLoading(false);
        });
    },
    [loadDetail]
  );

  const jumpToSpan = useCallback(
    (span: ConversationTraceSpan) => {
      if (!span.source_message_id) return;
      dispatchChatMessageJump({
        conversation_id: conversationId,
        messageId: span.source_message_id,
        align: 'center',
        behavior: 'smooth',
      });
      setVisible(false);
    },
    [conversationId]
  );

  const visibleDetail =
    detail?.trace.conversation_id === conversationId && detail.trace.trace_id === selectedTraceId ? detail : undefined;
  const trace = visibleDetail?.trace;
  const spans = visibleDetail?.spans ?? [];
  const runtimeAssetSnapshot = visibleDetail?.runtime_asset_snapshot;
  const firstOutputDuration =
    trace?.first_output_at === null || trace?.first_output_at === undefined
      ? null
      : Math.max(0, trace.first_output_at - trace.started_at);

  return (
    <>
      <Tooltip content={t('conversation.trace.title')}>
        <Button
          data-testid='conversation-trace-button'
          size='mini'
          type='secondary'
          icon={<Analysis size='14' />}
          onClick={() => setVisible(true)}
        >
          {t('conversation.trace.title')}
        </Button>
      </Tooltip>

      <Drawer
        data-testid='conversation-trace-drawer'
        title={t('conversation.trace.title')}
        visible={visible}
        width={480}
        footer={null}
        unmountOnExit={false}
        onCancel={() => setVisible(false)}
      >
        <div className='flex h-full min-h-0 flex-col gap-14px'>
          <div className='flex items-center gap-8px'>
            <Select
              className='min-w-0 flex-1'
              aria-label={t('conversation.trace.selectRun')}
              placeholder={t('conversation.trace.selectRun')}
              options={traceOptions}
              value={selectedTraceId}
              onChange={selectTrace}
            />
            <Button
              data-testid='conversation-trace-refresh'
              aria-label={t('common.refresh')}
              icon={<Refresh size='16' />}
              loading={loading}
              onClick={() => void loadTraces()}
            />
          </div>

          {loading && !detail ? (
            <div className='flex flex-1 items-center justify-center'>
              <Spin />
            </div>
          ) : error ? (
            <div className='flex flex-1 flex-col items-center justify-center gap-12px'>
              <Typography.Text data-testid='trace-load-error' type='secondary'>
                {t('conversation.trace.loadError')}
              </Typography.Text>
              <Button onClick={() => void loadTraces()}>{t('common.retry')}</Button>
            </div>
          ) : !trace ? (
            <div className='flex flex-1 items-center justify-center'>
              <Empty description={t('conversation.trace.empty')} />
            </div>
          ) : (
            <div className='min-h-0 flex-1 overflow-auto'>
              <div className='mb-16px rounded-12px border border-border-2 bg-2 p-14px'>
                <div className='mb-12px flex items-center justify-between gap-8px'>
                  <Typography.Text className='font-600 text-t-primary'>
                    {new Date(toMilliseconds(trace.started_at)).toLocaleString(i18n.language)}
                  </Typography.Text>
                  <Tag color={statusColor[trace.status]}>{statusLabel(trace.status)}</Tag>
                </div>
                <div className='grid grid-cols-2 gap-x-16px gap-y-10px text-12px'>
                  <TraceMetric label={t('conversation.trace.backend')} value={trace.backend ?? '—'} />
                  <TraceMetric label={t('common.model')} value={trace.model ?? '—'} />
                  <TraceMetric label={t('conversation.trace.duration')} value={formatDuration(trace.duration_ms)} />
                  <TraceMetric
                    label={t('conversation.trace.firstOutput')}
                    value={formatDuration(firstOutputDuration)}
                  />
                  <TraceMetric
                    label={t('conversation.trace.tokens')}
                    value={trace.total_tokens === null ? '—' : String(trace.total_tokens)}
                  />
                  <TraceMetric label={t('conversation.trace.spans')} value={String(trace.span_count)} />
                </div>
                {(trace.incomplete || trace.truncated || trace.dropped_span_count > 0) && (
                  <div className='mt-12px flex flex-wrap gap-6px'>
                    {trace.incomplete && <Tag color='orange'>{t('conversation.trace.incomplete')}</Tag>}
                    {trace.truncated && <Tag color='orange'>{t('conversation.trace.truncated')}</Tag>}
                    {trace.dropped_span_count > 0 && (
                      <Tag color='orange'>
                        {t('conversation.trace.droppedSpans', { count: trace.dropped_span_count })}
                      </Tag>
                    )}
                  </div>
                )}
              </div>

              <RuntimeAssetReceipt snapshot={runtimeAssetSnapshot} expectedSnapshotId={trace.runtime_snapshot_id} />

              <div className='flex flex-col gap-8px'>
                {spans.length === 0 ? (
                  <Empty description={t('conversation.trace.noDetails')} />
                ) : (
                  spans.map((span) => (
                    <div
                      key={span.span_id}
                      data-testid={`trace-span-${span.kind}`}
                      className='flex items-center gap-10px rounded-10px border border-border-2 bg-1 px-12px py-10px'
                    >
                      <div className='min-w-0 flex-1'>
                        <div className='flex min-w-0 items-center gap-8px'>
                          <Tag size='small'>{spanKindLabel(span.kind)}</Tag>
                          <Typography.Text ellipsis className='min-w-0 flex-1 font-500 text-t-primary'>
                            {span.name}
                          </Typography.Text>
                        </div>
                        <div className='mt-5px flex items-center gap-8px text-11px text-t-secondary'>
                          <span>{statusLabel(span.status)}</span>
                          <span>·</span>
                          <span>{formatDuration(span.duration_ms)}</span>
                        </div>
                      </div>
                      {span.source_message_id && (
                        <Button
                          data-testid={`trace-jump-${span.span_id}`}
                          size='mini'
                          type='text'
                          onClick={() => jumpToSpan(span)}
                        >
                          {t('conversation.trace.jumpToMessage')}
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
};

export const RuntimeAssetReceipt: React.FC<{
  snapshot?: ConversationTraceRuntimeAssetSnapshot;
  expectedSnapshotId: string | null;
}> = ({ snapshot, expectedSnapshotId }) => {
  const { t } = useTranslation();
  if (!snapshot && !expectedSnapshotId) return null;

  return (
    <section
      data-testid='trace-runtime-assets'
      className='mb-16px rounded-12px border border-border-2 bg-1 p-14px'
      aria-label={t('conversation.trace.runtimeAssets')}
    >
      <div className='mb-10px flex min-w-0 items-center justify-between gap-10px'>
        <Typography.Text className='font-600 text-t-primary'>{t('conversation.trace.runtimeAssets')}</Typography.Text>
        <Tooltip content={snapshot?.runtimeSnapshotId ?? expectedSnapshotId ?? ''}>
          <span className='max-w-180px truncate text-10px text-t-tertiary'>
            {t('conversation.trace.runtimeReceipt')}
          </span>
        </Tooltip>
      </div>
      {!snapshot ? (
        <Empty description={t('conversation.trace.runtimeAssetsUnavailable')} />
      ) : snapshot.assets.length === 0 ? (
        <Empty description={t('conversation.trace.runtimeAssetsEmpty')} />
      ) : (
        <div className='flex flex-col gap-8px'>
          {snapshot.assets.map((asset) => (
            <RuntimeAssetReceiptRow
              key={`${asset.kind}:${asset.localAssetId}:${asset.definitionDigest}`}
              asset={asset}
            />
          ))}
        </div>
      )}
    </section>
  );
};

const RuntimeAssetReceiptRow: React.FC<{ asset: ConversationTraceRuntimeAssetRef }> = ({ asset }) => {
  const { t } = useTranslation();
  const kindKey = `conversation.trace.assetKind.${asset.kind}`;
  const upstream = asset.upstreamPackage
    ? [asset.upstreamPackage, asset.upstreamAssetId, asset.upstreamVersion ? `v${asset.upstreamVersion}` : undefined]
        .filter(Boolean)
        .join(' · ')
    : t('conversation.trace.localOnlyAsset');

  return (
    <div
      data-testid={`trace-runtime-asset-${asset.localAssetId}`}
      className='rounded-10px border border-border-2 bg-2 px-12px py-10px'
    >
      <div className='flex min-w-0 items-center gap-8px'>
        <Tag size='small'>{t(kindKey, { defaultValue: asset.kind })}</Tag>
        <Typography.Text ellipsis className='min-w-0 flex-1 font-500 text-t-primary'>
          {asset.localAssetId}
        </Typography.Text>
      </div>
      <div className='mt-6px grid grid-cols-1 gap-4px text-11px text-t-secondary'>
        <Tooltip content={asset.definitionDigest}>
          <span className='truncate'>
            {t('conversation.trace.definitionDigest')}: {asset.definitionDigest}
          </span>
        </Tooltip>
        <Tooltip content={asset.upstreamRevision ?? upstream}>
          <span className='truncate'>
            {t('conversation.trace.upstreamSource')}: {upstream}
          </span>
        </Tooltip>
      </div>
    </div>
  );
};

const TraceMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className='min-w-0'>
    <div className='text-t-tertiary'>{label}</div>
    <div className='mt-2px truncate font-500 text-t-primary'>{value}</div>
  </div>
);

export default TraceDrawer;
