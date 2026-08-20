import type { Assistant } from '@/common/types/agent/assistantTypes';

/**
 * Single source of truth for which assistants appear in a *selection* list
 * (home pill bar, team creation, scheduled-task dropdown, …) and in what order.
 *
 * 目录运行时只包含已完成逐资源确认并成功激活的助手。用户排序优先；
 * 未排序项按“我的助手 → TjuaeHub”及目录顺序稳定追加。
 */

const sourceGroupWeight = (source: Assistant['source']): number => {
  switch (source) {
    case 'mine':
      return 0;
    case 'tjuae-hub':
      return 1;
  }
};

const compareCatalogAssistantOrder = (left: Assistant, right: Assistant): number => {
  const groupDelta = sourceGroupWeight(left.source) - sourceGroupWeight(right.source);
  if (groupDelta !== 0) return groupDelta;

  const orderDelta = left.sort_order - right.sort_order;
  if (orderDelta !== 0) return orderDelta;

  return left.id.localeCompare(right.id);
};

/**
 * Return enabled assistants in the user's preferred cross-source order.
 * Stale IDs and duplicates in `preferredOrder` are ignored.
 */
export const selectableAssistants = (assistants: Assistant[], preferredOrder?: readonly string[]): Assistant[] => {
  const catalogOrdered = assistants
    .filter((assistant) => assistant.enabled !== false)
    .toSorted(compareCatalogAssistantOrder);

  if (!preferredOrder || preferredOrder.length === 0) {
    return catalogOrdered;
  }

  const enabledById = new Map(catalogOrdered.map((assistant) => [assistant.id, assistant]));
  const orderedAssistants: Assistant[] = [];
  const includedIds = new Set<string>();

  for (const assistantId of preferredOrder) {
    const assistant = enabledById.get(assistantId);
    if (!assistant || includedIds.has(assistantId)) continue;
    includedIds.add(assistantId);
    orderedAssistants.push(assistant);
  }

  for (const assistant of catalogOrdered) {
    if (includedIds.has(assistant.id)) continue;
    includedIds.add(assistant.id);
    orderedAssistants.push(assistant);
  }

  return orderedAssistants;
};
