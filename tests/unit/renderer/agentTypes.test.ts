import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import type { ManagedAgent } from '@/renderer/utils/model/agentTypes';
import { formatManagedAgentDiagnosticMessage } from '@/renderer/utils/model/agentTypes';

const t = ((key: string, options?: Record<string, unknown>) => {
  switch (key) {
    case 'settings.engineManagement.errorCodes.command_not_found':
      return `Install ${String(options?.command)} and retry the connection test.`;
    case 'settings.engineManagement.errorCodes.bridge_missing':
      return `Install ${String(options?.command)} and retry the connection test.`;
    case 'settings.engineManagement.testConnectionUnavailable':
      return `${String(options?.name)} is unavailable. Check its status details.`;
    default:
      return String(options?.defaultValue ?? key);
  }
}) as unknown as TFunction;

function managedAgent(overrides: Partial<ManagedAgent>): ManagedAgent {
  return {
    id: 'agent-1',
    name: 'Codex',
    agent_type: 'acp',
    agent_source: 'builtin',
    enabled: true,
    installed: true,
    status: 'unavailable',
    sort_order: 1,
    args: [],
    env: [],
    behavior_policy: {},
    team_capable: true,
    ...overrides,
  } as ManagedAgent;
}

describe('formatManagedAgentDiagnosticMessage', () => {
  it('formats localized diagnostics from error code and details', () => {
    const message = formatManagedAgentDiagnosticMessage(
      t,
      managedAgent({
        last_check_error_code: 'command_not_found',
        last_check_error_details: { command: 'codex' },
        last_check_error_message: 'spawn failed',
      })
    );

    expect(message).toBe('Install codex and retry the connection test.');
  });

  it('uses a localized fallback instead of exposing backend text when the code is unknown', () => {
    const message = formatManagedAgentDiagnosticMessage(
      t,
      managedAgent({
        last_check_error_code: 'unknown_error_code',
        last_check_error_message: 'raw backend message',
      })
    );

    expect(message).toBe('Codex is unavailable. Check its status details.');
    expect(message).not.toContain('raw backend message');
  });
});
