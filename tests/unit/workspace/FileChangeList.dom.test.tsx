import { ipcBridge } from '@/common';
import type { FileChangeInfo } from '@/common/types/platform/gitWorkspace';
import FileChangeList from '@/renderer/pages/conversation/Workspace/components/FileChangeList';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const arcoMocks = vi.hoisted(() => ({ confirm: vi.fn(), error: vi.fn() }));

vi.mock('@/common', () => ({
  ipcBridge: {
    git: {
      baselineContent: { invoke: vi.fn() },
      indexContent: { invoke: vi.fn() },
    },
    fs: { readFile: { invoke: vi.fn() } },
  },
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    icon,
    onClick,
    children,
    'aria-label': ariaLabel,
  }: React.PropsWithChildren<{
    icon?: React.ReactNode;
    onClick?: (event: React.MouseEvent) => void;
    'aria-label'?: string;
  }>) => (
    <button type='button' aria-label={ariaLabel} onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
  Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
  Message: { error: arcoMocks.error },
  Modal: { confirm: arcoMocks.confirm },
  Spin: () => <span data-testid='spin' />,
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@icon-park/react', () => ({
  Minus: () => <span />,
  Plus: () => <span />,
  PreviewOpen: () => <span />,
  Redo: () => <span />,
  Refresh: () => <span />,
}));

const t = (key: string) => key;
const onOpenDiff = vi.fn();
const baseProps = {
  t,
  workspace: 'C:\\Users\\demo\\repo',
  conflicted: [],
  staged: [],
  unstaged: [],
  loading: false,
  onRefresh: vi.fn(),
  onOpenDiff,
  onStageFile: vi.fn(),
  onStageAll: vi.fn(),
  onUnstageFile: vi.fn(),
  onUnstageAll: vi.fn(),
  onDiscardFile: vi.fn(),
};

const change = (overrides: Partial<FileChangeInfo> = {}): FileChangeInfo => ({
  file_path: 'C:\\Users\\demo\\repo\\src\\app.ts',
  relativePath: 'src/app.ts',
  status: 'modified',
  ...overrides,
});

describe('FileChangeList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arcoMocks.confirm.mockImplementation(({ onOk }: { onOk?: () => void }) => onOk?.());
  });

  it('compares an unstaged file against the index, then opens the shared diff preview', async () => {
    vi.mocked(ipcBridge.git.baselineContent.invoke).mockResolvedValue('head\n');
    vi.mocked(ipcBridge.git.indexContent.invoke).mockResolvedValue('index\n');
    vi.mocked(ipcBridge.fs.readFile.invoke).mockResolvedValue('working\n');
    render(<FileChangeList {...baseProps} unstaged={[change()]} />);

    fireEvent.click(screen.getByRole('button', { name: 'conversation.workspace.git.compare' }));

    await waitFor(() => expect(onOpenDiff).toHaveBeenCalledTimes(1));
    expect(ipcBridge.fs.readFile.invoke).toHaveBeenCalledWith({
      path: 'C:\\Users\\demo\\repo\\src\\app.ts',
      workspace: 'C:\\Users\\demo\\repo',
    });
    expect(onOpenDiff.mock.calls[0]?.[0]).toContain('-index');
    expect(onOpenDiff.mock.calls[0]?.[0]).toContain('+working');
  });

  it('compares a staged file against HEAD without reading the working tree', async () => {
    vi.mocked(ipcBridge.git.baselineContent.invoke).mockResolvedValue('head\n');
    vi.mocked(ipcBridge.git.indexContent.invoke).mockResolvedValue('staged\n');
    render(<FileChangeList {...baseProps} staged={[change()]} />);

    fireEvent.click(screen.getByRole('button', { name: 'conversation.workspace.git.compare' }));

    await waitFor(() => expect(onOpenDiff).toHaveBeenCalledTimes(1));
    expect(ipcBridge.fs.readFile.invoke).not.toHaveBeenCalled();
    expect(onOpenDiff.mock.calls[0]?.[0]).toContain('-head');
    expect(onOpenDiff.mock.calls[0]?.[0]).toContain('+staged');
  });

  it('requires an irreversible-delete confirmation before discarding an untracked file', async () => {
    const onDiscardFile = vi.fn().mockResolvedValue(undefined);
    render(
      <FileChangeList {...baseProps} onDiscardFile={onDiscardFile} unstaged={[change({ status: 'untracked' })]} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'conversation.workspace.changes.discard' }));

    expect(arcoMocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'conversation.workspace.git.discardUntrackedWarning' })
    );
    await waitFor(() => expect(onDiscardFile).toHaveBeenCalledWith('src/app.ts'));
  });
});
