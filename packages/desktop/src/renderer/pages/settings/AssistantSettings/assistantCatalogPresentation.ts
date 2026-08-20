import type { AssistantCatalogIdentity, AssistantCatalogSource } from '@/common/types/platform/assistantCatalog';

export const ASSISTANT_SOURCES: AssistantCatalogSource[] = ['mine', 'tjuae-hub'];

export const assistantSourceTranslationKey: Record<AssistantCatalogSource, string> = {
  mine: 'settings.assistantCatalog.sources.mine',
  'tjuae-hub': 'settings.assistantCatalog.sources.tjuaeHub',
};

export const assistantCatalogRoute = (identity: AssistantCatalogIdentity): string =>
  `/settings/assistants/${encodeURIComponent(identity.source)}/${encodeURIComponent(
    identity.namespace || '~'
  )}/${encodeURIComponent(identity.slug)}`;

export const compactBytes = (value: number): string => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};
