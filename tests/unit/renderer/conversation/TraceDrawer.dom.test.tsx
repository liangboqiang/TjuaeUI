import React from 'react';
import type { ConversationTraceUpdatedEvent } from '@/common/types/conversationTrace';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listTraces: vi.fn(),
  getTrace: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
  jump: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      listTraces: { invoke: mocks.listTraces },
      getTrace: { invoke: mocks.getTrace },
      traceUpdated: { on: mocks.subscribe },
    },
  },
}));

vi.mock('@/renderer/utils/chat/chatMinimapEvents', () => ({
  dispatchChatMessageJump: mocks.jump,
}));

import TraceDrawer from '@/renderer/pages/conversation/components/TraceDrawer';

const trace = {
  trace_id: 'turn-1',
  conversation_id: 'conversation-1',
  status: 'succeeded' as const,
  backend: 'tjuaecli',
  model: 'gpt-test',
  mode: 'default',
  started_at: 1_785_484_800_000,
  first_event_at: 1_785_484_800_010,
  first_output_at: 1_785_484_800_120,
  ended_at: 1_785_484_801_000,
  duration_ms: 1000,
  input_size: 24,
  output_size: 48,
  input_tokens: 8,
  output_tokens: 12,
  total_tokens: 20,
  cost_usd: null,
  error_code: null,
  retryable: null,
  incomplete: false,
  truncated: false,
  span_count: 1,
  dropped_span_count: 0,
  updated_at: 1_785_484_801_000,
};

const toolSpan = {
  span_id: 'span-1',
  trace_id: trace.trace_id,
  kind: 'tool' as const,
  source_id: 'call-1',
  source_message_id: 'message-1',
  name: 'read_file',
  status: 'succeeded' as const,
  started_at: trace.started_at + 200,
  ended_at: trace.started_at + 600,
  duration_ms: 400,
  safe_attributes: { secret: 'must-not-render' },
  updated_at: trace.updated_at,
};

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

