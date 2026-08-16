import { ipcBridge } from '@/common';
import type { FileChangeInfo, GitRepositoryInfo, GitStatus } from '@/common/types/platform/gitWorkspace';
import { useCallback, useEffect, useRef, useState } from 'react';

type UseFileChangesParams = { workspace: string };

const EMPTY_STATUS: GitStatus = { conflicted: [], staged: [], unstaged: [] };

export function useFileChanges({ workspace }: UseFileChangesParams) {
  const [status, setStatus] = useState<GitStatus>(EMPTY_STATUS);
  const [repository, setRepository] = useState<GitRepositoryInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refreshChanges = useCallback(async () => {
    if (!workspace) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const [nextStatus, nextRepository] = await Promise.all([
        ipcBridge.git.status.invoke({ workspace }),
        ipcBridge.git.info.invoke({ workspace }),
      ]);
      if (requestId !== requestIdRef.current) return;
      setStatus(nextStatus);
      setRepository(nextRepository);
      setError(null);
    } catch (reason) {
      if (requestId !== requestIdRef.current) return;
      setError(reason instanceof Error ? reason.message : String(reason));
      throw reason;
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    if (!workspace) return;
    const requestId = ++requestIdRef.current;
    setStatus(EMPTY_STATUS);
    setRepository(null);
    setError(null);
    setLoading(true);
    ipcBridge.git.ensure
      .invoke({ workspace })
      .then(async (nextRepository) => {
        const nextStatus = await ipcBridge.git.status.invoke({ workspace });
        if (requestId !== requestIdRef.current) return;
        setRepository(nextRepository);
        setStatus(nextStatus);
      })
      .catch((reason) => {
        if (requestId !== requestIdRef.current) return;
        console.error('[useFileChanges] Failed to prepare Git workspace:', reason);
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
    return () => {
      requestIdRef.current += 1;
    };
  }, [workspace]);

  const mutate = useCallback(
    async (operation: () => Promise<unknown>) => {
      await operation();
      await refreshChanges();
    },
    [refreshChanges]
  );

  const stageFile = useCallback(
    (filePath: string) => mutate(() => ipcBridge.git.stageFile.invoke({ workspace, file_path: filePath })),
    [mutate, workspace]
  );
  const stageAll = useCallback(() => mutate(() => ipcBridge.git.stageAll.invoke({ workspace })), [mutate, workspace]);
  const unstageFile = useCallback(
    (filePath: string) => mutate(() => ipcBridge.git.unstageFile.invoke({ workspace, file_path: filePath })),
    [mutate, workspace]
  );
  const unstageAll = useCallback(
    () => mutate(() => ipcBridge.git.unstageAll.invoke({ workspace })),
    [mutate, workspace]
  );
  const discardFile = useCallback(
    (filePath: string) => mutate(() => ipcBridge.git.discardFile.invoke({ workspace, file_path: filePath })),
    [mutate, workspace]
  );

  const changeCount = status.conflicted.length + status.staged.length + status.unstaged.length;
  return {
    conflicted: status.conflicted,
    staged: status.staged,
    unstaged: status.unstaged,
    changeCount,
    loading,
    error,
    repository,
    refreshChanges,
    stageFile,
    stageAll,
    unstageFile,
    unstageAll,
    discardFile,
  } satisfies {
    conflicted: FileChangeInfo[];
    staged: FileChangeInfo[];
    unstaged: FileChangeInfo[];
    changeCount: number;
    loading: boolean;
    error: string | null;
    repository: GitRepositoryInfo | null;
    refreshChanges: () => Promise<void>;
    stageFile: (path: string) => Promise<void>;
    stageAll: () => Promise<void>;
    unstageFile: (path: string) => Promise<void>;
    unstageAll: () => Promise<void>;
    discardFile: (path: string) => Promise<void>;
  };
}
