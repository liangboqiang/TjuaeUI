import type { GitCommitFileInfo, GitCommitInfo, GitFileStatus } from '@/common/types/platform/gitWorkspace';
import { Button, Dropdown, Menu, Spin, Tooltip } from '@arco-design/web-react';
import { Branch, Code, Down, History, Right } from '@icon-park/react';
import type { TFunction } from 'i18next';
import React, { useMemo, useState } from 'react';
import { buildGitGraphTopology } from '../utils/gitGraphTopology';

const LANE_COLORS = ['#4f7cff', '#00a870', '#f59e0b', '#ef5b5b', '#8b5cf6', '#06b6d4'];
const LANE_STEP = 14;
const ROW_HEIGHT = 34;
const STATUS_LABEL: Record<GitFileStatus, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  untracked: 'U',
  conflicted: '!',
};

const colorFor = (color: number) => LANE_COLORS[color % LANE_COLORS.length];
const xFor = (lane: number) => 7 + lane * LANE_STEP;

type Props = {
  t: TFunction;
  commits: GitCommitInfo[];
  onLoadFiles: (commit: GitCommitInfo) => Promise<GitCommitFileInfo[]>;
  onOpenChange: (commit: GitCommitInfo, file: GitCommitFileInfo) => Promise<void>;
  onCheckout: (commit: GitCommitInfo) => Promise<void>;
  onCreateBranch: (commit: GitCommitInfo) => void;
};

const GitCommitGraph: React.FC<Props> = ({ t, commits, onLoadFiles, onOpenChange, onCheckout, onCreateBranch }) => {
  const rows = useMemo(() => buildGitGraphTopology(commits), [commits]);
  const width = Math.max(24, ...rows.map((row) => 18 + row.laneCount * LANE_STEP));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<Record<string, GitCommitFileInfo[]>>({});
  const [pending, setPending] = useState<string | null>(null);

  const toggleCommit = async (commit: GitCommitInfo) => {
    const next = new Set(expanded);
    if (next.has(commit.hash)) {
      next.delete(commit.hash);
      setExpanded(next);
      return;
    }
    next.add(commit.hash);
    setExpanded(next);
    if (files[commit.hash]) return;
    setPending(`files:${commit.hash}`);
    try {
      const commitFiles = await onLoadFiles(commit);
      setFiles((current) => ({ ...current, [commit.hash]: commitFiles }));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className='pb-8px' data-testid='workspace-commit-graph'>
      {rows.map((row, rowIndex) => {
        const isExpanded = expanded.has(row.commit.hash);
        const menu = (
          <Menu>
            <Menu.Item key='changes' onClick={() => void toggleCommit(row.commit)}>
              <span className='flex items-center gap-7px'>
                <Code size={12} />
                {t('conversation.workspace.git.openChanges')}
              </span>
            </Menu.Item>
            <Menu.Item key='checkout' onClick={() => void onCheckout(row.commit)}>
              <span className='flex items-center gap-7px'>
                <History size={12} />
                {t('conversation.workspace.git.checkoutCommit')}
              </span>
            </Menu.Item>
            <Menu.Item key='branch' onClick={() => onCreateBranch(row.commit)}>
              <span className='flex items-center gap-7px'>
                <Branch size={12} />
                {t('conversation.workspace.git.createBranchHere')}
              </span>
            </Menu.Item>
          </Menu>
        );

        return (
          <React.Fragment key={row.commit.hash}>
            <Dropdown droplist={menu} trigger='contextMenu' position='br'>
              <div
                className={`group flex h-34px cursor-default items-center px-7px ${isExpanded ? 'bg-fill-2' : 'hover:bg-fill-2'}`}
                onDoubleClick={() => void toggleCommit(row.commit)}
              >
                <Button
                  type='text'
                  size='mini'
                  className='!mr-1px !h-20px !w-20px !p-0'
                  aria-label={t('conversation.workspace.git.openChanges')}
                  icon={isExpanded ? <Down size={10} /> : <Right size={10} />}
                  onClick={() => void toggleCommit(row.commit)}
                />
                <svg className='mr-5px shrink-0 overflow-visible' width={width} height={ROW_HEIGHT} aria-hidden='true'>
                  {row.continuations.map((edge, index) => (
                    <path
                      key={`continuation:${index}:${edge.from}:${edge.to}`}
                      d={`M ${xFor(edge.from)} 0 C ${xFor(edge.from)} 17, ${xFor(edge.to)} 17, ${xFor(edge.to)} 34`}
                      fill='none'
                      stroke={colorFor(edge.color)}
                      strokeWidth='2'
                    />
                  ))}
                  {rowIndex > 0 ? (
                    <path
                      d={`M ${xFor(row.lane)} 0 L ${xFor(row.lane)} 17`}
                      stroke={colorFor(row.color)}
                      strokeWidth='2.2'
                    />
                  ) : null}
                  {row.parentEdges.map((edge, index) => (
                    <path
                      key={`parent:${index}:${edge.to}`}
                      d={`M ${xFor(row.lane)} 17 C ${xFor(row.lane)} 26, ${xFor(edge.to)} 26, ${xFor(edge.to)} 34`}
                      fill='none'
                      stroke={colorFor(edge.color)}
                      strokeWidth='2.2'
                    />
                  ))}
                  <circle
                    cx={xFor(row.lane)}
                    cy='17'
                    r='4'
                    fill='var(--bg-1)'
                    stroke={colorFor(row.color)}
                    strokeWidth='2.2'
                  />
                </svg>
                <Tooltip mini content={`${row.commit.author} · ${row.commit.hash}`}>
                  <span className='min-w-0 flex-1 truncate text-10px'>{row.commit.subject}</span>
                </Tooltip>
                {row.commit.decorations.slice(0, 3).map((decoration) => (
                  <span
                    key={decoration}
                    className='ml-4px rounded-4px border border-border-2 bg-fill-2 px-4px py-1px text-8px text-t-secondary'
                  >
                    {decoration}
                  </span>
                ))}
                <span className='ml-6px text-8px text-t-tertiary'>{row.commit.shortHash}</span>
              </div>
            </Dropdown>
            {isExpanded ? (
              <div className='border-y border-border-2 bg-fill-1 py-2px pl-36px pr-8px'>
                {pending === `files:${row.commit.hash}` ? (
                  <div className='flex h-36px items-center justify-center'>
                    <Spin size={12} />
                  </div>
                ) : (files[row.commit.hash] ?? []).length === 0 ? (
                  <div className='py-7px text-10px text-t-tertiary'>
                    {t('conversation.workspace.git.noChangedFiles')}
                  </div>
                ) : (
                  files[row.commit.hash].map((file) => (
                    <button
                      type='button'
                      key={`${file.oldPath ?? ''}:${file.path}`}
                      className='flex h-26px w-full items-center gap-7px rounded-4px px-5px text-left hover:bg-fill-2'
                      onClick={() => void onOpenChange(row.commit, file)}
                    >
                      <span className='w-12px shrink-0 text-9px font-700 text-primary-6'>
                        {STATUS_LABEL[file.status]}
                      </span>
                      <span className='min-w-0 flex-1 truncate text-10px text-t-primary'>{file.path}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default GitCommitGraph;
