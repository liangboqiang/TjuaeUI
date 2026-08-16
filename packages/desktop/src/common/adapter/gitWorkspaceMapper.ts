import type {
  FileChangeInfo,
  GitBranchInfo,
  GitCommitInfo,
  GitCommitFileInfo,
  GitFileStatus,
  GitRepositoryInfo,
  GitRevision,
  GitStatus,
  GitWorktreeInfo,
} from '@/common/types/platform/gitWorkspace';

export type RawFileChange = {
  file_path: string;
  relative_path: string;
  old_relative_path?: string;
  status: GitFileStatus;
};

export type RawGitBranch = {
  name: string;
  current: boolean;
  checked_out: boolean;
  commit: string;
};

export type RawGitWorktree = {
  path: string;
  branch: string | null;
  head: string;
  current: boolean;
  locked: boolean;
};

export type RawGitStatus = {
  conflicted: RawFileChange[];
  staged: RawFileChange[];
  unstaged: RawFileChange[];
};

export type RawGitRepository = {
  repository_root: string;
  workspace_path: string;
  workspace_relative_path: string;
  branch: string;
  head_commit: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  dirty: boolean;
  branches: RawGitBranch[];
  worktrees: RawGitWorktree[];
  remotes: string[];
};

export type RawGitCommit = {
  hash: string;
  short_hash: string;
  parents: string[];
  decorations: string[];
  author: string;
  authored_at: number;
  subject: string;
};

export type RawGitCommitFile = {
  path: string;
  old_path?: string;
  status: GitFileStatus;
};

export type RawGitRevision = {
  revision: string;
  file_path: string;
  original_revision: string | null;
  original_content: string | null;
  modified_content: string | null;
  patch: string;
  binary: boolean;
};

const mapFileChange = (change: RawFileChange): FileChangeInfo => ({
  file_path: change.file_path,
  relativePath: change.relative_path,
  oldRelativePath: change.old_relative_path,
  status: change.status,
});

const mapBranch = (branch: RawGitBranch): GitBranchInfo => ({
  name: branch.name,
  current: branch.current,
  checkedOut: branch.checked_out,
  commit: branch.commit,
});

const mapWorktree = (worktree: RawGitWorktree): GitWorktreeInfo => ({
  path: worktree.path,
  branch: worktree.branch,
  head: worktree.head,
  current: worktree.current,
  locked: worktree.locked,
});

export const fromBackendGitStatus = (raw: RawGitStatus): GitStatus => ({
  conflicted: (raw?.conflicted ?? []).map(mapFileChange),
  staged: (raw?.staged ?? []).map(mapFileChange),
  unstaged: (raw?.unstaged ?? []).map(mapFileChange),
});

export const fromBackendGitRepository = (raw: RawGitRepository): GitRepositoryInfo => ({
  repositoryRoot: raw.repository_root,
  workspacePath: raw.workspace_path,
  workspaceRelativePath: raw.workspace_relative_path,
  branch: raw.branch,
  headCommit: raw.head_commit,
  upstream: raw.upstream,
  ahead: raw.ahead,
  behind: raw.behind,
  dirty: raw.dirty,
  branches: (raw.branches ?? []).map(mapBranch),
  worktrees: (raw.worktrees ?? []).map(mapWorktree),
  remotes: raw.remotes ?? [],
});

export const fromBackendGitCommit = (raw: RawGitCommit): GitCommitInfo => ({
  hash: raw.hash,
  shortHash: raw.short_hash,
  parents: raw.parents ?? [],
  decorations: raw.decorations ?? [],
  author: raw.author,
  authoredAt: raw.authored_at,
  subject: raw.subject,
});

export const fromBackendGitCommitFile = (raw: RawGitCommitFile): GitCommitFileInfo => ({
  path: raw.path,
  oldPath: raw.old_path,
  status: raw.status,
});

export const fromBackendGitRevision = (raw: RawGitRevision): GitRevision => ({
  revision: raw.revision,
  filePath: raw.file_path,
  originalRevision: raw.original_revision,
  originalContent: raw.original_content,
  modifiedContent: raw.modified_content,
  patch: raw.patch,
  binary: raw.binary,
});
