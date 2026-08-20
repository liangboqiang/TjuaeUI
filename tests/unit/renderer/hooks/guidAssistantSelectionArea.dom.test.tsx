import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import AssistantSelectionArea, {
  hasTruncatedAssistantLabels,
  resolveAssistantVisibleLimit,
} from '@/renderer/pages/guid/components/AssistantSelectionArea';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@arco-design/web-react', async () => {
  const actual = await vi.importActual<typeof import('@arco-design/web-react')>('@arco-design/web-react');
  return {
    ...actual,
    Message: {
      useMessage: () => [{ warning: vi.fn() }, <div key='message-holder' />],
    },
  };
});

describe('AssistantSelectionArea', () => {
  it('maps available width to 4, 3, 2, then 1 visible assistant slots', () => {
    expect(resolveAssistantVisibleLimit(800)).toBe(4);
    expect(resolveAssistantVisibleLimit(680)).toBe(3);
    expect(resolveAssistantVisibleLimit(520)).toBe(2);
    expect(resolveAssistantVisibleLimit(390)).toBe(1);
  });

  it('detects labels that are visually truncated', () => {
    const root = document.createElement('div');
    const label = document.createElement('span');
    label.setAttribute('data-assistant-label', 'true');
    Object.defineProperty(label, 'clientWidth', { configurable: true, value: 80 });
    Object.defineProperty(label, 'scrollWidth', { configurable: true, value: 120 });
    root.appendChild(label);

    expect(hasTruncatedAssistantLabels(root)).toBe(true);

    Object.defineProperty(label, 'scrollWidth', { configurable: true, value: 80 });

    expect(hasTruncatedAssistantLabels(root)).toBe(false);
  });

  it('keeps the assistant picker visible after an assistant is selected', () => {
    render(
      <AssistantSelectionArea
        selectedAssistantId='hub-tjuaecli'
        assistants={assistants()}
        localeKey='en-US'
        onSelectAssistant={vi.fn()}
      />
    );

    expect(screen.getByTestId('preset-pill-hub-tjuaecli')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-add-preset')).not.toBeInTheDocument();
    expect(screen.queryByText('Select an assistant to start a task')).not.toBeInTheDocument();
    expect(screen.queryByText('Try these example prompts:')).not.toBeInTheDocument();
    expect(screen.queryByText('Summarize today')).not.toBeInTheDocument();
  });

  it('moves overflow assistants into a more dropdown', async () => {
    render(
      <AssistantSelectionArea
        selectedAssistantId='hub-tjuaecli'
        assistants={manyAssistants()}
        localeKey='en-US'
        onSelectAssistant={vi.fn()}
      />
    );

    // Mine entries lead the stable catalog order. The selected Hub assistant
    // occupies the last visible slot; the remaining Hub entry overflows.
    expect(screen.getByTestId('preset-pill-hub-tjuaecli')).toBeInTheDocument();
    expect(screen.getByTestId('preset-pill-user-research')).toBeInTheDocument();
    expect(screen.getByTestId('preset-pill-user-review')).toBeInTheDocument();
    expect(screen.getByTestId('preset-pill-user-translate')).toBeInTheDocument();
    expect(screen.queryByTestId('preset-pill-hub-writer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('assistant-more-btn'));

    expect(await screen.findByTestId('assistant-overflow-user-finance')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-overflow-hub-writer')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-overflow-hub-tjuaecli')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assistant-overflow-user-research')).not.toBeInTheDocument();
  });

  it('lays out the overflow dropdown as a grid matching the visible pill count', async () => {
    render(
      <AssistantSelectionArea
        selectedAssistantId='hub-tjuaecli'
        assistants={manyAssistants()}
        localeKey='en-US'
        onSelectAssistant={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('assistant-more-btn'));

    const panel = await screen.findByTestId('assistant-overflow-panel');
    // jsdom reports a wide window, so the width limit resolves to 4 columns.
    expect(panel.getAttribute('data-overflow-columns')).toBe('4');
    const grid = panel.querySelector<HTMLElement>('.grid');
    expect(grid?.style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
  });

  it('narrows the overflow grid together with the visible pill count', async () => {
    render(
      <AssistantSelectionArea
        selectedAssistantId='hub-tjuaecli'
        assistants={manyAssistants()}
        localeKey='en-US'
        maxVisibleAssistants={2}
        onSelectAssistant={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('assistant-more-btn'));

    const panel = await screen.findByTestId('assistant-overflow-panel');
    expect(panel.getAttribute('data-overflow-columns')).toBe('2');
    const grid = panel.querySelector<HTMLElement>('.grid');
    expect(grid?.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('hides the overflow search until the list exceeds five rows', async () => {
    render(
      <AssistantSelectionArea
        selectedAssistantId='hub-tjuaecli'
        assistants={manyAssistants()}
        localeKey='en-US'
        onSelectAssistant={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('assistant-more-btn'));

    await screen.findByTestId('assistant-overflow-panel');
    // 2 overflow assistants in 4 columns → 1 row, far below the 5-row threshold.
    expect(screen.queryByPlaceholderText('Search')).not.toBeInTheDocument();
  });

  it('shows the overflow search once the list exceeds five rows', async () => {
    const bulk = Array.from({ length: 25 }, (_, index) =>
      mkAssistant(`user-bulk-${index}`, `Bulk ${index}`, 'mine', 'claude', 100 + index)
    );

    render(
      <AssistantSelectionArea
        selectedAssistantId='hub-tjuaecli'
        assistants={[...manyAssistants(), ...bulk]}
        localeKey='en-US'
        maxVisibleAssistants={1}
        onSelectAssistant={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('assistant-more-btn'));

    await screen.findByTestId('assistant-overflow-panel');
    // 30 overflow assistants in 1 column → 30 rows, search becomes necessary.
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
  });

  it('limits the top assistant row when a smaller visible count is provided', async () => {
    render(
      <AssistantSelectionArea
        selectedAssistantId='hub-tjuaecli'
        assistants={manyAssistants()}
        localeKey='en-US'
        maxVisibleAssistants={1}
        onSelectAssistant={vi.fn()}
      />
    );

    expect(screen.getByTestId('preset-pill-hub-tjuaecli')).toBeInTheDocument();
    expect(screen.queryByTestId('preset-pill-user-research')).not.toBeInTheDocument();
    expect(screen.queryByTestId('preset-pill-user-review')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('assistant-more-btn'));

    expect(await screen.findByTestId('assistant-overflow-user-research')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-overflow-user-review')).toBeInTheDocument();
  });

  it('reports the real assistant id when a pill is selected', () => {
    const onSelectAssistant = vi.fn();

    render(
      <AssistantSelectionArea
        selectedAssistantId='hub-tjuaecli'
        assistants={assistants()}
        localeKey='en-US'
        onSelectAssistant={onSelectAssistant}
      />
    );

    fireEvent.click(screen.getByTestId('preset-pill-hub-writer'));

    expect(onSelectAssistant).toHaveBeenCalledWith('hub-writer');
  });

  it('orders assistant pills by group then sort_order before applying overflow', () => {
    render(
      <AssistantSelectionArea
        selectedAssistantId='hub-tjuaecli'
        assistants={[
          mkAssistant('late', 'Late', 'mine', 'claude', 90),
          mkAssistant('early', 'Early', 'mine', 'claude', 5),
          ...assistants(),
          mkAssistant('mid', 'Mid', 'mine', 'claude', 15),
        ]}
        localeKey='en-US'
        onSelectAssistant={vi.fn()}
      />
    );

    // Mine entries are ordered by sort_order, followed by TjuaeHub entries.
    expect(
      screen
        .getAllByRole('button')
        .slice(0, 4)
        .map((node) => node.textContent?.trim())
    ).toEqual(['Early', 'Mid', 'Late', 'Tjuae CLI']);
  });

  it('keeps a selected overflow assistant visible in the top pill row', () => {
    render(
      <AssistantSelectionArea
        selectedAssistantId='user-finance'
        assistants={manyAssistants()}
        localeKey='en-US'
        onSelectAssistant={vi.fn()}
      />
    );

    // The selected mine assistant remains in the top source group.
    expect(screen.getByTestId('preset-pill-user-finance')).toBeInTheDocument();
    expect(screen.getByTestId('preset-pill-user-translate')).toBeInTheDocument();
  });

  it('uses the last visible slot for an overflow selection at smaller visible counts', () => {
    render(
      <AssistantSelectionArea
        selectedAssistantId='user-finance'
        assistants={manyAssistants()}
        localeKey='en-US'
        maxVisibleAssistants={2}
        onSelectAssistant={vi.fn()}
      />
    );

    expect(screen.getAllByTestId(/^preset-pill-/).map((node) => node.getAttribute('data-assistant-id'))).toEqual([
      'user-research',
      'user-finance',
    ]);
    expect(screen.getByTestId('preset-pill-user-research')).toBeInTheDocument();
  });

  it('can re-render from an empty assistant catalog without breaking hook order', () => {
    const { rerender } = render(
      <AssistantSelectionArea
        selectedAssistantId={null}
        assistants={[]}
        localeKey='en-US'
        onSelectAssistant={vi.fn()}
      />
    );

    expect(() =>
      rerender(
        <AssistantSelectionArea
          selectedAssistantId='hub-tjuaecli'
          assistants={assistants()}
          localeKey='en-US'
          onSelectAssistant={vi.fn()}
        />
      )
    ).not.toThrow();

    expect(screen.getByTestId('preset-pill-hub-tjuaecli')).toBeInTheDocument();
  });
});

function assistants(): Assistant[] {
  return [
    {
      id: 'hub-tjuaecli',
      source: 'tjuae-hub',
      name: 'Tjuae CLI',
      name_i18n: {},
      description_i18n: {},
      enabled: true,
      sort_order: 10,
      agent_id: 'tjuaecli',
      enabled_skills: [],
      context_i18n: {},
      prompts: ['Summarize today'],
      prompts_i18n: {},
      models: [],
      mcp_ids: [],
      agent_status: 'online',
      team_selectable: true,
      deletable: false,
    },
    {
      id: 'hub-writer',
      source: 'tjuae-hub',
      name: 'Writer',
      name_i18n: {},
      description_i18n: {},
      enabled: true,
      sort_order: 20,
      agent_id: 'claude',
      enabled_skills: [],
      context_i18n: {},
      prompts: ['Draft a post'],
      prompts_i18n: {},
      models: [],
      mcp_ids: [],
      agent_status: 'online',
      team_selectable: true,
      deletable: false,
    },
  ];
}

function manyAssistants(): Assistant[] {
  return [
    ...assistants(),
    mkAssistant('user-research', 'Researcher', 'mine', 'gemini', 30),
    mkAssistant('user-review', 'Reviewer', 'mine', 'codex', 40),
    mkAssistant('user-translate', 'Translator', 'mine', 'qwen', 50),
    mkAssistant('user-finance', 'Finance', 'mine', 'claude', 60),
  ];
}

function mkAssistant(
  id: string,
  name: string,
  source: Assistant['source'],
  agent_id: string,
  sort_order: number
): Assistant {
  return {
    id,
    source,
    name,
    name_i18n: {},
    description_i18n: {},
    enabled: true,
    sort_order,
    agent_id,
    enabled_skills: [],
    context_i18n: {},
    prompts: [],
    prompts_i18n: {},
    models: [],
    mcp_ids: [],
    agent_status: 'online',
    team_selectable: true,
    deletable: source === 'mine',
  };
}
