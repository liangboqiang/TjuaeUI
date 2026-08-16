import type {
  FileChangeInfo,
  GitCommitFileInfo,
  GitCommitInfo,
  GitRepositoryInfo,
} from '@/common/types/platform/gitWorkspace';
import { invokeButlerWorkspaceAction } from '@/renderer/hooks/assistant/invokeButlerWorkspaceAction';
import { Button, Empty, Input, Message, Modal, Select, Spin, Tooltip } from '@arco-design/web-react';
import { Audit, Branch, DownloadOne, Magic, Plus, Refresh, SourceCode, Sync, UploadOne } from '@icon-park/react';
import type { TFunction } from 'i18next';
import React, { useMemo, useState } from 'react';
import FileChangeList from './FileChangeList';
import GitCommitGraph from './GitCommitGraph';
import { showGitError } from '../utils/gitError';

type Props = {
  t: TFunction;
  workspace: string;
  displayName: string;
  repository: GitRepositoryInfo | null;
  repositoryLoading: boolean;
  graph: GitCommitInfo[];
  graphLoading: boolean;
  graphReference: string | null;
  conflicted: FileChangeInfo[];
  staged: FileChangeInfo[];
  unstaged: FileChangeInfo[];
  changesLoading: boolean;
  onRefresh: () => Promise<unknown>;
  onRefreshGraph: () => Promise<unknown>;
  onSelectGraphReference: (reference: string) => Promise<unknown>;
  onFollowCurrentGraphBranch: () => Promise<unknown>;
  onLoadCommitFiles: (commit: GitCommitInfo) => Promise<GitCommitFileInfo[]>;
  onOpenCommitFile: (commit: GitCommitInfo, file: GitCommitFileInfo) => Promise<void>;
  onCheckoutCommit: (commit: GitCommitInfo) => Promise<unknown>;
  onOpenDiff: (diffContent: string, fileName: string, filePath: string) => void;
  onStageFile: (path: string) => Promise<void>;
  onStageAll: () => Promise<void>;
  onUnstageFile: (path: string) => Promise<void>;
  onUnstageAll: () => Promise<void>;
  onDiscardFile: (path: string) => Promise<void>;
  onCreateBranch: (name: string, startPoint?: string) => Promise<void>;
  onSwitchBranch: (name: string) => Promise<void>;
  onCommit: (message: string) => Promise<unknown>;
  onFetch: () => Promise<unknown>;
  onPull: () => Promise<unknown>;
  onPush: () => Promise<unknown>;
  onSync: () => Promise<unknown>;
};

const IconAction: React.FC<{
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}> = ({ label, icon, disabled, loading, onClick }) => (
  <Tooltip mini content={label}>
    <Button
      type='text'
      size='mini'
      className='!h-24px !w-24px !p-0'
      aria-label={label}
      disabled={disabled}
      loading={loading}
      icon={icon}
      onClick={onClick}
    />
  </Tooltip>
);

