import { ipcBridge } from '@/common';
import type {
  GitCommitFileInfo,
  GitCommitInfo,
  GitRepositoryInfo,
  GitRevision,
} from '@/common/types/platform/gitWorkspace';
import { useCallback, useEffect, useRef, useState } from 'react';
import { notifyWorkspaceGitMutation, subscribeWorkspaceGitMutation } from '../utils/gitMutationBus';

export function useGitWorkspace(workspace: string, filePath?: string) {
  const [repository, setRepository] = useState<GitRepositoryInfo | null>(null);
  const [timeline, setTimeline] = useState<GitCommitInfo[]>([]);
  const [graph, setGraph] = useState<GitCommitInfo[]>([]);
  const [graphReference, setGraphReference] = useState<string | null>(null);
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);
  const repositoryRequestRef = useRef(0);
  const timelineRequestRef = useRef(0);
  const graphRequestRef = useRef(0);

  const refreshRepository = useCallback(async () => {
    if (!workspace) return null;
    const request = ++repositoryRequestRef.current;
    setRepositoryLoading(true);
    try {
      const next = await ipcBridge.git.ensure.invoke({ workspace });
      if (request === repositoryRequestRef.current) {
        setRepository(next);
        setGraphReference((current) => current ?? next.branch);
      }
      return next;
    } finally {
      if (request === repositoryRequestRef.current) setRepositoryLoading(false);
    }
  }, [workspace]);

  const refreshTimeline = useCallback(async () => {
    if (!workspace || !filePath) {
      timelineRequestRef.current += 1;
      setTimeline([]);
      setTimelineLoading(false);
      return [];
    }
    const request = ++timelineRequestRef.current;
    setTimelineLoading(true);
    try {
      const next = await ipcBridge.git.history.invoke({ workspace, file_path: filePath, limit: 100 });
      if (request === timelineRequestRef.current) setTimeline(next);
      return next;
    } finally {
      if (request === timelineRequestRef.current) setTimelineLoading(false);
    }
  }, [filePath, workspace]);

  const refreshGraph = useCallback(
    async (reference = graphReference ?? undefined) => {
      if (!workspace) return [];
      const request = ++graphRequestRef.current;
      setGraphLoading(true);
      try {
        const next = await ipcBridge.git.history.invoke({ workspace, reference, limit: 150 });
        if (request === graphRequestRef.current) setGraph(next);
        return next;
      } finally {
        if (request === graphRequestRef.current) setGraphLoading(false);
      }
    },
    [graphReference, workspace]
  );

  useEffect(() => {
    setRepository(null);
    setGraph([]);
    void refreshRepository().catch((error) => {
      console.error('[useGitWorkspace] Failed to read repository:', error);
    });
  }, [refreshRepository]);

  useEffect(() => {
    void refreshTimeline().catch((error) => {
      console.error('[useGitWorkspace] Failed to read file timeline:', error);
    });
  }, [refreshTimeline]);

  useEffect(
    () =>
      subscribeWorkspaceGitMutation(workspace, async () => {
        await Promise.all([refreshRepository(), refreshTimeline(), refreshGraph()]);
      }),
    [refreshGraph, refreshRepository, refreshTimeline, workspace]
  );

  const revision = useCallback(
    (revisionHash: string, targetFilePath = filePath): Promise<GitRevision> => {
      if (!targetFilePath) return Promise.reject(new Error('请先选择一个文件'));
      return ipcBridge.git.revision.invoke({ workspace, file_path: targetFilePath, revision: revisionHash });
    },
    [filePath, workspace]
  );

  const mutate = useCallback(
    async (operation: () => Promise<unknown>) => {
      await operation();
      await notifyWorkspaceGitMutation(workspace);
    },
    [workspace]
  );

  return {
    repository,
    timeline,
    graph,
    graphReference,
    repositoryLoading,
    timelineLoading,
    graphLoading,
    refreshRepository,
    refreshTimeline,
    refreshGraph,
    selectGraphReference: async (reference: string) => {
      setGraphReference(reference);
      const next = await ipcBridge.git.history.invoke({ workspace, reference, limit: 150 });
      setGraph(next);
      return next;
    },
    followCurrentGraphBranch: async () => {
      const current = repository?.branch ?? 'main';
      setGraphReference(current);
      const next = await ipcBridge.git.history.invoke({ workspace, reference: current, limit: 150 });
      setGraph(next);
      return next;
    },
    commitFiles: (revisionHash: string): Promise<GitCommitFileInfo[]> =>
      ipcBridge.git.commitFiles.invoke({ workspace, revision: revisionHash }),
    revision,
    createBranch: (name: string, startPoint?: string) =>
      mutate(() => ipcBridge.git.createBranch.invoke({ workspace, name, start_point: startPoint })),
    switchBranch: (name: string) => mutate(() => ipcBridge.git.switchBranch.invoke({ workspace, name })),
    checkoutRevision: (revisionHash: string) =>
      mutate(() => ipcBridge.git.checkoutRevision.invoke({ workspace, revision: revisionHash })),
    commit: (message: string, includeUnstaged = false) =>
      mutate(() => ipcBridge.git.commit.invoke({ workspace, message, include_unstaged: includeUnstaged })),
    fetch: () => mutate(() => ipcBridge.git.fetch.invoke({ workspace })),
    pull: () => mutate(() => ipcBridge.git.pull.invoke({ workspace })),
    push: () => mutate(() => ipcBridge.git.push.invoke({ workspace })),
    sync: () => mutate(() => ipcBridge.git.sync.invoke({ workspace })),
  };
}
