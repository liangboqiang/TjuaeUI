/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TChatConversation } from '@/common/config/storage';
import { ipcBridge } from '@/common';
import { assistantRuntimeKey, type Assistant } from '@/common/types/agent/assistantTypes';
import { resolveLocaleKey } from '@/common/utils';
import { isLikelyLocalFilePath, resolveAssistantAvatar } from '@/renderer/utils/model/assistantAvatar';
import useSWR from 'swr';

export interface PresetAssistantInfo {
  name: string;
  logo: string;
  isEmoji: boolean;
  isFallback?: boolean;
  backend?: string;
  assistantId?: string;
}

/**
 * 规范化头像：支持 emoji / 内置 svg / 扩展资源 URL
 * Normalize avatar to either emoji text or a renderable image URL
 */
function normalizeAvatar(avatar: string | undefined): { logo: string; isEmoji: boolean; isFallback?: boolean } {
  const resolved = resolveAssistantAvatar(avatar);
  if (resolved.kind === 'image') {
    return { logo: resolved.value, isEmoji: false };
  }

  if (resolved.kind === 'fallback') {
    return { logo: '', isEmoji: false, isFallback: true };
  }

  return { logo: resolved.value, isEmoji: true };
}

/**
 * Build assistant info from a backend-provided Assistant record.
 */
function buildPresetInfoFromAssistant(assistant: Assistant, locale: string): PresetAssistantInfo {
  const localeKey = resolveLocaleKey(locale);
  const name = assistant.name_i18n?.[localeKey] || assistant.name_i18n?.[locale] || assistant.name || assistant.id;
  const avatar = typeof assistant.avatar === 'string' ? assistant.avatar : '';
  const normalized = normalizeAvatar(avatar);
  return {
    name,
    logo: normalized.logo,
    isEmoji: normalized.isEmoji,
    isFallback: normalized.isFallback,
    backend: assistantRuntimeKey(assistant) || undefined,
    assistantId: assistant.id,
  };
}

function buildPresetInfoFromConversationAssistant(
  assistant: NonNullable<TChatConversation['assistant']>
): PresetAssistantInfo {
  const normalized = normalizeAvatar(assistant.avatar);
  return {
    name: assistant.name,
    logo: normalized.logo,
    isEmoji: normalized.isEmoji,
    isFallback: normalized.isFallback,
    backend: assistant.backend,
    assistantId: assistant.id,
  };
}

/**
 * Resolve the assistant identity captured by the current conversation model.
 *
 * `conversation.assistant` is the sole identity source. The assistant catalog
 * is consulted only when an absolute local avatar snapshot cannot be rendered
 * safely in the renderer; lookup is always by the exact current assistant ID.
 *
 * @param conversation - 会话对象 / Conversation object
 * @returns 助手信息或 null / Assistant info or null
 */
export function usePresetAssistantInfo(conversation: TChatConversation | undefined): {
  info: PresetAssistantInfo | null;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const assistantSnapshot = conversation?.assistant;
  const snapshotAvatar = typeof assistantSnapshot?.avatar === 'string' ? assistantSnapshot.avatar.trim() : '';
  const needsCatalogAvatar = Boolean(assistantSnapshot && snapshotAvatar && isLikelyLocalFilePath(snapshotAvatar));
  const { data: assistantsList, isLoading: isLoadingAssistants } = useSWR(
    needsCatalogAvatar ? 'assistants.list' : null,
    () => ipcBridge.assistants.list.invoke().catch(() => [] as Assistant[])
  );

  return useMemo<{ info: PresetAssistantInfo | null; isLoading: boolean }>(() => {
    if (!assistantSnapshot) return { info: null, isLoading: false };

    if (needsCatalogAvatar) {
      const catalogAssistant = assistantsList?.find((assistant) => assistant.id === assistantSnapshot.id);
      if (catalogAssistant) {
        return {
          info: buildPresetInfoFromAssistant(catalogAssistant, i18n.language || 'en-US'),
          isLoading: false,
        };
      }
      if (isLoadingAssistants) return { info: null, isLoading: true };
    }

    return {
      info: buildPresetInfoFromConversationAssistant(assistantSnapshot),
      isLoading: false,
    };
  }, [assistantSnapshot, assistantsList, i18n.language, isLoadingAssistants, needsCatalogAvatar]);
}
