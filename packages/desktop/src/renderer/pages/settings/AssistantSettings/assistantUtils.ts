import type { Assistant } from '@/common/types/agent/assistantTypes';
import { isBackendRelativeAssetPath, isLikelyLocalFilePath } from '@/renderer/utils/model/assistantAvatar';
import { resolveExtensionAssetUrl } from '@/renderer/utils/platform';

export const isEmoji = (value: string): boolean => {
  if (!value) return false;
  return /^(?:\p{Emoji_Presentation}|\p{Emoji}️)(?:‍(?:\p{Emoji_Presentation}|\p{Emoji}️))*$/u.test(value);
};

export const resolveAvatarImageSrc = (avatar: string | undefined): string | undefined => {
  const value = avatar?.trim();
  if (!value || isLikelyLocalFilePath(value)) return undefined;
  if (value.startsWith('/') && !isBackendRelativeAssetPath(value)) return undefined;
  const resolved = resolveExtensionAssetUrl(value) || value;
  return /\.(svg|png|jpe?g|webp|gif)$/iu.test(resolved) || /^(https?:|file:\/\/|data:|\/)/iu.test(resolved)
    ? resolved
    : undefined;
};

export const reorderAssistantList = (assistants: Assistant[], activeId: string, overId: string): Assistant[] => {
  const activeIndex = assistants.findIndex((assistant) => assistant.id === activeId);
  const overIndex = assistants.findIndex((assistant) => assistant.id === overId);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return assistants;
  const reordered = [...assistants];
  const [moved] = reordered.splice(activeIndex, 1);
  reordered.splice(overIndex, 0, moved);
  return reordered;
};
