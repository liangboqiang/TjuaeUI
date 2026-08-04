import { ipcBridge } from '@/common';
import type { TMessage } from '@/common/chat/chatLib';
import { Button, Drawer, Empty, Spin, Tag, Timeline, Typography } from '@arco-design/web-react';
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

const TraceDrawer: React.FC<{ conversationId: string }> = ({ conversationId }) => {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const { data, error, isLoading, mutate } = useSWR(
    visible ? ['conversation-trace', conversationId] : null,
    () => ipcBridge.database.getConversationMessages.invoke({ conversation_id: conversationId, limit: 200 }),
    { refreshInterval: visible ? 1500 : 0, revalidateOnFocus: false }
  );
  const events = useMemo(
    () => [...(data?.items ?? [])].sort((left, right) => (left.created_at ?? 0) - (right.created_at ?? 0)),
    [data?.items]
  );

  return (
    <>
      <Button size='mini' onClick={() => setVisible(true)}>
        {t('conversation.trace.open')}
      </Button>
      <Drawer
        width={560}
        visible={visible}
        title={t('conversation.trace.title')}
        onCancel={() => setVisible(false)}
        footer={null}
        unmountOnExit
      >
        <div className='flex items-center justify-between mb-20px'>
          <Typography.Text type='secondary'>{t('conversation.trace.description')}</Typography.Text>
          <Button size='small' loading={isLoading} onClick={() => void mutate()}>
            {t('conversation.trace.refresh')}
          </Button>
        </div>
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
                  <div className='flex items-center gap-8px mb-4px'>
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
      </Drawer>
    </>
  );
};

export default TraceDrawer;
