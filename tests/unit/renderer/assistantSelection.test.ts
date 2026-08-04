/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import { assistantOrderAfterToggle, selectableAssistants } from '@/renderer/utils/model/assistantSelection';

const mk = (id: string, source: Assistant['source'], sort_order: number, enabled = true): Assistant =>
  ({
    id,
    source,
    name: id,
    name_i18n: {},
    description_i18n: {},
    enabled,
    sort_order,
    enabled_skills: [],
    custom_skill_names: [],
    context_i18n: {},
    prompts: [],
    prompts_i18n: {},
    models: [],
    agent_status: 'online',
    team_selectable: true,
    deletable: source === 'user',
  }) as Assistant;

describe('selectableAssistants', () => {
  it('keeps generated assistants ahead of user assistants when no preference exists', () => {
    const result = selectableAssistants([
      mk('generated-a', 'generated', 5),
      mk('user-b', 'user', 20),
      mk('cli-a', 'generated', 30),
      mk('user-a', 'user', 10),
      mk('cli-b', 'generated', 40),
    ]);
    expect(result.map((a) => a.id)).toEqual(['generated-a', 'cli-a', 'cli-b', 'user-a', 'user-b']);
  });

  it('drops disabled assistants', () => {
    const result = selectableAssistants([
      mk('cli-on', 'generated', 10, true),
      mk('cli-off', 'generated', 20, false),
      mk('user-off', 'user', 30, false),
    ]);
    expect(result.map((a) => a.id)).toEqual(['cli-on']);
  });

  it('keeps generated assistants ahead of user assistants even when the user assistant sorts first', () => {
    const result = selectableAssistants([mk('writer', 'user', 1), mk('cli', 'generated', 999)]);
    expect(result[0].id).toBe('cli');
  });

  it('applies one preferred order across generated and user assistants', () => {
    const assistants = [mk('generated', 'generated', 1), mk('custom', 'user', 1), mk('cli', 'generated', 2)];

    const result = selectableAssistants(assistants, ['generated', 'cli', 'custom']);

    expect(result.map((assistant) => assistant.id)).toEqual(['generated', 'cli', 'custom']);
  });

  it('ignores duplicate and stale IDs, then appends new assistants deterministically', () => {
    const assistants = [
      mk('generated-new', 'generated', 2),
      mk('custom-known', 'user', 1),
      mk('cli-new', 'generated', 3),
    ];

    const result = selectableAssistants(assistants, ['missing', 'custom-known', 'custom-known']);

    expect(result.map((assistant) => assistant.id)).toEqual(['custom-known', 'generated-new', 'cli-new']);
  });
});

describe('assistantOrderAfterToggle', () => {
  const assistants = [
    mk('cli', 'generated', 1),
    mk('custom', 'user', 1),
    mk('generated', 'generated', 2),
    mk('disabled', 'generated', 3, false),
  ];

  it('removes a disabled assistant from the enabled order', () => {
    expect(assistantOrderAfterToggle(assistants, ['generated', 'cli', 'custom'], 'cli', false)).toEqual([
      'generated',
      'custom',
    ]);
  });

  it('appends a re-enabled assistant to the end', () => {
    expect(assistantOrderAfterToggle(assistants, ['generated', 'cli', 'custom'], 'disabled', true)).toEqual([
      'generated',
      'cli',
      'custom',
      'disabled',
    ]);
  });
});
