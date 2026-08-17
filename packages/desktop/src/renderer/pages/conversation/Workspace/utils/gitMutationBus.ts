type GitMutationListener = () => void | Promise<void>;

const listeners = new Map<string, Set<GitMutationListener>>();

/** 订阅指定工作区的 Git 变更完成事件。 */
export function subscribeWorkspaceGitMutation(workspace: string, listener: GitMutationListener): () => void {
  const workspaceListeners = listeners.get(workspace) ?? new Set<GitMutationListener>();
  workspaceListeners.add(listener);
  listeners.set(workspace, workspaceListeners);

  return () => {
    workspaceListeners.delete(listener);
    if (workspaceListeners.size === 0) listeners.delete(workspace);
  };
}

/**
 * 通知并等待工作区的全部 Git 表面刷新完成。
 *
 * 所有 Git 写操作只走这一条提交后管线，避免文件状态、提交图和编辑器各自刷新。
 */
export async function notifyWorkspaceGitMutation(workspace: string): Promise<void> {
  const workspaceListeners = [...(listeners.get(workspace) ?? [])];
  const results = await Promise.allSettled(workspaceListeners.map((listener) => listener()));
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (rejected) throw rejected.reason;
}
