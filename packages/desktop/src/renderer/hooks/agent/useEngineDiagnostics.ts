/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { AgentDiagnosticRun, AgentSnapshotCheckKind, ManagedEngine } from '@/renderer/utils/model/agentTypes';
import { useCallback, useEffect, useState } from 'react';
import { mutate } from 'swr';
import { MANAGED_ENGINES_SWR_KEY } from '@/renderer/utils/model/agentTypes';
import { refreshManagedEngineCatalogAndAssistants } from './useManagedEngines';

let startupDiagnosticsRequested = false;
let diagnosticsCacheObserverInstalled = false;

const newestDiagnosticRun = (current: AgentDiagnosticRun | null, incoming: AgentDiagnosticRun): AgentDiagnosticRun => {
  if (!current || current.run_id !== incoming.run_id) return incoming;
  if (current.state === 'completed' || current.completed > incoming.completed) return current;
  return incoming;
};

/**
 * Keep the persisted Agent/model catalog SWR views synchronized even when the
 * settings page is not mounted. Startup diagnostics run at app scope, so their
 * completion observer must live at the same scope.
 */
function ensureDiagnosticsCacheObserver(): void {
  if (diagnosticsCacheObserverInstalled) return;
  diagnosticsCacheObserverInstalled = true;
  ipcBridge.acpConversation.diagnosticsChanged.on((payload) => {
    const updatedAgent = payload.agent;
    if (updatedAgent) {
      void mutate<ManagedEngine[]>(
        MANAGED_ENGINES_SWR_KEY,
        (current) => current?.map((agent) => (agent.id === updatedAgent.id ? updatedAgent : agent)),
        { revalidate: false }
      );
    }
    if (payload.run.state === 'completed') {
      void refreshManagedEngineCatalogAndAssistants();
    }
  });
}

/** 每个渲染进程只触发一次启动诊断；后端还会对正在运行的批次做幂等合并。 */
export function ensureStartupEngineDiagnostics(): void {
  if (startupDiagnosticsRequested) return;
  startupDiagnosticsRequested = true;
  ensureDiagnosticsCacheObserver();
  void ipcBridge.acpConversation.startEngineDiagnostics
    .invoke({ trigger: 'startup' })
    .catch((error: unknown) => console.error('Failed to start Agent startup diagnostics:', error));
}

export type UseEngineDiagnosticsResult = {
  run: AgentDiagnosticRun | null;
  isRunning: boolean;
  start: (trigger?: AgentSnapshotCheckKind, agentIds?: string[]) => Promise<AgentDiagnosticRun>;
};

/** 管理页的批量诊断进度与目录缓存刷新入口。 */
export function useEngineDiagnostics(): UseEngineDiagnosticsResult {
  const [run, setRun] = useState<AgentDiagnosticRun | null>(null);

  useEffect(() => {
    ensureDiagnosticsCacheObserver();
    let active = true;
    void ipcBridge.acpConversation.getCurrentEngineDiagnostics
      .invoke()
      .then((snapshot) => {
        if (active && snapshot) setRun((current) => newestDiagnosticRun(current, snapshot));
      })
      .catch((error: unknown) => console.error('Failed to load Agent diagnostic progress:', error));

    const unsubscribe = ipcBridge.acpConversation.diagnosticsChanged.on((payload) => {
      if (!active) return;
      setRun((current) => newestDiagnosticRun(current, payload.run));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const start = useCallback(async (trigger: AgentSnapshotCheckKind = 'manual', agentIds?: string[]) => {
    const nextRun = await ipcBridge.acpConversation.startEngineDiagnostics.invoke({
      trigger,
      agent_ids: agentIds,
    });
    setRun((current) => newestDiagnosticRun(current, nextRun));
    return nextRun;
  }, []);

  return {
    run,
    isRunning: run?.state === 'running',
    start,
  };
}
