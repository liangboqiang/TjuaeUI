import type {
  ConversationTraceDetailResponse,
  ConversationTraceRuntimeAssetSnapshot,
  ConversationTraceSummary,
} from '@/common/types/conversationTrace';
import { RuntimeAssetReceipt, mergeDetailWithLivePatch } from '@/renderer/pages/conversation/components/TraceDrawer';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const snapshot: ConversationTraceRuntimeAssetSnapshot = {
  runtimeSnapshotId: `sha256-${'a'.repeat(64)}`,
  assets: [
    {
      localAssetId: 'frontend-design',
      kind: 'skill',
      definitionDigest: `sha256-${'b'.repeat(64)}`,
      upstreamPackage: 'tjuae-official/assets',
      upstreamAssetId: 'frontend-design',
      upstreamVersion: '1.0.0',
      upstreamRevision: '1234567890abcdef',
    },
  ],
};

const trace = (updatedAt: number): ConversationTraceSummary => ({
  trace_id: 'turn-1',
  conversation_id: 'conversation-1',
  status: 'running',
  backend: 'tjuae-cli',
  model: null,
  mode: null,
  started_at: 1,
  first_event_at: null,
  first_output_at: null,
  ended_at: null,
  duration_ms: null,
  input_size: 0,
  output_size: 0,
  input_tokens: null,
  output_tokens: null,
  total_tokens: null,
  cost_usd: null,
  error_code: null,
  retryable: null,
  incomplete: false,
  truncated: false,
  span_count: 0,
  dropped_span_count: 0,
  runtime_snapshot_id: snapshot.runtimeSnapshotId,
  updated_at: updatedAt,
});

describe('Trace runtime asset receipt', () => {
  it('renders only stable asset identity and upstream provenance', () => {
    const { container } = render(
      <RuntimeAssetReceipt snapshot={snapshot} expectedSnapshotId={snapshot.runtimeSnapshotId} />
    );

    expect(screen.getByTestId('trace-runtime-assets')).toBeInTheDocument();
    expect(screen.getByText('frontend-design')).toBeInTheDocument();
    expect(container.textContent).toContain(`sha256-${'b'.repeat(64)}`);
    expect(container.textContent).toContain('tjuae-official/assets · frontend-design · v1.0.0');
    expect(container.textContent).not.toMatch(/absolute|workspace|secret|token|prompt/i);
  });

  it('preserves a verified receipt across later span-only live patches', () => {
    const detail: ConversationTraceDetailResponse = {
      trace: trace(1),
      spans: [],
      runtime_asset_snapshot: snapshot,
    };

    const merged = mergeDetailWithLivePatch(detail, {
      conversationId: 'conversation-1',
      traceId: 'turn-1',
      trace: trace(2),
      spans: [],
    });

    expect(merged.runtime_asset_snapshot).toEqual(snapshot);
    expect(merged.trace.updated_at).toBe(2);
  });
});
