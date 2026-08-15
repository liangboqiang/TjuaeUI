import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatLayout from '@/renderer/pages/conversation/components/ChatLayout';

vi.mock('@/renderer/components/agent/AgentBadge', () => ({ AgentLogoIcon: () => null }));
vi.mock('@/renderer/components/layout/FlexFullContainer', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: false }),
}));
vi.mock('@/renderer/hooks/ui/useResizableSplit', () => ({
  useResizableSplit: (options: { axis?: string; unit?: string }) => ({
    splitRatio: options.unit === 'px' ? 320 : options.axis === 'vertical' ? 56 : 60,
    setSplitRatio: vi.fn(),
    createDragHandle: (props?: { style?: React.CSSProperties; linePlacement?: string; lineClassName?: string }) => (
      <div
        data-testid={options.axis === 'vertical' ? 'vertical-resize-handle' : 'horizontal-resize-handle'}
        data-line-placement={props?.linePlacement}
        data-line-class={props?.lineClassName}
        style={props?.style}
      />
    ),
  }),
}));
vi.mock('@/renderer/pages/conversation/components/ChatTitleEditor', () => ({
  default: () => <div data-testid='chat-title' />,
}));
vi.mock('@/renderer/pages/conversation/components/TraceDrawer', () => ({
  TracePanel: () => <div data-testid='trace-panel' />,
}));
vi.mock('@/renderer/pages/conversation/components/ChatLayout/MobileWorkspaceOverlay', () => ({
  default: () => null,
}));
vi.mock('@/renderer/pages/conversation/components/ChatLayout/WorkspacePanelHeader', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DesktopWorkspaceToggle: () => null,
}));
vi.mock('@/renderer/pages/conversation/hooks/useContainerWidth', () => ({
  useContainerWidth: () => ({ containerRef: { current: null }, containerWidth: 1200 }),
}));
vi.mock('@/renderer/pages/conversation/hooks/useLayoutConstraints', () => ({
  useLayoutConstraints: vi.fn(),
}));
vi.mock('@/renderer/pages/conversation/hooks/useTitleRename', () => ({
  useTitleRename: () => ({
    editingTitle: false,
    setEditingTitle: vi.fn(),
    titleDraft: '',
    setTitleDraft: vi.fn(),
    renameLoading: false,
    canRenameTitle: false,
    submitTitleRename: vi.fn(),
  }),
}));
vi.mock('@/renderer/pages/conversation/hooks/useWorkspaceCollapse', () => ({
  useWorkspaceCollapse: () => ({ rightSiderCollapsed: true, setRightSiderCollapsed: vi.fn() }),
}));
vi.mock('@/renderer/pages/conversation/Preview', () => ({
  PreviewPanel: ({ panelActions }: { panelActions?: React.ReactNode }) => (
    <div data-testid='editor-panel'>{panelActions}</div>
  ),
  usePreviewContext: () => ({ isOpen: true }),
}));
vi.mock('@/renderer/pages/conversation/utils/detectPlatform', () => ({
  isMacEnvironment: () => false,
  isWindowsEnvironment: () => true,
}));
vi.mock('@/renderer/pages/conversation/utils/layoutCalc', () => ({
  DEFAULT_WORKSPACE_PANEL_PX: 320,
  MAX_WORKSPACE_PANEL_PX: 500,
  MIN_WORKSPACE_PANEL_PX: 220,
  WORKSPACE_HEADER_HEIGHT: 40,
  calcLayoutMetrics: () => ({
    dynamicChatMinRatio: 20,
    dynamicChatMaxRatio: 80,
    chatFlex: 60,
    workspaceWidthPx: 320,
    titleAreaMaxWidth: 500,
    mobileWorkspaceHandleRight: 0,
  }),
}));
vi.mock('@/renderer/utils/workspace/workspaceEvents', () => ({
  dispatchWorkspaceToggleEvent: vi.fn(),
}));
vi.mock('@arco-design/web-react', () => {
  const Layout = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>;
  Layout.Header = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <header {...props}>{children}</header>
  );
  Layout.Content = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <main {...props}>{children}</main>;

  return {
    Button: ({
      icon,
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }) => (
      <button type='button' {...props}>
        {icon}
        {children}
      </button>
    ),
    Layout,
    Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});
vi.mock('@icon-park/react', () => ({
  Down: () => null,
  ExpandLeft: () => null,
  ExpandRight: () => null,
  LayoutOne: () => null,
  LayoutTwo: () => null,
  Trace: () => null,
  Up: () => null,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const renderLayout = () =>
  render(
    <ChatLayout conversation_id='conversation-1' title='会话' sider={<div />} workspaceEnabled={false}>
      <div data-testid='conversation-content' />
    </ChatLayout>
  );

describe('ChatLayout editor placement', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('places the editor above the conversation in stacked layout', () => {
    localStorage.setItem('chat-editor-layout-mode', 'stacked');

    renderLayout();

    const layout = screen.getByTestId('conversation-editor-layout');
    const editorPane = layout.querySelector<HTMLElement>("[data-workbench-pane='editor']");
    const conversationPane = layout.querySelector<HTMLElement>("[data-workbench-pane='conversation']");

    expect(layout).toHaveAttribute('data-editor-layout', 'stacked');
    expect(editorPane?.style.order).toBe('1');
    expect(conversationPane?.style.order).toBe('3');
  });

  it('removes card framing and gaps from the upper editor pane', () => {
    localStorage.setItem('chat-editor-layout-mode', 'stacked');

    renderLayout();

    const layout = screen.getByTestId('conversation-editor-layout');
    const editorPane = layout.querySelector<HTMLElement>("[data-workbench-pane='editor']");

    expect(editorPane?.style.borderStyle).toBe('none');
    expect(editorPane?.className).not.toContain('rounded-[15px]');
    expect(editorPane?.className).not.toContain('mx-[12px]');
  });

  it('keeps a visible divider between the editor and conversation', () => {
    localStorage.setItem('chat-editor-layout-mode', 'stacked');

    renderLayout();

    const divider = document.querySelector<HTMLElement>('[data-stacked-divider]');
    expect(divider?.className).toContain('bg-border-1');
    expect(screen.getByRole('button', { name: 'preview.hideConversationPane' })).toBeInTheDocument();
  });

  it('hides and restores the conversation from the divider control', () => {
    localStorage.setItem('chat-editor-layout-mode', 'stacked');

    renderLayout();

    const conversationPane = document.querySelector<HTMLElement>("[data-workbench-pane='conversation']");
    fireEvent.click(screen.getByRole('button', { name: 'preview.hideConversationPane' }));
    expect(conversationPane?.style.display).toBe('none');

    fireEvent.click(screen.getByRole('button', { name: 'preview.showConversationPane' }));
    expect(conversationPane?.style.display).toBe('flex');
  });

  it('falls back to side-by-side layout for an invalid stored preference', () => {
    localStorage.setItem('chat-editor-layout-mode', 'unsupported');

    renderLayout();

    const layout = screen.getByTestId('conversation-editor-layout');
    const editorPane = layout.querySelector<HTMLElement>("[data-workbench-pane='editor']");

    expect(layout).toHaveAttribute('data-editor-layout', 'side');
    expect(editorPane?.className).toContain('rounded-[15px]');

    fireEvent.click(screen.getByRole('button', { name: 'preview.switchToStackedLayout' }));
    expect(layout).toHaveAttribute('data-editor-layout', 'stacked');
  });
});
