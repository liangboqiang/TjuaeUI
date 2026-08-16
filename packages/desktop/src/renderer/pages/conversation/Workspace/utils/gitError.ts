import { isBackendHttpError } from '@/common/adapter/httpBridge';
import { Modal } from '@arco-design/web-react';
import React from 'react';
import type { TFunction } from 'i18next';

type GitErrorKind =
  | 'localChanges'
  | 'untrackedOverwrite'
  | 'conflict'
  | 'nonFastForward'
  | 'noUpstream'
  | 'authentication'
  | 'repositoryNotFound'
  | 'network'
  | 'locked'
  | 'branchExists'
  | 'branchMissing'
  | 'nothingToCommit'
  | 'generic';

const classifyGitError = (error: unknown): GitErrorKind => {
  const message = (
    isBackendHttpError(error) ? error.backendMessage : error instanceof Error ? error.message : ''
  ).toLocaleLowerCase('en-US');
  if (message.includes('local changes') && message.includes('overwritten')) return 'localChanges';
  if (message.includes('untracked working tree files') && message.includes('overwritten')) return 'untrackedOverwrite';
  if (message.includes('conflict') || message.includes('merge_head')) return 'conflict';
  if (message.includes('non-fast-forward') || message.includes('fetch first')) return 'nonFastForward';
  if (message.includes('no upstream') || message.includes('no tracking information')) return 'noUpstream';
  if (
    message.includes('authentication failed') ||
    message.includes('permission denied') ||
    message.includes('publickey')
  ) {
    return 'authentication';
  }
  if (message.includes('repository not found') || message.includes('not a git repository')) return 'repositoryNotFound';
  if (
    message.includes('could not resolve host') ||
    message.includes('failed to connect') ||
    message.includes('timed out')
  ) {
    return 'network';
  }
  if (message.includes('index.lock') || message.includes('another git process')) return 'locked';
  if (message.includes('already exists')) return 'branchExists';
  if (message.includes('invalid reference') || message.includes('pathspec') || message.includes('unknown revision')) {
    return 'branchMissing';
  }
  if (message.includes('nothing to commit')) return 'nothingToCommit';
  return 'generic';
};

export const showGitError = (t: TFunction, error: unknown): void => {
  const kind = classifyGitError(error);
  Modal.error({
    title: t(`conversation.workspace.git.errors.${kind}.title`),
    content: React.createElement(
      'div',
      { className: 'flex flex-col gap-8px' },
      React.createElement(
        'p',
        { className: 'm-0 text-13px text-t-primary' },
        t(`conversation.workspace.git.errors.${kind}.description`)
      ),
      React.createElement(
        'p',
        { className: 'm-0 text-12px text-t-secondary' },
        t(`conversation.workspace.git.errors.${kind}.guidance`)
      )
    ),
    okText: t('common.confirm'),
  });
};
