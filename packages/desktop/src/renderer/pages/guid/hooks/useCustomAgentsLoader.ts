/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import { useEffect } from 'react';
import useSWR, { mutate as swrMutate } from 'swr';

type UseCustomAgentsLoaderResult = {
  /**
   * Local assistant catalog returned by TjuaeCore. It contains generated
   * engine assistants and user-created assistants in backend-defined order.
   * Market assets become local `user` assistants only after installation.
   */
  assistants: Assistant[];
};

/**
 * Loads the assistant catalog consumed by Guid. Phase 2 removes `/api/agents`
 * as a user-facing candidate source, so this hook intentionally exposes only
 * the assistant list shared with settings/conversation flows.
 */
export const useCustomAgentsLoader = (): UseCustomAgentsLoaderResult => {
  // Local assistants share their own cache so settings / guid / conversation
  // all see the same list without duplicate HTTP calls.
  const { data: assistantList } = useSWR('assistants.list', async () => {
    try {
      return await ipcBridge.assistants.list.invoke();
    } catch (error) {
      console.error('Failed to load assistants:', error);
      return [] as Assistant[];
    }
  });
  const assistants = assistantList ?? [];

  useEffect(() => {
    void swrMutate('assistants.list');
  }, []);

  return {
    assistants,
  };
};