const WorkspaceSourceControl: React.FC<Props> = ({
  t,
  workspace,
  displayName,
  repository,
  repositoryLoading,
  graph,
  graphLoading,
  graphReference,
  conflicted,
  staged,
  unstaged,
  changesLoading,
  onRefresh,
  onRefreshGraph,
  onSelectGraphReference,
  onFollowCurrentGraphBranch,
  onLoadCommitFiles,
  onOpenCommitFile,
  onCheckoutCommit,
  onOpenDiff,
  onStageFile,
  onStageAll,
  onUnstageFile,
  onUnstageAll,
  onDiscardFile,
  onCreateBranch,
  onSwitchBranch,
  onCommit,
  onFetch,
  onPull,
  onPush,
  onSync,
}) => {
  const [pending, setPending] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [branchModal, setBranchModal] = useState(false);
  const [newBranch, setNewBranch] = useState('');
  const [branchStartPoint, setBranchStartPoint] = useState<string | undefined>();

  const run = async (key: string, operation: () => Promise<unknown>, success?: string): Promise<boolean> => {
    if (pending) return false;
    setPending(key);
    try {
      await operation();
      if (success) Message.success(success);
      return true;
    } catch (error) {
      console.error('[WorkspaceSourceControl] Git operation failed:', error);
      showGitError(t, error);
      return false;
    } finally {
      setPending(null);
    }
  };

  const branches = repository?.branches ?? [];
  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        label: branch.name,
        value: branch.name,
        disabled: branch.checkedOut && !branch.current,
      })),
    [branches]
  );
  const graphBranchOptions = useMemo(
    () => branches.map((branch) => ({ label: branch.name, value: branch.name })),
    [branches]
  );
  const canCommit = staged.length > 0 && conflicted.length === 0 && commitMessage.trim().length > 0;
  const hasRemote = (repository?.remotes.length ?? 0) > 0;
  const allChanges = [...conflicted, ...staged, ...unstaged];

  const generateCommitMessage = async () => {
    if (pending || staged.length === 0) return;
    setPending('ai-commit');
    try {
      const response = await invokeButlerWorkspaceAction(
        workspace,
        [
          '你是 TjuaeUI 管家。请只读检查当前工作区已经暂存的 Git 更改，为它生成一条简洁、准确的提交说明。',
          `已暂存文件：${staged.map((file) => file.relativePath).join('、')}`,
          '不要修改文件，不要提交。只输出一行，格式必须是 <COMMIT_MESSAGE>提交说明</COMMIT_MESSAGE>。',
        ].join('\n')
      );
      const tagged = response.match(/<COMMIT_MESSAGE>([\s\S]*?)<\/COMMIT_MESSAGE>/i)?.[1]?.trim();
      const message = (tagged || response.split(/\r?\n/).find((line) => line.trim()) || '').trim();
      if (!message) throw new Error('BUTLER_ACTION_EMPTY');
      setCommitMessage(message);
    } catch (error) {
      console.error('[WorkspaceSourceControl] Butler commit-message generation failed:', error);
      Message.error(t('conversation.workspace.git.butlerActionFailed'));
    } finally {
      setPending(null);
    }
  };

  const reviewChanges = async () => {
    if (pending || allChanges.length === 0) return;
    setPending('ai-review');
    try {
      const response = await invokeButlerWorkspaceAction(
        workspace,
        [
          '你是 TjuaeUI 管家。请只读审查当前工作区的 Git 更改。',
          `涉及文件：${allChanges.map((file) => file.relativePath).join('、')}`,
          '请用简洁的 Markdown 给出：总体结论、需要关注的问题、建议；若没有问题请明确说明。不要修改文件。',
        ].join('\n')
      );
      Modal.info({
        title: t('conversation.workspace.git.aiReviewTitle'),
        content: (
          <div className='max-h-55vh overflow-y-auto whitespace-pre-wrap text-13px leading-21px'>{response}</div>
        ),
        okText: t('common.confirm'),
        style: { width: 620 },
      });
    } catch (error) {
      console.error('[WorkspaceSourceControl] Butler review failed:', error);
      Message.error(t('conversation.workspace.git.butlerActionFailed'));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className='flex size-full min-h-0 flex-col bg-1' data-testid='workspace-source-control'>
      <div className='flex h-34px shrink-0 items-center border-b border-border-2 px-8px'>
        <SourceCode size={13} className='mr-6px text-t-secondary' />
        <Tooltip mini content={repository?.repositoryRoot || workspace}>
          <span className='min-w-0 flex-1 truncate text-11px font-600'>{displayName}</span>
        </Tooltip>
        <Select
          size='mini'
          showSearch
          value={repository?.branch}
          options={branchOptions}
          className='!w-112px'
          prefix={<Branch size={11} />}
          disabled={!repository || Boolean(pending)}
          onChange={(value) => void run('switch', () => onSwitchBranch(String(value)))}
        />
        <IconAction
          label={t('conversation.workspace.git.createBranch')}
          icon={<Plus size={12} />}
          disabled={!repository}
          onClick={() => {
            setBranchStartPoint(undefined);
            setBranchModal(true);
          }}
        />
        <IconAction
          label={t('conversation.workspace.git.aiReview')}
          icon={<Audit size={12} />}
          disabled={!repository || allChanges.length === 0 || Boolean(pending)}
          loading={pending === 'ai-review'}
          onClick={() => void reviewChanges()}
        />
        {hasRemote ? (
          <>
            <IconAction
              label={t('conversation.workspace.git.fetch')}
              icon={<DownloadOne size={12} />}
              loading={pending === 'fetch'}
              onClick={() => void run('fetch', onFetch)}
            />
            <IconAction
              label={t('conversation.workspace.git.pull')}
              icon={<DownloadOne size={12} />}
              disabled={!repository?.upstream}
              loading={pending === 'pull'}
              onClick={() => void run('pull', onPull)}
            />
            <IconAction
              label={t('conversation.workspace.git.push')}
              icon={<UploadOne size={12} />}
              disabled={!repository?.upstream}
              loading={pending === 'push'}
              onClick={() => void run('push', onPush)}
            />
            <IconAction
              label={t('conversation.workspace.git.sync')}
              icon={<Sync size={12} />}
              disabled={!repository?.upstream}
              loading={pending === 'sync'}
              onClick={() => void run('sync', onSync)}
            />
          </>
        ) : null}
        <IconAction
          label={t('common.refresh')}
          icon={<Refresh size={12} />}
          loading={repositoryLoading || pending === 'refresh'}
          onClick={() => void run('refresh', onRefresh)}
        />
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        {!repository && repositoryLoading ? (
          <div className='flex h-100px items-center justify-center'>
            <Spin size={16} />
          </div>
        ) : !repository ? (
          <Empty className='!py-24px' description={t('conversation.workspace.git.repositoryUnavailable')} />
        ) : (
          <>
            <section className='border-b border-border-2 p-8px'>
              <div className='relative'>
                <Input.TextArea
                  value={commitMessage}
                  autoSize={{ minRows: 1, maxRows: 3 }}
                  maxLength={10_000}
                  className='!pr-30px'
                  placeholder={t('conversation.workspace.git.commitPlaceholder')}
                  onChange={setCommitMessage}
                />
                <div className='absolute right-3px top-3px'>
                  <IconAction
                    label={t('conversation.workspace.git.generateCommitMessage')}
                    icon={<Magic size={13} />}
                    disabled={staged.length === 0 || Boolean(pending)}
                    loading={pending === 'ai-commit'}
                    onClick={() => void generateCommitMessage()}
                  />
                </div>
              </div>
              <Button
                type='primary'
                long
                size='mini'
                className='!mt-6px'
                disabled={!canCommit}
                loading={pending === 'commit'}
                onClick={() => {
                  void run(
                    'commit',
                    () => onCommit(commitMessage.trim()),
                    t('conversation.workspace.git.commitSucceeded')
                  ).then((completed) => {
                    if (completed) setCommitMessage('');
                  });
                }}
              >
                {t('conversation.workspace.git.commitStaged')}
              </Button>
            </section>

            <FileChangeList
              t={t}
              workspace={workspace}
              conflicted={conflicted}
              staged={staged}
              unstaged={unstaged}
              loading={changesLoading}
              onRefresh={async () => {
                await onRefresh();
              }}
              onOpenDiff={onOpenDiff}
              onStageFile={onStageFile}
              onStageAll={onStageAll}
              onUnstageFile={onUnstageFile}
              onUnstageAll={onUnstageAll}
              onDiscardFile={onDiscardFile}
            />

            <section className='border-t border-border-2'>
              <div className='flex h-30px items-center px-9px'>
                <span className='min-w-0 flex-1 text-11px font-600'>{t('conversation.workspace.git.commitGraph')}</span>
                <Select
                  size='mini'
                  showSearch
                  value={graphReference ?? repository.branch}
                  options={graphBranchOptions}
                  className='!mr-3px !w-104px'
                  prefix={<Branch size={10} />}
                  onChange={(value) => void run('graph-branch', () => onSelectGraphReference(String(value)))}
                />
                <IconAction
                  label={t('conversation.workspace.git.followCurrentBranch')}
                  icon={
                    <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                      <path d='M4 7h10a4 4 0 0 1 4 4v6' />
                      <path d='m14 14 4 4 4-4' />
                    </svg>
                  }
                  disabled={graphReference === repository.branch}
                  onClick={() => void run('graph-current', onFollowCurrentGraphBranch)}
                />
                <IconAction
                  label={t('common.refresh')}
                  icon={<Refresh size={11} />}
                  loading={graphLoading}
                  onClick={() => void onRefreshGraph()}
                />
              </div>
              {graphLoading && graph.length === 0 ? (
                <div className='flex h-64px items-center justify-center'>
                  <Spin size={14} />
                </div>
              ) : graph.length === 0 ? (
                <div className='px-10px pb-14px text-center text-10px text-t-tertiary'>
                  {t('conversation.workspace.git.noHistory')}
                </div>
              ) : (
                <GitCommitGraph
                  t={t}
                  commits={graph}
                  onLoadFiles={onLoadCommitFiles}
                  onOpenChange={onOpenCommitFile}
                  onCheckout={(commit) =>
                    new Promise<void>((resolve) => {
                      Modal.confirm({
                        title: t('conversation.workspace.git.checkoutCommit'),
                        content: t('conversation.workspace.git.checkoutCommitWarning', { hash: commit.shortHash }),
                        onOk: async () => {
                          await run(`checkout:${commit.hash}`, () => onCheckoutCommit(commit));
                          resolve();
                        },
                        onCancel: resolve,
                      });
                    })
                  }
                  onCreateBranch={(commit) => {
                    setBranchStartPoint(commit.hash);
                    setBranchModal(true);
                  }}
                />
              )}
            </section>
          </>
        )}
      </div>

      <Modal
        title={t('conversation.workspace.git.createBranch')}
        visible={branchModal}
        okButtonProps={{ disabled: !newBranch.trim(), loading: pending === 'create-branch' }}
        onCancel={() => {
          setBranchModal(false);
          setBranchStartPoint(undefined);
        }}
        onOk={() =>
          run('create-branch', () => onCreateBranch(newBranch.trim(), branchStartPoint)).then((completed) => {
            if (!completed) return;
            setBranchModal(false);
            setNewBranch('');
            setBranchStartPoint(undefined);
          })
        }
      >
        <Input value={newBranch} placeholder={t('conversation.workspace.git.branchName')} onChange={setNewBranch} />
      </Modal>
    </div>
  );
};

export default WorkspaceSourceControl;
