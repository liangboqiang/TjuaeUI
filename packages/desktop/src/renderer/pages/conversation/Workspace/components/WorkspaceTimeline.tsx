import type { GitCommitInfo } from '@/common/types/platform/gitWorkspace';
import { Button, Empty, Spin, Tooltip } from '@arco-design/web-react';
import { Down, PreviewOpen, Record, Refresh, Right } from '@icon-park/react';
import type { TFunction } from 'i18next';
import React, { useMemo, useState } from 'react';
import { showGitError } from '../utils/gitError';

type Props = {
  t: TFunction;
  filePath?: string;
  history: GitCommitInfo[];
  loading: boolean;
  onRefresh: () => Promise<unknown>;
  onOpen: (commit: GitCommitInfo) => Promise<void>;
  onCompare: (commit: GitCommitInfo) => Promise<void>;
};

const relativeTime = (seconds: number): string => {
  const delta = seconds - Math.floor(Date.now() / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const absolute = Math.abs(delta);
  if (absolute < 60) return formatter.format(delta, 'second');
  if (absolute < 3600) return formatter.format(Math.round(delta / 60), 'minute');
  if (absolute < 86_400) return formatter.format(Math.round(delta / 3600), 'hour');
  return formatter.format(Math.round(delta / 86_400), 'day');
};

const WorkspaceTimeline: React.FC<Props> = ({ t, filePath, history, loading, onRefresh, onOpen, onCompare }) => {
  const [expanded, setExpanded] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const displayName = useMemo(() => filePath?.split(/[\\/]/).pop(), [filePath]);

  const run = async (key: string, operation: () => Promise<void>) => {
    if (pending) return;
    setPending(key);
    try {
      await operation();
    } catch (error) {
      console.error('[WorkspaceTimeline] Git revision operation failed:', error);
      showGitError(t, error);
    } finally {
      setPending(null);
    }
  };

  return (
    <section
      className={`shrink-0 border-t border-border-2 bg-1 ${expanded && filePath ? 'h-[36%] min-h-132px' : 'h-31px'}`}
    >
      <div className='flex h-30px items-center px-7px'>
        <Button
          type='text'
          size='mini'
          className='!h-22px !w-22px !p-0'
          icon={expanded ? <Down size={11} /> : <Right size={11} />}
          aria-label={t('conversation.workspace.git.toggleTimeline')}
          onClick={() => setExpanded((value) => !value)}
        />
        <span className='ml-2px min-w-0 flex-1 truncate text-11px font-600 text-t-primary'>
          {t('conversation.workspace.git.timeline')}
          {displayName ? <span className='ml-5px font-normal text-t-tertiary'>· {displayName}</span> : null}
        </span>
        <Tooltip mini content={t('common.refresh')}>
          <Button
            type='text'
            size='mini'
            className='!h-22px !w-22px !p-0'
            loading={loading}
            disabled={!filePath}
            icon={<Refresh size={11} />}
            onClick={() => void onRefresh()}
          />
        </Tooltip>
      </div>
      {expanded && filePath ? (
        <div className='h-[calc(100%-30px)] overflow-y-auto border-t border-border-2 py-2px'>
          {loading && history.length === 0 ? (
            <div className='flex h-64px items-center justify-center'>
              <Spin size={14} />
            </div>
          ) : history.length === 0 ? (
            <Empty className='!py-12px' description={t('conversation.workspace.git.noHistory')} />
          ) : (
            history.map((commit) => (
              <div
                key={commit.hash}
                className='group flex h-30px cursor-pointer items-center px-9px hover:bg-fill-2'
                role='button'
                tabIndex={0}
                onClick={() => void run(`open:${commit.hash}`, () => onOpen(commit))}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  void run(`open:${commit.hash}`, () => onOpen(commit));
                }}
              >
                <Record size={10} className='mr-7px shrink-0 text-primary-6' />
                <Tooltip mini content={`${commit.author} · ${commit.shortHash}`}>
                  <span className='min-w-0 flex-1 truncate text-11px text-t-primary'>{commit.subject}</span>
                </Tooltip>
                <span className='ml-6px shrink-0 text-9px text-t-tertiary'>{relativeTime(commit.authoredAt)}</span>
                <Tooltip mini content={t('conversation.workspace.git.compareWithCurrent')}>
                  <Button
                    type='text'
                    size='mini'
                    className='ml-2px !h-22px !w-22px !p-0 opacity-0 group-hover:opacity-100'
                    loading={pending === `compare:${commit.hash}`}
                    icon={<PreviewOpen size={11} />}
                    onClick={(event) => {
                      event.stopPropagation();
                      void run(`compare:${commit.hash}`, () => onCompare(commit));
                    }}
                  />
                </Tooltip>
              </div>
            ))
          )}
        </div>
      ) : expanded ? (
        <div className='border-t border-border-2 px-10px py-12px text-center text-10px text-t-tertiary'>
          {t('conversation.workspace.git.selectFileForTimeline')}
        </div>
      ) : null}
    </section>
  );
};

export default WorkspaceTimeline;
