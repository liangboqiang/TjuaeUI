// @vitest-environment jsdom

import { showGitError } from '@/renderer/pages/conversation/Workspace/utils/gitError';
import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const modalError = vi.hoisted(() => vi.fn());

vi.mock('@arco-design/web-react', () => ({
  Modal: { error: modalError },
}));

vi.mock('@/common/adapter/httpBridge', () => ({
  isBackendHttpError: () => false,
}));

const t = ((key: string) => key) as TFunction;

describe('showGitError', () => {
  beforeEach(() => modalError.mockClear());

  it('maps checkout failures to a localized, actionable local-changes message', () => {
    const raw = 'error: Your local changes to the following files would be overwritten by checkout: secret.txt';
    showGitError(t, new Error(raw));

    const options = modalError.mock.calls[0][0];
    expect(options.title).toBe('conversation.workspace.git.errors.localChanges.title');
    expect(JSON.stringify(options.content)).not.toContain(raw);
  });

  it('maps transport failures without exposing the backend response', () => {
    const raw = 'Backend POST failed: fatal: unable to access: Could not resolve host';
    showGitError(t, new Error(raw));

    const options = modalError.mock.calls[0][0];
    expect(options.title).toBe('conversation.workspace.git.errors.network.title');
    expect(JSON.stringify(options.content)).not.toContain(raw);
  });
});
