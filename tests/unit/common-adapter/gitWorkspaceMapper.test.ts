import {
  fromBackendGitCommit,
  fromBackendGitRepository,
  fromBackendGitStatus,
  type RawGitCommit,
  type RawGitRepository,
  type RawGitStatus,
} from '@/common/adapter/gitWorkspaceMapper';
import { describe, expect, it } from 'vitest';

describe('gitWorkspaceMapper', () => {
  it('maps status paths and keeps conflict, rename, staged and unstaged groups distinct', () => {
    const raw: RawGitStatus = {
      conflicted: [{ file_path: '/ws/conflict.txt', relative_path: 'conflict.txt', status: 'conflicted' }],
      staged: [{ file_path: '/ws/new.txt', relative_path: 'new.txt', status: 'added' }],
      unstaged: [
        {
          file_path: '/ws/new-name.md',
          relative_path: 'new-name.md',
          old_relative_path: 'old-name.md',
          status: 'renamed',
        },
      ],
    };

    expect(fromBackendGitStatus(raw)).toEqual({
      conflicted: [
        {
          file_path: '/ws/conflict.txt',
          relativePath: 'conflict.txt',
          oldRelativePath: undefined,
          status: 'conflicted',
        },
      ],
      staged: [{ file_path: '/ws/new.txt', relativePath: 'new.txt', oldRelativePath: undefined, status: 'added' }],
      unstaged: [
        {
          file_path: '/ws/new-name.md',
          relativePath: 'new-name.md',
          oldRelativePath: 'old-name.md',
          status: 'renamed',
        },
      ],
    });
  });

  it('maps repository branches, worktrees and upstream state', () => {
    const raw: RawGitRepository = {
      repository_root: '/repo',
      workspace_path: '/repo/apps/ui',
      workspace_relative_path: 'apps/ui',
      branch: 'main',
      head_commit: 'abcdef',
      upstream: 'origin/main',
      ahead: 1,
      behind: 2,
      dirty: true,
      branches: [{ name: 'main', current: true, checked_out: true, commit: 'abcdef' }],
      worktrees: [{ path: '/repo', branch: 'main', head: 'abcdef', current: true, locked: false }],
      remotes: ['origin'],
    };

    expect(fromBackendGitRepository(raw)).toMatchObject({
      repositoryRoot: '/repo',
      workspaceRelativePath: 'apps/ui',
      branch: 'main',
      upstream: 'origin/main',
      ahead: 1,
      behind: 2,
      branches: [{ name: 'main', current: true, checkedOut: true, commit: 'abcdef' }],
      worktrees: [{ path: '/repo', branch: 'main', head: 'abcdef', current: true, locked: false }],
    });
  });

  it('maps commit parents and decorations for graph topology', () => {
    const raw: RawGitCommit = {
      hash: 'abc',
      short_hash: 'abc',
      parents: ['p1', 'p2'],
      decorations: ['main'],
      author: 'Tjuae',
      authored_at: 42,
      subject: 'merge',
    };

    expect(fromBackendGitCommit(raw)).toMatchObject({
      shortHash: 'abc',
      parents: ['p1', 'p2'],
      decorations: ['main'],
      authoredAt: 42,
    });
  });
});
