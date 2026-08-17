import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import type { SkillWorkspace } from '@/common/types/platform/skill';
import { Button, Empty, Message, Spin } from '@arco-design/web-react';
import { ArrowLeft } from '@icon-park/react';
import { createTwoFilesPatch } from 'diff';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import ChatConversation from '@/renderer/pages/conversation/components/ChatConversation';
import { usePreviewContext } from '@/renderer/pages/conversation/Preview/context/PreviewContext';
import { getConversationOrNull } from '@/renderer/pages/conversation/utils/conversationCache';
import { createDiffResourceKey } from '@/renderer/utils/file/resourceKey';

const BUTLER_ID = 'tjuaeui-assistant';
const CONVERSATION_MAP_KEY = 'tjuae.skill-workbench.conversations.v1';

const findButler = (assistants: Assistant[]): Assistant | undefined =>
  assistants.find((assistant) => assistant.id.replace(/^builtin-/u, '') === BUTLER_ID);

const readConversationMap = (): Record<string, string> => {
  try {
    const value = JSON.parse(localStorage.getItem(CONVERSATION_MAP_KEY) ?? '{}') as unknown;
    return value && typeof value === 'object' ? (value as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const writeConversationId = (slug: string, conversationId: string): void => {
  try {
    localStorage.setItem(CONVERSATION_MAP_KEY, JSON.stringify({ ...readConversationMap(), [slug]: conversationId }));
  } catch {
    // 本地偏好不可写时仍可使用当前工作台，只是不复用会话。
  }
};

const ensureSkillConversation = async (skill: SkillWorkspace): Promise<TChatConversation> => {
  const knownId = readConversationMap()[skill.slug];
  if (knownId) {
    const existing = await getConversationOrNull(knownId);
    const sourceWorkspace = (existing?.extra as { skill_workspace?: string } | undefined)?.skill_workspace;
    if (existing && sourceWorkspace === skill.path) return existing;
  }

  const assistants = await ipcBridge.assistants.list.invoke();
  const butler = findButler(assistants);
  if (!butler) throw new Error('BUTLER_NOT_AVAILABLE');
  if (butler.enabled === false) {
    await ipcBridge.assistants.setState.invoke({ id: butler.id, enabled: true });
  }
  const conversation = await ipcBridge.conversation.create.invoke({
    assistant: { id: butler.id },
    name: skill.name,
    extra: {
      skill_workspace: skill.path,
      system_action: true,
    },
  });
  writeConversationId(skill.slug, conversation.id);
  return conversation;
};

const SkillDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { openPreview } = usePreviewContext();
  const { skillName = '' } = useParams<{ skillName: string }>();
  const slug = decodeURIComponent(skillName);
  const [conversation, setConversation] = useState<TChatConversation | null>(null);
  const [conversationError, setConversationError] = useState(false);
  const openedComparisonRef = useRef('');

  const { data: skills, isLoading } = useSWR<SkillWorkspace[]>('skills.workspaces', () =>
    ipcBridge.fs.listAvailableSkills.invoke()
  );
  const skill = skills?.find((item) => item.slug === slug);

  useEffect(() => {
    if (!skill) return;
    let cancelled = false;
    setConversationError(false);
    void ensureSkillConversation(skill)
      .then((value) => {
        if (!cancelled) setConversation(value);
      })
      .catch((error) => {
        console.error('[SkillWorkbench] Failed to create Butler conversation', error);
        if (!cancelled) {
          setConversationError(true);
          Message.error(t('settings.skillsHub.workbenchConversationFailed'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [skill, t]);

  useEffect(() => {
    const comparisonRequest = (location.state as { marketComparison?: { marketId: string; slug: string } } | null)
      ?.marketComparison;
    if (!skill || !conversation || !comparisonRequest || comparisonRequest.slug !== skill.slug) return;
    const requestKey = `${comparisonRequest.marketId}:${comparisonRequest.slug}`;
    if (openedComparisonRef.current === requestKey) return;
    openedComparisonRef.current = requestKey;
    void ipcBridge.fs.compareMarketSkill
      .invoke(comparisonRequest)
      .then((comparison) => {
        const textFiles = comparison.files.filter(
          (file) => !file.binary && (file.localContent != null || file.remoteContent != null)
        );
        if (textFiles.length === 0) {
          Message.info(t('settings.skillsHub.compareNoChanges'));
          return;
        }
        for (const file of textFiles) {
          const localContent = file.localContent ?? '';
          const remoteContent = file.remoteContent ?? '';
          const patch = createTwoFilesPatch(
            `${file.path} (${t('settings.skillsHub.compareLocal')})`,
            `${file.path} (${t('settings.skillsHub.compareMarket')})`,
            localContent,
            remoteContent,
            comparison.baseRevision.slice(0, 8),
            comparison.remoteRevision.slice(0, 8)
          );
          openPreview(patch, 'diff', {
            resource_key: createDiffResourceKey(skill.path, file.path, `market-${comparison.remoteRevision}`),
            title: `${file.path} · ${t('settings.skillsHub.compare')}`,
            file_name: file.path,
            workspace: skill.path,
            editable: false,
            original_content: localContent,
            modified_content: remoteContent,
          });
        }
      })
      .catch((error) => {
        openedComparisonRef.current = '';
        console.error('[SkillWorkbench] Failed to compare market skill', error);
        Message.error(t('settings.skillsHub.compareFailed'));
      });
  }, [conversation, location.state, openPreview, skill, t]);

  const goBack = useCallback(() => {
    void navigate('/settings/skills');
  }, [navigate]);

  if (isLoading || (skill && !conversation && !conversationError)) {
    return (
      <div className='flex size-full items-center justify-center'>
        <Spin />
      </div>
    );
  }

  if (!skill || conversationError || !conversation) {
    return (
      <div className='flex size-full flex-col items-center justify-center gap-16px'>
        <Empty description={t('settings.skillsHub.detailNotFound')} />
        <Button type='outline' icon={<ArrowLeft size={15} />} onClick={goBack}>
          {t('settings.skillsHub.detailBackToList')}
        </Button>
      </div>
    );
  }

  return (
    <ChatConversation
      conversation={conversation}
      workspaceOverride={skill.path}
      initialOpenFiles={['.tjuae-skill.json', 'SKILL.md']}
    />
  );
};

export default SkillDetailPage;
