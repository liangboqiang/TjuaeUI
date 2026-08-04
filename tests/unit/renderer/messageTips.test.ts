/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { inferLegacyAgentTipCode } from '@/renderer/pages/conversation/Messages/components/MessageTips';

describe('inferLegacyAgentTipCode', () => {
  it.each([
    [
      'Project-local config, hooks, and exec policies are disabled in the following folders until the project is trusted.',
      'CODEX_PROJECT_TRUST_REQUIRED',
    ],
    ['Skill descriptions were shortened to fit the 2% skills context budget.', 'CODEX_SKILL_DESCRIPTIONS_TRUNCATED'],
    ['Falling back from WebSockets to HTTPS transport. request timed out', 'CODEX_WEBSOCKET_FALLBACK'],
  ])('maps persisted codeless notices to %s', (content, expected) => {
    expect(inferLegacyAgentTipCode(content)).toBe(expected);
  });

  it('leaves unrelated upstream text untouched', () => {
    expect(inferLegacyAgentTipCode('An unrelated warning')).toBeNull();
  });
});
