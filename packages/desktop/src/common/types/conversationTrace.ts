export type ConversationTraceStatus = 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';

export type ConversationTraceSpanKind = 'thinking' | 'tool' | 'permission';

export type ConversationTraceUpdateKind =
  | 'trace_started'
  | 'trace_updated'
  | 'runtime_assets_loaded'
  | 'span_updated'
  | 'trace_completed';

export type ConversationTraceSummary = {
  trace_id: string;
  conversation_id: string;
  status: ConversationTraceStatus;
  backend: string | null;
  model: string | null;
  mode: string | null;
  started_at: number;
  first_event_at: number | null;
  first_output_at: number | null;
  ended_at: number | null;
  duration_ms: number | null;
  input_size: number;
  output_size: number;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  error_code: string | null;
  retryable: boolean | null;
  incomplete: boolean;
  truncated: boolean;
  span_count: number;
  dropped_span_count: number;
  runtime_snapshot_id: string | null;
  updated_at: number;
};

export type ConversationTraceRuntimeAssetRef = {
  localAssetId: string;
  kind: string;
  definitionDigest: string;
  upstreamPackage?: string;
  upstreamAssetId?: string;
  upstreamVersion?: string;
  upstreamRevision?: string;
};

export type ConversationTraceRuntimeAssetSnapshot = {
  runtimeSnapshotId: string;
  assets: ConversationTraceRuntimeAssetRef[];
};

export type ConversationTraceSpan = {
  span_id: string;
  trace_id: string;
  kind: ConversationTraceSpanKind;
  source_id: string | null;
  source_message_id: string | null;
  name: string;
  status: ConversationTraceStatus;
  started_at: number;
  ended_at: number | null;
  duration_ms: number | null;
  safe_attributes: Record<string, string | number | boolean | null>;
  updated_at: number;
};

export type ConversationTraceListResponse = {
  items: ConversationTraceSummary[];
};

export type ConversationTraceDetailResponse = {
  trace: ConversationTraceSummary;
  spans: ConversationTraceSpan[];
  runtime_asset_snapshot?: ConversationTraceRuntimeAssetSnapshot;
};

export type ConversationTraceUpdatedEvent = {
  conversation_id: string;
  trace_id: string;
  turn_id: string;
  update_kind: ConversationTraceUpdateKind;
  trace: ConversationTraceSummary;
  span: ConversationTraceSpan | null;
  runtime_asset_snapshot?: ConversationTraceRuntimeAssetSnapshot;
};
