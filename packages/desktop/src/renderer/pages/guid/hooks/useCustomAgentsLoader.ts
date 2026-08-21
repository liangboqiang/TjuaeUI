import { ipcBridge } from '@/common';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import { useEffect } from 'react';
import useSWR, { mutate as swrMutate } from 'swr';

type UseCustomAgentsLoaderResult = {
  /**
   * Preset assistant catalog returned by the backend — merged builtin + user +
   * extension, already sorted. This is the list the Guid pill bar and the
   * Settings list render.
   */
  assistants: Assistant[];
};

/**
 * Loads the assistant catalog consumed by Guid. Phase 2 removes `/api/agents`
 * as a user-facing candidate source, so this hook intentionally exposes only
 * the assistant list shared with settings/conversation flows.
 */
export const useCustomAgentsLoader = (): UseCustomAgentsLoaderResult => {
  // Preset assistants share their own cache so settings / guid / conversation
  // all see the same list without duplicate HTTP calls.
  const { data: assistantList } = useSWR('assistants.listSelectable', () =>
    ipcBridge.assistants.listSelectable.invoke()
  );
  const assistants = assistantList ?? [];

  useEffect(() => {
    void swrMutate('assistants.listSelectable');
  }, []);

  return {
    assistants,
  };
};
