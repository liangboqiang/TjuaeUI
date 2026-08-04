/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AssetSummary } from '@/common/types/agent/assets';
import { assetApi } from '@/renderer/pages/settings/Assets/LocalAssetPage/assetApi';
import { globalNavigate } from '@/renderer/utils/navigation';
import { Message } from '@arco-design/web-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/** TjuaeUI 管家在 Core 本地资产库中的稳定资产 ID。 */
const BUTLER_ASSISTANT_ID = 'tjuaeui-assistant';

export type TalkToButlerArgs = {
  /** 预填到首页对话输入框中的提示词。 */
  prompt: string;
  /** 可选的预附加文件路径，例如诊断报告截图。 */
  files?: string[];
};

/** 只按稳定资产 ID 解析本地管家副本，不猜测旧版别名。 */
const findButler = (assets: AssetSummary[]): AssetSummary | undefined =>
  assets.find((asset) => asset.id === BUTLER_ASSISTANT_ID);

const createIdempotencyKey = (): string => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

/**
 * 所有“通过对话处理”入口共用的跳转逻辑：解析 Core 本地管家资产，
 * 必要时通过资产生命周期激活，然后跳转首页并预填提示词与附件。
 *
 * 资产缺失、不可激活或 Core 暂时不可用时不会阻塞用户，仍跳转到首页，
 * 但不固定助手；这里不创建官方资产副本，也不回写旧助手表。
 */
export const useTalkToButler = (): ((args: TalkToButlerArgs) => Promise<void>) => {
  const { t } = useTranslation();

  return useCallback(
    async ({ prompt, files }: TalkToButlerArgs) => {
      let selectedAssistantId: string | undefined;

      try {
        const butler = findButler(await assetApi.list.invoke({ kind: 'assistant' }));
        if (butler?.runtimeState === 'active') {
          selectedAssistantId = butler.id;
        } else if (butler?.allowedActions.includes('activate')) {
          const status = await assetApi.activate.invoke({
            assetId: butler.id,
            idempotencyKey: createIdempotencyKey(),
            expectedDefinitionDigest: butler.definitionDigest,
          });
          if (status.runtimeBinding) {
            selectedAssistantId = butler.id;
            Message.success(t('settings.talkToButler.enabledToast'));
          }
        }
      } catch (error) {
        // 非致命失败：保留预填内容并继续进入首页，不固定助手。
        console.error('[talkToButler] failed to resolve or activate the Butler asset:', error);
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
