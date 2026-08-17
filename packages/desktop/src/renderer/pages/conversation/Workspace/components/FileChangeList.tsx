import { ipcBridge } from '@/common';
import type { FileChangeInfo, GitFileStatus } from '@/common/types/platform/gitWorkspace';
import { Button, Empty, Modal, Spin, Tooltip } from '@arco-design/web-react';
import { Minus, Plus, PreviewOpen, Redo, Refresh } from '@icon-park/react';
import { createTwoFilesPatch } from 'diff';
import type { TFunction } from 'i18next';
import React, { useCallback, useMemo, useState } from 'react';
import { resolveWorkspaceChangeReadPath } from '../utils/fileChangePaths';
import { showGitError } from '../utils/gitError';

type FileChangeListProps = {
  t: TFunction;
  workspace: string;
  conflicted: FileChangeInfo[];
  staged: FileChangeInfo[];
  unstaged: FileChangeInfo[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onOpenDiff: (
    diffContent: string,
    fileName: string,
    filePath: string,
    originalContent?: string,
    modifiedContent?: string
  ) => void;
  onStageFile: (filePath: string) => Promise<void>;
  onStageAll: () => Promise<void>;
  onUnstageFile: (filePath: string) => Promise<void>;
  onUnstageAll: () => Promise<void>;
  onDiscardFile: (filePath: string) => Promise<void>;
};

const STATUS_LABELS: Record<GitFileStatus, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  untracked: 'U',
  conflicted: '!',
};

const STATUS_COLORS: Record<GitFileStatus, string> = {
  added: 'text-success-6',
  modified: 'text-warning-6',
  deleted: 'text-danger-6',
  renamed: 'text-primary-6',
  untracked: 'text-success-6',
  conflicted: 'text-danger-6',
};

const IconAction: React.FC<{
  label: string;
  icon: React.ReactNode;
  loading?: boolean;
  onClick: () => void;
}> = ({ label, icon, loading, onClick }) => (
  <Tooltip mini content={label}>
    <Button
      type='text'
      size='mini'
      aria-label={label}
      loading={loading}
      className='!h-22px !w-22px !p-0'
      icon={icon}
      onClick={onClick}
    />
  </Tooltip>
);

