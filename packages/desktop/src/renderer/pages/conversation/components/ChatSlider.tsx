import type { TChatConversation } from '@/common/config/storage';
import { Message } from '@arco-design/web-react';
import React from 'react';
import ChatWorkspace from '../Workspace';

const ChatSlider: React.FC<{
  conversation?: TChatConversation;
  workspaceOverride?: string;
  initialOpenFiles?: string[];
}> = ({ conversation, workspaceOverride, initialOpenFiles }) => {
  const [messageApi, messageContext] = Message.useMessage({ maxCount: 1 });

  let workspaceNode: React.ReactNode = null;
  const workspace = workspaceOverride ?? conversation?.extra?.workspace;
  if (conversation?.type === 'acp' && workspace) {
    workspaceNode = (
      <ChatWorkspace
        conversation_id={conversation.id}
        workspace={workspace}
        isTemporaryWorkspace={
          (conversation.extra as { is_temporary_workspace?: boolean } | undefined)?.is_temporary_workspace
        }
        eventPrefix='acp'
        messageApi={messageApi}
        initialOpenFiles={initialOpenFiles}
      ></ChatWorkspace>
    );
  } else if (conversation?.type === 'codex' && workspace) {
    workspaceNode = (
      <ChatWorkspace
        conversation_id={conversation.id}
        workspace={workspace}
        isTemporaryWorkspace={
          (conversation.extra as { is_temporary_workspace?: boolean } | undefined)?.is_temporary_workspace
        }
        eventPrefix='codex'
        messageApi={messageApi}
        initialOpenFiles={initialOpenFiles}
      ></ChatWorkspace>
    );
  } else if (conversation?.type === 'tjuaecli' && workspace) {
    workspaceNode = (
      <ChatWorkspace
        conversation_id={conversation.id}
        workspace={workspace}
        isTemporaryWorkspace={
          (conversation.extra as { is_temporary_workspace?: boolean } | undefined)?.is_temporary_workspace
        }
        eventPrefix='tjuaecli'
        messageApi={messageApi}
        initialOpenFiles={initialOpenFiles}
      ></ChatWorkspace>
    );
  }

  if (!workspaceNode) {
    return <div></div>;
  }

  return (
    <>
      {messageContext}
      {workspaceNode}
    </>
  );
};

export default ChatSlider;
