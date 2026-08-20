import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcBridge } from '@/common';
import { useConversationAssistants } from '@/renderer/pages/conversation/hooks/useConversationAssistants';
import type { Assistant } from '@/common/types/agent/assistantTypes';

vi.mock('@/common', () => ({
  ipcBridge: {
    assistants: {
      listSelectable: { invoke: vi.fn() },
    },
  },
}));

const assistant = (id: string, source: Assistant['source'], sortOrder: number): Assistant => ({
  id,
  source,
  name: id,
  name_i18n: {},
  description_i18n: {},
  enabled: true,
  sort_order: sortOrder,
  agent_id: 'tjuaecli',
  enabled_skills: [],
  context_i18n: {},
  prompts: [],
  prompts_i18n: {},
  models: [],
  mcp_ids: [],
  agent_status: 'online',
  team_selectable: true,
  deletable: source === 'mine',
});

describe('useConversationAssistants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the explicitly activated runtime catalog', async () => {
    (ipcBridge.assistants.listSelectable.invoke as never as ReturnType<typeof vi.fn>).mockResolvedValue([
      assistant('assistant-1', 'mine', 0),
      assistant('tjuaeui-assistant', 'tjuae-hub', 0),
    ]);

    const { result } = renderHook(() => useConversationAssistants());

    await waitFor(() => expect(result.current.presetAssistants).toHaveLength(2));

    expect(result.current.presetAssistants.map((item) => item.id)).toEqual(['assistant-1', 'tjuaeui-assistant']);
  });

  it('keeps the filtered assistant list stable across rerenders when SWR data is unchanged', async () => {
    const catalog = [assistant('assistant-1', 'mine', 0), assistant('tjuaeui-assistant', 'tjuae-hub', 0)];

    (ipcBridge.assistants.listSelectable.invoke as never as ReturnType<typeof vi.fn>).mockResolvedValue(catalog);

    const { result, rerender } = renderHook(() => useConversationAssistants());

    await waitFor(() => expect(result.current.presetAssistants).toHaveLength(2));

    const firstRenderAssistants = result.current.presetAssistants;
    rerender();

    expect(result.current.presetAssistants).toBe(firstRenderAssistants);
  });
});
