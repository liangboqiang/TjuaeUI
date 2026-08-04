/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Assistant } from '@/common/types/agent/assistantTypes';

/**
 * Single source of truth for which assistants appear in a *selection* list
 * (home pill bar, team creation, scheduled-task dropdown, …) and in what order.
 *
 * Rules (see PRD F-AHM-06 / F-AHM-07):
 *  - Only enabled assistants are selectable.
 *  - A stored enabled-order preference takes priority across every source.
 *  - Without a preference, generated assistants precede user-created ones.
 *  - New assistants missing from a stored preference append in that same
 *    deterministic source and sort order.
 *
 * Note: a bare CLI assistant surfaces with `source === 'generated'`.
 */

/** Source group weight — lower comes first. Generated < user-created. */
const sourceGroupWeight = (source: Assistant['source']): number => {
  switch (source) {
    case 'generated':
      return 0;
    case 'user':
      return 1;
  }
};

const compareDefaultAssistantOrder = (left: Assistant, right: Assistant): number => {
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
  const defaultOrdered = assistants
    .filter((assistant) => assistant.enabled !== false)
    .toSorted(compareDefaultAssistantOrder);

  if (!preferredOrder || preferredOrder.length === 0) {
    return defaultOrdered;
  }

  const enabledById = new Map(defaultOrdered.map((assistant) => [assistant.id, assistant]));
  const orderedAssistants: Assistant[] = [];
  const includedIds = new Set<string>();

  for (const assistantId of preferredOrder) {
    const assistant = enabledById.get(assistantId);
    if (!assistant || includedIds.has(assistantId)) continue;
    includedIds.add(assistantId);
    orderedAssistants.push(assistant);
  }

  for (const assistant of defaultOrdered) {
    if (includedIds.has(assistant.id)) continue;
    includedIds.add(assistant.id);
    orderedAssistants.push(assistant);
  }

  return orderedAssistants;
};

/** Build the persisted enabled order after an assistant is toggled. */
export const assistantOrderAfterToggle = (
  assistants: Assistant[],
  preferredOrder: readonly string[],
  assistantId: string,
  enabled: boolean
): string[] => {
  const currentOrder = selectableAssistants(assistants, preferredOrder)
    .map((assistant) => assistant.id)
    .filter((id) => id !== assistantId);

  return enabled ? [...currentOrder, assistantId] : currentOrder;
};