const FileChangeList: React.FC<FileChangeListProps> = ({
  t,
  workspace,
  conflicted,
  staged,
  unstaged,
  loading,
  onRefresh,
  onOpenDiff,
  onStageFile,
  onStageAll,
  onUnstageFile,
  onUnstageAll,
  onDiscardFile,
}) => {
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(
    async (key: string, operation: () => Promise<void>) => {
      if (pending) return;
      setPending(key);
      try {
        await operation();
      } catch (error) {
        console.error('[FileChangeList] Git operation failed:', error);
        showGitError(t, error);
      } finally {
        setPending(null);
      }
    },
    [pending, t]
  );

  const openDiff = useCallback(
    async (change: FileChangeInfo, kind: 'staged' | 'working') => {
      const key = `diff:${kind}:${change.relativePath}`;
      await run(key, async () => {
        const [baseline, index] = await Promise.all([
          ipcBridge.git.baselineContent.invoke({ workspace, file_path: change.relativePath }),
          ipcBridge.git.indexContent.invoke({ workspace, file_path: change.relativePath }),
        ]);
        let current: string | null = null;
        if (kind === 'working' && change.status !== 'deleted') {
          const readPath = resolveWorkspaceChangeReadPath(workspace, change.file_path, change.relativePath);
          current = await ipcBridge.fs.readFile.invoke({ path: readPath, workspace });
        }
        const before = kind === 'staged' ? baseline : (index ?? baseline);
        const after = kind === 'staged' ? index : current;
        const patch = createTwoFilesPatch(change.relativePath, change.relativePath, before ?? '', after ?? '');
        onOpenDiff(patch, change.relativePath, change.file_path, before ?? '', after ?? '');
      });
    },
    [onOpenDiff, run, workspace]
  );

  const discard = useCallback(
    (change: FileChangeInfo) => {
      const execute = (): void => {
        void run(`discard:${change.relativePath}`, () => onDiscardFile(change.relativePath));
      };
      Modal.confirm({
        title: t('conversation.workspace.git.discardTitle'),
        content:
          change.status === 'untracked'
            ? t('conversation.workspace.git.discardUntrackedWarning', { path: change.relativePath })
            : t('conversation.workspace.git.discardWarning', { path: change.relativePath }),
        okButtonProps: { status: 'danger' },
        onOk: execute,
      });
    },
    [onDiscardFile, run, t]
  );

  const groups = useMemo(
    () => [
      {
        key: 'conflicted',
        title: t('conversation.workspace.git.conflicts'),
        items: conflicted,
        kind: 'working' as const,
      },
      {
        key: 'unstaged',
        title: t('conversation.workspace.git.workingChanges'),
        items: unstaged,
        kind: 'working' as const,
      },
      { key: 'staged', title: t('conversation.workspace.git.stagedChanges'), items: staged, kind: 'staged' as const },
    ],
    [conflicted, staged, t, unstaged]
  );
  const total = conflicted.length + staged.length + unstaged.length;

  if (loading && total === 0) {
    return (
      <div className='flex h-80px items-center justify-center'>
        <Spin size={16} />
      </div>
    );
  }
  if (total === 0) {
    return (
      <div className='flex min-h-100px items-center justify-center px-12px'>
        <Empty description={t('conversation.workspace.git.cleanWorkspace')} />
      </div>
    );
  }

  return (
    <div className='flex min-h-0 flex-col' data-testid='workspace-git-changes'>
      <div className='flex h-30px shrink-0 items-center border-b border-border-2 px-9px'>
        <span className='min-w-0 flex-1 text-11px font-600 text-t-secondary'>
          {t('conversation.workspace.git.workspaceChanges')} · {total}
        </span>
        {unstaged.length > 0 || conflicted.length > 0 ? (
          <IconAction
            label={t('conversation.workspace.changes.stageAll')}
            icon={<Plus size={12} />}
            loading={pending === 'stage-all'}
            onClick={() => void run('stage-all', onStageAll)}
          />
        ) : null}
        {staged.length > 0 ? (
          <IconAction
            label={t('conversation.workspace.changes.unstageAll')}
            icon={<Minus size={12} />}
            loading={pending === 'unstage-all'}
            onClick={() => void run('unstage-all', onUnstageAll)}
          />
        ) : null}
        <IconAction
          label={t('common.refresh')}
          icon={<Refresh size={12} />}
          loading={loading}
          onClick={() => void run('refresh', onRefresh)}
        />
      </div>

      <div className='min-h-0 overflow-y-auto py-2px'>
        {groups.map((group) =>
          group.items.length === 0 ? null : (
            <section key={group.key}>
              {group.key === 'unstaged' ? null : (
                <div className='flex h-24px items-center bg-fill-1 px-9px text-10px font-600 text-t-secondary'>
                  {group.title}
                  <span className='ml-5px text-t-tertiary'>{group.items.length}</span>
                </div>
              )}
              {group.items.map((change) => {
                const rowKey = `${group.key}:${change.relativePath}`;
                return (
                  <div key={rowKey} className='group flex h-28px items-center px-9px hover:bg-fill-2'>
                    <span className={`w-16px shrink-0 text-10px font-700 ${STATUS_COLORS[change.status]}`}>
                      {STATUS_LABELS[change.status]}
                    </span>
                    <Tooltip mini content={change.relativePath}>
                      <span className='min-w-0 flex-1 truncate text-11px text-t-primary'>{change.relativePath}</span>
                    </Tooltip>
                    <span className='hidden shrink-0 items-center group-hover:flex'>
                      <IconAction
                        label={t('conversation.workspace.git.compare')}
                        icon={<PreviewOpen size={12} />}
                        loading={pending === `diff:${group.kind}:${change.relativePath}`}
                        onClick={() => void openDiff(change, group.kind)}
                      />
                      {group.key === 'staged' ? (
                        <IconAction
                          label={t('conversation.workspace.changes.unstage')}
                          icon={<Minus size={12} />}
                          loading={pending === `unstage:${change.relativePath}`}
                          onClick={() =>
                            void run(`unstage:${change.relativePath}`, () => onUnstageFile(change.relativePath))
                          }
                        />
                      ) : (
                        <>
                          <IconAction
                            label={t('conversation.workspace.changes.discard')}
                            icon={<Redo size={12} />}
                            loading={pending === `discard:${change.relativePath}`}
                            onClick={() => discard(change)}
                          />
                          <IconAction
                            label={t('conversation.workspace.changes.stage')}
                            icon={<Plus size={12} />}
                            loading={pending === `stage:${change.relativePath}`}
                            onClick={() =>
                              void run(`stage:${change.relativePath}`, () => onStageFile(change.relativePath))
                            }
                          />
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </section>
          )
        )}
      </div>
    </div>
  );
};

export default FileChangeList;
