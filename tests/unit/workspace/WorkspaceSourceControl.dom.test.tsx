// @vitest-environment jsdom

import type { GitRepositoryInfo } from '@/common/types/platform/gitWorkspace';
import WorkspaceSourceControl from '@/renderer/pages/conversation/Workspace/components/WorkspaceSourceControl';
import { cleanup, render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/renderer/hooks/assistant/invokeButlerWorkspaceAction', () => ({
  invokeButlerWorkspaceAction: vi.fn(),
}));

const t = ((key: string) => key) as TFunction;
const resolved = vi.fn(async () => undefined);
const repository: GitRepositoryInfo = {
  repositoryRoot: 'C:\\workspace',
  workspacePath: 'C:\\workspace',
  workspaceRelativePath: '',
  branch: 'main',
  headCommit: '0123456789abcdef',
  upstream: null,
  ahead: 0,
  behind: 0,
  dirty: false,
  branches: [{ name: 'main', current: true, checkedOut: true, commit: '0123456789abcdef' }],
  worktrees: [],
  remotes: [],
};

const renderSourceControl = () =>
  render(
    <WorkspaceSourceControl
      t={t}
      workspace='C:\workspace'
      displayName='workspace'
      repository={repository}
      repositoryLoading={false}
      graph={[]}
      graphLoading={false}
      graphReference='main'
      conflicted={[]}
      staged={[]}
      unstaged={[]}
      changesLoading={false}
      onRefresh={resolved}
      onRefreshGraph={resolved}
      onSelectGraphReference={resolved}
      onFollowCurrentGraphBranch={resolved}
      onLoadCommitFiles={vi.fn(async () => [])}
      onOpenCommitFile={resolved}
      onCheckoutCommit={resolved}
      onOpenDiff={vi.fn()}
      onStageFile={resolved}
      onStageAll={resolved}
      onUnstageFile={resolved}
      onUnstageAll={resolved}
      onDiscardFile={resolved}
      onCreateBranch={resolved}
      onSwitchBranch={resolved}
      onCommit={resolved}
      onFetch={resolved}
      onPull={resolved}
      onPush={resolved}
      onSync={resolved}
    />
  );

describe('WorkspaceSourceControl', () => {
  afterEach(cleanup);

  it('hides remote operations for a local-only repository and exposes Butler actions', () => {
    renderSourceControl();

    expect(screen.queryByLabelText('conversation.workspace.git.fetch')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('conversation.workspace.git.pull')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('conversation.workspace.git.push')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('conversation.workspace.git.sync')).not.toBeInTheDocument();
    expect(screen.getByLabelText('conversation.workspace.git.aiReview')).toBeInTheDocument();
    expect(screen.getByLabelText('conversation.workspace.git.generateCommitMessage')).toBeInTheDocument();
    expect(screen.queryByText('conversation.workspace.git.worktreeGraph')).not.toBeInTheDocument();
  });
});
