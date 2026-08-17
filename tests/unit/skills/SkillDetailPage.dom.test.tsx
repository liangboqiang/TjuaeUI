import React from 'react';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listAvailableSkills: vi.fn(),
  assistantsList: vi.fn(),
  assistantsSetState: vi.fn(),
  conversationCreate: vi.fn(),
  getConversationOrNull: vi.fn(),
  navigate: vi.fn(),
  openPreview: vi.fn(),
  params: { skillName: 'demo-skill' },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      listAvailableSkills: { invoke: mocks.listAvailableSkills },
    },
    assistants: {
      list: { invoke: mocks.assistantsList },
      setState: { invoke: mocks.assistantsSetState },
    },
    conversation: { create: { invoke: mocks.conversationCreate } },
  },
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
  useLocation: () => ({ pathname: '/settings/skills/detail/demo-skill', state: null }),
}));
vi.mock('@/renderer/pages/conversation/Preview/context/PreviewContext', () => ({
  usePreviewContext: () => ({ openPreview: mocks.openPreview }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/renderer/pages/conversation/utils/conversationCache', () => ({
  getConversationOrNull: mocks.getConversationOrNull,
}));
vi.mock('@/renderer/pages/conversation/components/ChatConversation', () => ({
  default: ({
    conversation,
    workspaceOverride,
    initialOpenFiles,
    initiallyExpandWorkspace,
  }: {
    conversation: { id: string };
    workspaceOverride?: string;
    initialOpenFiles?: string[];
    initiallyExpandWorkspace?: boolean;
  }) => (
    <div
      data-testid='shared-chat-workbench'
      data-workspace={workspaceOverride}
      data-open-files={initialOpenFiles?.join(',')}
      data-workspace-expanded={String(Boolean(initiallyExpandWorkspace))}
    >
      {conversation.id}
    </div>
  ),
}));

import SkillDetailPage from '@/renderer/pages/settings/SkillsSettings/SkillDetailPage';

const skill = {
  id: 'demo-skill',
  slug: 'demo-skill',
  name: '演示技能',
  description: '演示',
  version: '1.0.0',
  path: 'C:/skills/demo-skill',
  source: { kind: 'local' as const },
  categories: [],
  preferences: { enabled: true, autoInject: false },
};

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SkillDetailPage />
    </SWRConfig>
  );

describe('SkillDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.params.skillName = 'demo-skill';
    mocks.listAvailableSkills.mockResolvedValue([skill]);
    mocks.assistantsList.mockResolvedValue([{ id: 'builtin-tjuaeui-assistant', name: 'TjuaeUI 管家', enabled: true }]);
    mocks.conversationCreate.mockResolvedValue({
      id: 'skill-conversation',
      name: '演示技能',
      extra: { workspace: skill.path },
    });
    mocks.getConversationOrNull.mockResolvedValue(null);
  });

  it('uses the exact shared conversation workbench with TjuaeUI Butler', async () => {
    renderPage();

    expect(await screen.findByTestId('shared-chat-workbench')).toHaveTextContent('skill-conversation');
    expect(mocks.conversationCreate).toHaveBeenCalledWith({
      assistant: { id: 'builtin-tjuaeui-assistant' },
      name: '演示技能',
      extra: { skill_workspace: skill.path, system_action: true },
    });
  });

  it('opens the manifest and SKILL.md as the two default editable documents', async () => {
    renderPage();
    await screen.findByTestId('shared-chat-workbench');

    const workbench = screen.getByTestId('shared-chat-workbench');
    expect(workbench).toHaveAttribute('data-workspace', skill.path);
    expect(workbench).toHaveAttribute('data-open-files', '.tjuae-skill.json,SKILL.md');
    expect(workbench).toHaveAttribute('data-workspace-expanded', 'true');
  });

  it('keeps Windows verbatim workspace paths valid when opening the default documents', async () => {
    const windowsSkill = {
      ...skill,
      path: '\\\\?\\C:\\Users\\Administrator\\skills\\demo-skill',
    };
    mocks.listAvailableSkills.mockResolvedValue([windowsSkill]);
    mocks.conversationCreate.mockResolvedValue({
      id: 'skill-conversation',
      name: '演示技能',
      extra: { workspace: windowsSkill.path },
    });

    renderPage();
    await screen.findByTestId('shared-chat-workbench');

    expect(screen.getByTestId('shared-chat-workbench')).toHaveAttribute('data-workspace', windowsSkill.path);
  });

  it('does not create a second workbench for an unknown skill', async () => {
    mocks.params.skillName = 'missing';
    renderPage();

    expect(await screen.findByText('settings.skillsHub.detailNotFound')).toBeInTheDocument();
    expect(mocks.conversationCreate).not.toHaveBeenCalled();
  });
});
