import { ipcBridge } from '@/common';
import type { IConversationMcpStatus, IProvider, TChatConversation, TProviderWithModel } from '@/common/config/storage';
import { uuid } from '@/common/utils';
import addChatIcon from '@/renderer/assets/icons/add-chat.svg';
import { CronJobManager } from '@/renderer/pages/cron';
import { resolveCronJobId } from '@/renderer/pages/cron/cronUtils';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { usePresetAssistantInfo } from '@/renderer/hooks/agent/usePresetAssistantInfo';
import { iconColors } from '@/renderer/styles/colors';
import { Button, Dropdown, Menu, Message, Tooltip, Typography } from '@arco-design/web-react';
import { History } from '@icon-park/react';
import React, { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { emitter } from '../../../utils/emitter';
import AcpChat from '../platforms/acp/AcpChat';
import ChatLayout from './ChatLayout';
import ChatSlider from './ChatSlider.tsx';
import { getConversationOrNull } from '@/renderer/pages/conversation/utils/conversationCache';
import { getConversationCreateErrorMessage } from '@/renderer/pages/conversation/utils/conversationCreateError';
import TjuaeCliChat from '../platforms/tjuaecli/TjuaeCliChat';
import { useTjuaeCliModelSelection } from '../platforms/tjuaecli/useTjuaeCliModelSelection';
import { useConversationRuntimeView } from '../runtime/useConversationRuntimeView';
import { isLegacyReadOnlyConversationType } from '../utils/conversationRuntime';
import { resolveConversationBackend } from '../utils/conversationAssistantIdentity';
import LegacyReadOnlyConversation from '../platforms/legacy/LegacyReadOnlyConversation';
import { useActiveLease } from '../hooks/useActiveLease';
import TraceDrawer from './TraceDrawer';
// import SkillRuleGenerator from './components/SkillRuleGenerator'; // Temporarily hidden

const _AssociatedConversation: React.FC<{ conversation_id: string }> = ({ conversation_id }) => {
  const { data } = useSWR(['getAssociateConversation', conversation_id], () =>
    ipcBridge.conversation.getAssociateConversation.invoke({ conversation_id })
  );
  const navigate = useNavigate();
  const list = useMemo(() => {
    if (!data?.length) return [];
    return data.filter((conversation) => conversation.id !== conversation_id);
  }, [data]);
  if (!list.length) return null;
  return (
    <Dropdown
      droplist={
        <Menu
          onClickMenuItem={(key) => {
            Promise.resolve(navigate(`/conversation/${key}`)).catch((error) => {
              console.error('Navigation failed:', error);
            });
          }}
        >
          {list.map((conversation) => {
            return (
              <Menu.Item key={conversation.id}>
                <Typography.Ellipsis className={'max-w-300px'}>{conversation.name}</Typography.Ellipsis>
              </Menu.Item>
            );
          })}
        </Menu>
      }
      trigger={['click']}
    >
      <Button
        size='mini'
        icon={
          <History
            theme='filled'
            size='14'
            fill={iconColors.primary}
            strokeWidth={2}
            strokeLinejoin='miter'
            strokeLinecap='square'
          />
        }
      ></Button>
    </Dropdown>
  );
};

const _AddNewConversation: React.FC<{ conversation: TChatConversation }> = ({ conversation }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isCreatingRef = useRef(false);
  if (!conversation.extra?.workspace) return null;
  return (
    <Tooltip content={t('conversation.workspace.createNewConversation')}>
      <Button
        size='mini'
        icon={<img src={addChatIcon} alt='Add chat' className='w-14px h-14px block m-auto' />}
        onClick={async () => {
          if (isCreatingRef.current) return;
          isCreatingRef.current = true;
          try {
            const id = uuid();
            // Fetch latest conversation from DB to ensure session_mode is current
            const latest = await getConversationOrNull(conversation.id);
            const source = latest || conversation;
            await ipcBridge.conversation.createWithConversation.invoke({
              conversation: {
                ...source,
                id,
                created_at: Date.now(),
                modified_at: Date.now(),
                // Clear ACP session fields to prevent new conversation from inheriting old session context
                extra:
                  source.type === 'acp'
                    ? { ...source.extra, acp_session_id: undefined, acp_session_updated_at: undefined }
                    : source.extra,
              } as TChatConversation,
            });
            void navigate(`/conversation/${id}`);
            emitter.emit('chat.history.refresh');
          } catch (error) {
            console.error('Failed to create conversation:', error);
            Message.error(getConversationCreateErrorMessage(error, t));
          } finally {
            isCreatingRef.current = false;
          }
        }}
      />
    </Tooltip>
  );
};

type TjuaeCliConversation = Extract<TChatConversation, { type: 'tjuaecli' }>;

const TjuaeCliConversationPanel: React.FC<{
  conversation: TjuaeCliConversation;
  sliderTitle: React.ReactNode;
  workspaceOverride?: string;
  initialOpenFiles?: string[];
  initiallyExpandWorkspace?: boolean;
}> = ({ conversation, sliderTitle, workspaceOverride, initialOpenFiles, initiallyExpandWorkspace }) => {
  const runtimeView = useConversationRuntimeView(conversation.id);
  const onSelectModel = useCallback(
    async (_provider: IProvider, modelName: string) => {
      const selected = { ..._provider, use_model: modelName } as TProviderWithModel;
      // Kill running agent on model switch — will be rebuilt with new model on next message
      if (runtimeView.activeTurnId) {
        const result = await ipcBridge.conversation.stop.invoke({
          conversation_id: conversation.id,
          turn_id: runtimeView.activeTurnId,
        });
        runtimeView.markStopAcknowledged(runtimeView.activeTurnId, result.runtime);
      }
      const ok = await ipcBridge.conversation.update.invoke({ id: conversation.id, updates: { model: selected } });
      return Boolean(ok);
    },
    [conversation.id, runtimeView]
  );

  const modelSelection = useTjuaeCliModelSelection({
    initialModel: conversation.model,
    onSelectModel,
  });
  const workspace = workspaceOverride ?? conversation.extra?.workspace;
  const workspaceEnabled = Boolean(workspace);
  const cronJobId = resolveCronJobId(conversation.extra);
  const { info: presetAssistantInfo } = usePresetAssistantInfo(conversation);
  const tjuaecliAssistantId = presetAssistantInfo?.assistantId;
  const layout = useLayoutContext();
  const isMobile = Boolean(layout?.isMobile);

  const chatLayoutProps = {
    title: conversation.name,
    siderTitle: sliderTitle,
    sider: (
      <ChatSlider
        conversation={conversation}
        workspaceOverride={workspaceOverride}
        initialOpenFiles={initialOpenFiles}
      />
    ),
    headerExtra: (
      <div className='flex items-center gap-8px'>
        {isMobile && <TraceDrawer conversationId={conversation.id} />}
        <CronJobManager conversation_id={conversation.id} cron_job_id={cronJobId} />
      </div>
    ),
    workspaceEnabled,
    initiallyExpandWorkspace,
    workspacePath: workspace,
    isTemporaryWorkspace: (conversation.extra as { is_temporary_workspace?: boolean } | undefined)
      ?.is_temporary_workspace,
    backend: 'tjuaecli' as const,
    presetAssistant: presetAssistantInfo ? { ...presetAssistantInfo, id: tjuaecliAssistantId } : undefined,
  };

  return (
    <ChatLayout {...chatLayoutProps} conversation_id={conversation.id}>
      <TjuaeCliChat
        conversation_id={conversation.id}
        workspace={workspace}
        modelSelection={modelSelection}
        session_mode={conversation.extra?.session_mode}
        cron_job_id={cronJobId}
        loadedSkills={(conversation.extra as { skills?: string[] } | undefined)?.skills}
        loadedMcpServers={(conversation.extra as { mcp_servers?: string[] } | undefined)?.mcp_servers}
        loadedMcpStatuses={
          (conversation.extra as { mcp_statuses?: IConversationMcpStatus[] } | undefined)?.mcp_statuses
        }
        agent_name={presetAssistantInfo?.name}
        assistantId={tjuaecliAssistantId}
      />
    </ChatLayout>
  );
};

const ChatConversation: React.FC<{
  conversation?: TChatConversation;
  hideSendBox?: boolean;
  workspaceOverride?: string;
  initialOpenFiles?: string[];
  initiallyExpandWorkspace?: boolean;
}> = ({ conversation, hideSendBox, workspaceOverride, initialOpenFiles, initiallyExpandWorkspace }) => {
  const { t } = useTranslation();
  useActiveLease({ type: 'conversation', id: conversation?.id });
  const workspaceEnabled = Boolean(workspaceOverride ?? conversation?.extra?.workspace);
  const cronJobId = resolveCronJobId(conversation?.extra);
  const layout = useLayoutContext();
  const isMobile = Boolean(layout?.isMobile);

  const isTjuaeCliConversation = conversation?.type === 'tjuaecli';
  const isLegacyReadOnlyConversation = isLegacyReadOnlyConversationType(conversation?.type);
  const resolvedHideSendBox = hideSendBox || isLegacyReadOnlyConversationType(conversation?.type);

  // 使用统一的 Hook 获取预设助手信息（ACP/Codex 会话）
  // Use unified hook for preset assistant info (ACP/Codex conversations)
  const acpConversation = isTjuaeCliConversation ? undefined : conversation;
  const { info: presetAssistantInfo, isLoading: isLoadingPreset } = usePresetAssistantInfo(acpConversation);
  const acpAssistantId = presetAssistantInfo?.assistantId;
  const resolvedConversationBackend = resolveConversationBackend(conversation, presetAssistantInfo?.backend);

  const conversationAgentName = (conversation?.extra as { agent_name?: string } | undefined)?.agent_name;
  const assistantDisplayName = presetAssistantInfo?.name || conversationAgentName;

  const conversationNode = useMemo(() => {
    if (!conversation || isTjuaeCliConversation) return null;
    if (isLegacyReadOnlyConversation) {
      return <LegacyReadOnlyConversation key={conversation.id} conversation={conversation} />;
    }
    switch (conversation.type) {
      case 'acp':
        return (
          <AcpChat
            key={conversation.id}
            conversation_id={conversation.id}
            workspace={conversation.extra?.workspace}
            backend={resolvedConversationBackend || 'claude'}
            initialModelId={(conversation.extra as { current_model_id?: string } | undefined)?.current_model_id}
            session_mode={conversation.extra?.session_mode}
            agent_name={assistantDisplayName}
            cron_job_id={cronJobId}
            hideSendBox={resolvedHideSendBox}
            loadedSkills={(conversation.extra as { skills?: string[] } | undefined)?.skills}
            loadedMcpServers={(conversation.extra as { mcp_servers?: string[] } | undefined)?.mcp_servers}
            loadedMcpStatuses={
              (conversation.extra as { mcp_statuses?: IConversationMcpStatus[] } | undefined)?.mcp_statuses
            }
            assistantId={acpAssistantId}
          ></AcpChat>
        );
      default:
        return null;
    }
  }, [
    conversation,
    isTjuaeCliConversation,
    isLegacyReadOnlyConversation,
    resolvedConversationBackend,
    assistantDisplayName,
    cronJobId,
    resolvedHideSendBox,
    acpAssistantId,
  ]);

  const sliderTitle = useMemo(() => {
    return (
      <div className='flex items-center justify-between'>
        <span className='text-16px font-bold text-t-primary'>{t('conversation.workspace.title')}</span>
      </div>
    );
  }, [t]);

  if (conversation && conversation.type === 'tjuaecli') {
    return (
      <TjuaeCliConversationPanel
        key={conversation.id}
        conversation={conversation}
        sliderTitle={sliderTitle}
        workspaceOverride={workspaceOverride}
        initialOpenFiles={initialOpenFiles}
        initiallyExpandWorkspace={initiallyExpandWorkspace}
      />
    );
  }

  // 如果有预设助手信息，使用预设助手的 logo 和名称；加载中时不进入 fallback；否则使用 backend 的 logo
  // If preset assistant info exists, use preset logo/name; while loading, avoid fallback; otherwise use backend logo
  const chatLayoutProps = presetAssistantInfo
    ? {
        presetAssistant: { ...presetAssistantInfo, id: acpAssistantId },
      }
    : isLoadingPreset
      ? {} // Still loading custom agents — avoid showing backend logo prematurely
      : {
          backend: resolvedConversationBackend,
          agent_name: conversationAgentName,
        };

  const headerExtraNode = (
    <div className='flex items-center gap-8px'>
      {conversation && (
        <div className='shrink-0 flex items-center gap-8px'>
          {isMobile && <TraceDrawer conversationId={conversation.id} />}
          <CronJobManager conversation_id={conversation.id} cron_job_id={cronJobId} />
        </div>
      )}
    </div>
  );

  return (
    <ChatLayout
      title={conversation?.name}
      {...chatLayoutProps}
      headerExtra={headerExtraNode}
      siderTitle={sliderTitle}
      sider={
        <ChatSlider
          conversation={conversation}
          workspaceOverride={workspaceOverride}
          initialOpenFiles={initialOpenFiles}
        />
      }
      workspaceEnabled={workspaceEnabled}
      initiallyExpandWorkspace={initiallyExpandWorkspace}
      workspacePath={workspaceOverride ?? conversation?.extra?.workspace}
      isTemporaryWorkspace={
        (conversation?.extra as { is_temporary_workspace?: boolean } | undefined)?.is_temporary_workspace
      }
      conversation_id={conversation?.id}
    >
      {conversationNode}
    </ChatLayout>
  );
};

export default ChatConversation;
