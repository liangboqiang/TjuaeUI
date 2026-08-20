import { describe, expect, it } from 'vitest';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import { selectableAssistants } from '@/renderer/utils/model/assistantSelection';

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

describe('selectableAssistants', () => {
  it('orders unsorted runtime entries as mine then TjuaeHub', () => {
    const result = selectableAssistants([
      assistant('hub-b', 'tjuae-hub', 20),
      assistant('mine-b', 'mine', 20),
      assistant('hub-a', 'tjuae-hub', 10),
      assistant('mine-a', 'mine', 10),
    ]);

    expect(result.map((item) => item.id)).toEqual(['mine-a', 'mine-b', 'hub-a', 'hub-b']);
  });

  it('applies one explicit order across both catalog sources', () => {
    const assistants = [assistant('hub', 'tjuae-hub', 1), assistant('mine', 'mine', 1)];

    expect(selectableAssistants(assistants, ['hub', 'mine']).map((item) => item.id)).toEqual(['hub', 'mine']);
  });

  it('ignores stale and duplicate preference ids, then appends catalog entries deterministically', () => {
    const assistants = [
      assistant('hub-new', 'tjuae-hub', 1),
      assistant('mine-known', 'mine', 2),
      assistant('mine-new', 'mine', 1),
    ];

    expect(selectableAssistants(assistants, ['missing', 'mine-known', 'mine-known']).map((item) => item.id)).toEqual([
      'mine-known',
      'mine-new',
      'hub-new',
    ]);
  });
});