describe('TraceDrawer', () => {
  beforeEach(() => {
    mocks.listTraces.mockReset();
    mocks.getTrace.mockReset();
    mocks.subscribe.mockClear();
    mocks.jump.mockReset();
    mocks.listTraces.mockResolvedValue({ items: [trace] });
    mocks.getTrace.mockResolvedValue({ trace, spans: [toolSpan] });
  });

  it('在现有会话中加载摘要与步骤，但不展示安全属性原文', async () => {
    render(<TraceDrawer conversationId='conversation-1' />);

    fireEvent.click(screen.getByTestId('conversation-trace-button'));

    expect(await screen.findByTestId('trace-span-tool')).toHaveTextContent('read_file');
    expect(screen.getByText('gpt-test')).toBeInTheDocument();
    expect(screen.queryByText('must-not-render')).not.toBeInTheDocument();
  });

  it('点击工具步骤时复用既有消息定位能力', async () => {
    render(<TraceDrawer conversationId='conversation-1' />);
    fireEvent.click(screen.getByTestId('conversation-trace-button'));
    await screen.findByTestId('trace-span-tool');

    fireEvent.click(screen.getByTestId('trace-jump-span-1'));

    expect(mocks.jump).toHaveBeenCalledWith({
      conversation_id: 'conversation-1',
      messageId: 'message-1',
      align: 'center',
      behavior: 'smooth',
    });
  });

  it('加载失败时提供可重试状态', async () => {
    mocks.listTraces.mockRejectedValueOnce(new Error('offline'));
    render(<TraceDrawer conversationId='conversation-1' />);
    fireEvent.click(screen.getByTestId('conversation-trace-button'));

    await waitFor(() => expect(screen.getByTestId('trace-load-error')).toBeInTheDocument());
  });

  it('快速从 A 切换到 B 时不会让较慢的 A 详情覆盖 B', async () => {
    const slowTraceA = createDeferred<{ trace: typeof trace; spans: Array<typeof toolSpan> }>();
    const traceB = {
      ...trace,
      trace_id: 'turn-2',
      status: 'failed' as const,
      model: 'model-b',
      started_at: trace.started_at + 60_000,
    };
    const spanB = {
      ...toolSpan,
      span_id: 'span-2',
      trace_id: traceB.trace_id,
      name: 'search_files',
    };
    mocks.listTraces.mockResolvedValue({ items: [trace, traceB] });
    mocks.getTrace.mockImplementation((request: { trace_id: string }) =>
      request.trace_id === trace.trace_id
        ? slowTraceA.promise
        : Promise.resolve({
            trace: traceB,
            spans: [spanB],
          })
    );

    render(<TraceDrawer conversationId='conversation-1' />);
    fireEvent.click(screen.getByTestId('conversation-trace-button'));
    await waitFor(() =>
      expect(mocks.getTrace).toHaveBeenCalledWith({
        conversation_id: 'conversation-1',
        trace_id: trace.trace_id,
      })
    );

    const select = document.querySelector('.arco-select');
    expect(select).not.toBeNull();
    fireEvent.click(select as Element);
    const options = await waitFor(() => {
      const nextOptions = document.querySelectorAll('.arco-select-option');
      if (nextOptions.length < 2) throw new Error('trace options not found');
      return nextOptions;
    });
    const traceBOption = Array.from(options).find((option) =>
      option.textContent?.includes('conversation.trace.status.failed')
    );
    expect(traceBOption).toBeDefined();
    fireEvent.click(traceBOption as Element);

    expect(await screen.findByText('model-b')).toBeInTheDocument();
    await act(async () => {
      slowTraceA.resolve({ trace, spans: [toolSpan] });
      await slowTraceA.promise;
    });

    await waitFor(() => expect(screen.getByText('model-b')).toBeInTheDocument());
    expect(screen.queryByText('gpt-test')).not.toBeInTheDocument();
  });

  it('切换会话时会忽略旧会话稍后返回的详情', async () => {
    const slowOldConversation = createDeferred<{ trace: typeof trace; spans: Array<typeof toolSpan> }>();
    const nextTrace = {
      ...trace,
      trace_id: 'turn-next',
      conversation_id: 'conversation-2',
      model: 'model-next',
    };
    const nextSpan = {
      ...toolSpan,
      span_id: 'span-next',
      trace_id: nextTrace.trace_id,
      name: 'list_directory',
    };
    mocks.listTraces.mockImplementation((request: { conversation_id: string }) =>
      Promise.resolve({
        items: request.conversation_id === 'conversation-1' ? [trace] : [nextTrace],
      })
    );
    mocks.getTrace.mockImplementation((request: { conversation_id: string }) =>
      request.conversation_id === 'conversation-1'
        ? slowOldConversation.promise
        : Promise.resolve({
            trace: nextTrace,
            spans: [nextSpan],
          })
    );

    const { rerender } = render(<TraceDrawer conversationId='conversation-1' />);
    fireEvent.click(screen.getByTestId('conversation-trace-button'));
    await waitFor(() =>
      expect(mocks.getTrace).toHaveBeenCalledWith({
        conversation_id: 'conversation-1',
        trace_id: trace.trace_id,
      })
    );

    rerender(<TraceDrawer conversationId='conversation-2' />);
    expect(await screen.findByText('model-next')).toBeInTheDocument();

    await act(async () => {
      slowOldConversation.resolve({ trace, spans: [toolSpan] });
      await slowOldConversation.promise;
    });

    await waitFor(() => expect(screen.getByText('model-next')).toBeInTheDocument());
    expect(screen.queryByText('gpt-test')).not.toBeInTheDocument();
  });

  it('列表加载期间收到的新运行不会被较早的列表快照覆盖', async () => {
    const slowList = createDeferred<{ items: Array<typeof trace> }>();
    const liveListTrace = {
      ...trace,
      trace_id: 'turn-from-ws',
      model: 'model-from-ws',
      started_at: trace.started_at + 60_000,
      updated_at: trace.updated_at + 60_000,
    };
    mocks.listTraces.mockReturnValue(slowList.promise);
    mocks.getTrace.mockResolvedValue({ trace: liveListTrace, spans: [] });

    render(<TraceDrawer conversationId='conversation-1' />);
    fireEvent.click(screen.getByTestId('conversation-trace-button'));
    await waitFor(() => expect(mocks.listTraces).toHaveBeenCalledTimes(1));

    const traceUpdatedHandler = mocks.subscribe.mock.calls[0]?.[0] as
      | ((event: ConversationTraceUpdatedEvent) => void)
      | undefined;
    act(() => {
      traceUpdatedHandler?.({
        conversation_id: 'conversation-1',
        trace_id: liveListTrace.trace_id,
        turn_id: liveListTrace.trace_id,
        update_kind: 'trace_started',
        trace: liveListTrace,
        span: null,
      });
    });
    await act(async () => {
      slowList.resolve({ items: [trace] });
      await slowList.promise;
    });

    expect(await screen.findByText('model-from-ws')).toBeInTheDocument();
    expect(mocks.getTrace).toHaveBeenCalledWith({
      conversation_id: 'conversation-1',
      trace_id: liveListTrace.trace_id,
    });
  });

  it('刷新时移除服务端快照已不再包含的旧运行', async () => {
    render(<TraceDrawer conversationId='conversation-1' />);
    fireEvent.click(screen.getByTestId('conversation-trace-button'));
    expect(await screen.findByText('gpt-test')).toBeInTheDocument();

    mocks.listTraces.mockResolvedValueOnce({ items: [] });
    fireEvent.click(screen.getByTestId('conversation-trace-refresh'));

    await waitFor(() => expect(mocks.listTraces).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('gpt-test')).not.toBeInTheDocument());
    expect(mocks.getTrace).toHaveBeenCalledTimes(1);
  });

  it('相同更新时间的开始事件不会让已完成详情回退为运行中', async () => {
    const slowDetail = createDeferred<{ trace: typeof trace; spans: Array<typeof toolSpan> }>();
    const equalTimestampStart = {
      ...trace,
      status: 'running' as const,
      model: 'stale-equal-model',
      ended_at: null,
      duration_ms: null,
    };
    mocks.getTrace.mockReturnValue(slowDetail.promise);

    render(<TraceDrawer conversationId='conversation-1' />);
    fireEvent.click(screen.getByTestId('conversation-trace-button'));
    await waitFor(() => expect(mocks.getTrace).toHaveBeenCalledTimes(1));

    const traceUpdatedHandler = mocks.subscribe.mock.calls[0]?.[0] as
      | ((event: ConversationTraceUpdatedEvent) => void)
      | undefined;
    act(() => {
      traceUpdatedHandler?.({
        conversation_id: 'conversation-1',
        trace_id: trace.trace_id,
        turn_id: trace.trace_id,
        update_kind: 'trace_started',
        trace: equalTimestampStart,
        span: null,
      });
    });
    await act(async () => {
      slowDetail.resolve({ trace, spans: [toolSpan] });
      await slowDetail.promise;
    });

    expect(await screen.findByText('gpt-test')).toBeInTheDocument();
    expect(screen.queryByText('stale-equal-model')).not.toBeInTheDocument();
  });

  it('完整详情加载期间合并同一运行的实时步骤并正确结束加载状态', async () => {
    const slowDetail = createDeferred<{ trace: typeof trace; spans: Array<typeof toolSpan> }>();
    const historicalSpan = {
      ...toolSpan,
      span_id: 'span-history',
      name: 'historical_tool',
    };
    const liveSpan = {
      ...toolSpan,
      span_id: 'span-live',
      name: 'live_tool',
      started_at: toolSpan.started_at + 500,
      updated_at: toolSpan.updated_at + 500,
    };
    const staleRunningSpan = {
      ...toolSpan,
      span_id: 'span-shared',
      name: 'stale_running_tool',
      status: 'running' as const,
      ended_at: null,
      duration_ms: null,
      updated_at: toolSpan.updated_at + 100,
    };
    const newerCompletedSpan = {
      ...staleRunningSpan,
      name: 'completed_http_tool',
      status: 'succeeded' as const,
      ended_at: toolSpan.ended_at,
      duration_ms: toolSpan.duration_ms,
      updated_at: toolSpan.updated_at + 300,
    };
    const liveTrace = {
      ...trace,
      status: 'running' as const,
      model: 'model-live',
      ended_at: null,
      duration_ms: null,
      span_count: 2,
      updated_at: trace.updated_at + 500,
    };
    mocks.getTrace.mockReturnValue(slowDetail.promise);

    render(<TraceDrawer conversationId='conversation-1' />);
    fireEvent.click(screen.getByTestId('conversation-trace-button'));
    await waitFor(() => expect(mocks.getTrace).toHaveBeenCalledTimes(1));

    const traceUpdatedHandler = mocks.subscribe.mock.calls[0]?.[0] as
      | ((event: ConversationTraceUpdatedEvent) => void)
      | undefined;
    expect(traceUpdatedHandler).toBeTypeOf('function');
    act(() => {
      traceUpdatedHandler?.({
        conversation_id: 'conversation-1',
        trace_id: trace.trace_id,
        turn_id: trace.trace_id,
        update_kind: 'span_updated',
        trace: liveTrace,
        span: liveSpan,
      });
      traceUpdatedHandler?.({
        conversation_id: 'conversation-1',
        trace_id: trace.trace_id,
        turn_id: trace.trace_id,
        update_kind: 'span_updated',
        trace: liveTrace,
        span: staleRunningSpan,
      });
    });

    await act(async () => {
      slowDetail.resolve({ trace, spans: [historicalSpan, newerCompletedSpan] });
      await slowDetail.promise;
    });

    expect(await screen.findByText('historical_tool')).toBeInTheDocument();
    expect(screen.getByText('live_tool')).toBeInTheDocument();
    expect(screen.getByText('completed_http_tool')).toBeInTheDocument();
    expect(screen.queryByText('stale_running_tool')).not.toBeInTheDocument();
    expect(screen.getByText('model-live')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('conversation-trace-refresh').className).not.toContain('arco-btn-loading')
    );
  });
});
