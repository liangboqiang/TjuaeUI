import { ipcBridge } from '@/common';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import { globalNavigate } from '@/renderer/utils/navigation';
import { Message } from '@arco-design/web-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/** Backend manifest id of the built-in TjuaeUI Butler assistant. */
const BUTLER_ASSISTANT_ID = 'tjuaeui-assistant';

export type TalkToButlerArgs = {
  /** Prompt pre-filled into the home chat input. */
  prompt: string;
  /** Optional file paths pre-attached to the input (e.g. report screenshots). */
  files?: string[];
};

/**
 * Resolve the Butler assistant from the catalog, tolerating the `builtin-`
 * prefix the frontend sometimes carries on built-in ids.
 */
const findButler = (assistants: Assistant[]): Assistant | undefined => {
  return assistants.find((assistant) => assistant.id.endsWith(`:${BUTLER_ASSISTANT_ID}`));
};

/**
 * Shared entry point behind every "via chat" action: jump to the home page,
 * select the TjuaeUI Butler, and pre-fill the chat input with a ready-made
 * prompt (and optional attachments). The Butler is a local system assistant;
 * when its runtime resources need attention, open that canonical local entry.
 *
 * Reuses the home page's `prefillPrompt` navigation contract (added with the
 * scheduled-tasks "create via chat" entry) and extends it with `prefillFiles`.
 * Uses `globalNavigate` rather than `useNavigate` so it is safe to call from
 * components mounted outside the Router.
 */
export const useTalkToButler = (): ((args: TalkToButlerArgs) => Promise<void>) => {
  const { t } = useTranslation();

  return useCallback(
    async ({ prompt, files }: TalkToButlerArgs) => {
      let selectedAssistantId: string | undefined;

      try {
        const assistants = await ipcBridge.assistants.listSelectable.invoke();
        const butler = findButler(assistants);
        if (butler) {
          selectedAssistantId = butler.id;
        } else {
          Message.warning(
            t('settings.talkToButler.activationRequired', {
              defaultValue: 'Please enable the TjuaeUI Butler and confirm its required resources first.',
            })
          );
          globalNavigate('/settings/assistants/mine/~/tjuaeui-assistant');
          return;
        }
      } catch (error) {
        console.error('[talkToButler] failed to resolve butler:', error);
        Message.error(t('settings.talkToButler.resolveFailed', { defaultValue: 'Unable to load the TjuaeUI Butler.' }));
        return;
      }

      globalNavigate('/guid', {
        state: {
          selectedAssistantId,
          prefillPrompt: prompt,
          prefillFiles: files,
        },
      });
    },
    [t]
  );
};

export default useTalkToButler;
