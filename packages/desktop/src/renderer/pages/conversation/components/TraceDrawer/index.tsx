import { ipcBridge } from '@/common';
import type { TMessage } from '@/common/chat/chatLib';
import { Button, Drawer, Empty, Spin, Tag, Timeline, Tooltip, Typography } from '@arco-design/web-react';
import { Refresh, Trace } from '@icon-park/react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

const messageText = (message: TMessage): string => {
  if (message.type === 'text' || message.type === 'thinking' || message.type === 'tips') {
    return String(message.content.content ?? '').trim();
  }
  if (message.type === 'tool_call') {
    return message.content.name || message.content.description || '';
  }
  if (message.type === 'tool_group') {
    return message.content
      .map((tool) => tool.name || tool.description)
      .filter(Boolean)
      .join('、');
  }
  if (message.type === 'acp_tool_call') {
    const update = message.content.update as { title?: string; tool_call_id?: string } | undefined;
    return update?.title || update?.tool_call_id || '';
  }
  if (message.type === 'permission' || message.type === 'acp_permission') {
    return message.type === 'permission'
      ? message.content.description
      : message.content.tool_call.title ||
          message.content.tool_call.raw_input?.description ||
          message.content.tool_call.tool_call_id;
  }
  if (message.type === 'agent_status') {
    return `${message.content.backend} · ${message.content.status}`;
  }
  return '';
};

const traceColor = (message: TMessage): string => {
  if (message.status === 'error' || (message.type === 'tips' && message.content.type === 'error')) return 'red';
  if (message.status === 'pending' || message.status === 'work') return 'orange';
  if (message.type === 'tool_call' || message.type === 'tool_group' || message.type === 'acp_tool_call')
    return 'arcoblue';
  if (message.type === 'thinking') return 'purple';
  return 'green';
};

export const TracePanel: React.FC<{
  conversationId: string;
  active?: boolean;
  showHeader?: boolean;
}> = ({ conversationId, active = true, showHeader = true }) => {
  const { t, i18n } = useTranslation();
  const { data, error, isLoading, mutate } = useSWR(
    active ? ['conversation-trace', conversationId] : null,
    () => ipcBridge.database.getConversationMessages.invoke({ conversation_id: conversationId, limit: 200 }),
    { refreshInterval: active ? 1500 : 0, revalidateOnFocus: false }
  );
  const events = useMemo(
    () => (data?.items ?? []).toSorted((left, right) => (left.created_at ?? 0) - (right.created_at ?? 0)),
    [data?.items]
  );

  return (
    <div className='flex h-full min-h-0 flex-col bg-1'>
      {showHeader && (
        <div className='flex h-32px shrink-0 items-center justify-between border-b border-border-1 px-12px'>
          <Typography.Text bold>{t('conversation.trace.title')}</Typography.Text>
          <Tooltip content={t('conversation.trace.refresh')}>
            <Button
              type='text'
              shape='circle'
              size='mini'
              loading={isLoading}
              icon={<Refresh theme='outline' size='16' />}
              aria-label={t('conversation.trace.refresh')}
              onClick={() => void mutate()}
            />
          </Tooltip>
        </div>
      )}
      <div className='min-h-0 flex-1 overflow-y-auto p-16px'>
        <Typography.Paragraph type='secondary' className='mb-20px'>
          {t('conversation.trace.description')}
        </Typography.Paragraph>
        {isLoading && !data ? (
          <div className='flex justify-center py-48px'>
            <Spin />
          </div>
        ) : error ? (
          <Empty description={t('conversation.trace.loadFailed')} />
        ) : events.length === 0 ? (
          <Empty description={t('conversation.trace.empty')} />
        ) : (
          <Timeline>
            {events.map((event) => {
              const preview = messageText(event);
              return (
                <Timeline.Item key={event.id} dotColor={traceColor(event)}>
                  <div className='mb-4px flex items-center gap-8px'>
                    <Tag color={traceColor(event)} size='small'>
                      {t(`conversation.trace.kind.${event.type}` as const, { defaultValue: event.type })}
                    </Tag>
                    <Typography.Text type='secondary' className='text-12px'>
                      {new Intl.DateTimeFormat(i18n.language, {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        fractionalSecondDigits: 3,
                      }).format(event.created_at ?? Date.now())}
                    </Typography.Text>
                  </div>
                  {preview && (
                    <Typography.Paragraph ellipsis={{ rows: 3, expandable: true }}>{preview}</Typography.Paragraph>
                  )}
                </Timeline.Item>
              );
            })}
          </Timeline>
        )}
      </div>
    </div>
  );
};

const TraceDrawer: React.FC<{ conversationId: string }> = ({ conversationId }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Tooltip content={t('conversation.trace.title')}>
        <Button
          type='text'
          shape='circle'
          size='mini'
          icon={<Trace theme='outline' size='16' />}
          aria-label={t('conversation.trace.title')}
          onClick={() => setVisible(true)}
        />
      </Tooltip>
      <Drawer
        width={560}
        visible={visible}
        title={t('conversation.trace.title')}
        onCancel={() => setVisible(false)}
        footer={null}
        unmountOnExit
      >
        <TracePanel conversationId={conversationId} active={visible} showHeader={false} />
      </Drawer>
    </>
  );
};

export default TraceDrawer;
