export type GitFileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';

export type FileChangeInfo = {
  file_path: string;
  relativePath: string;
  oldRelativePath?: string;
  status: GitFileStatus;
};

export type GitStatus = {
  conflicted: FileChangeInfo[];
  staged: FileChangeInfo[];
  unstaged: FileChangeInfo[];
};

export type GitBranchInfo = {
  name: string;
  current: boolean;
  checkedOut: boolean;
  commit: string;
};

export type GitWorktreeInfo = {
  path: string;
  branch: string | null;
  head: string;
  current: boolean;
  locked: boolean;
};

export type GitRepositoryInfo = {
  repositoryRoot: string;
  workspacePath: string;
  workspaceRelativePath: string;
  branch: string;
  headCommit: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  dirty: boolean;
  branches: GitBranchInfo[];
  worktrees: GitWorktreeInfo[];
  remotes: string[];
};

export type GitCommitInfo = {
  hash: string;
  shortHash: string;
  parents: string[];
  decorations: string[];
  author: string;
  authoredAt: number;
  subject: string;
};

export type GitCommitFileInfo = {
  path: string;
  oldPath?: string;
  status: GitFileStatus;
};

export type GitRevision = {
  revision: string;
  filePath: string;
  originalRevision: string | null;
  originalContent: string | null;
  modifiedContent: string | null;
  patch: string;
  binary: boolean;
};
