import { describe, expect, it } from 'vitest';
import {
  filterAgentsByAvailability,
  getAgentAvailabilityFilterStats,
  type AgentAvailabilityFilter,
} from '@/renderer/pages/settings/AgentSettings/agentFilters';
import type { ManagedAgent } from '@/renderer/utils/model/agentTypes';

const agent = (id: string, status: ManagedAgent['status'], errorCode?: string, enabled = true): ManagedAgent =>
  ({
    id,
    name: id,
    agent_type: 'acp',
    agent_source: 'builtin',
    enabled,
    installed: status !== 'missing',
    status,
    last_check_error_code: errorCode,
  }) as ManagedAgent;

describe('agent availability filters', () => {
  const agents = [
    agent('connection', 'offline', 'connection_failed'),
    agent('online', 'online'),
    agent('missing', 'missing'),
    agent('auth', 'offline', 'auth_required'),
    agent('protocol', 'offline', 'acp_init_failed'),
    agent('disabled', 'online', undefined, false),
  ];

  it('counts every detailed availability state', () => {
    expect(getAgentAvailabilityFilterStats(agents)).toEqual({
      all: 6,
      online: 1,
      needs_auth: 1,
      connection_failed: 1,
      protocol_error: 1,
      not_detected: 1,
      disabled: 1,
    });
  });

  it.each<[AgentAvailabilityFilter, string[]]>([
    ['all', ['connection', 'online', 'missing', 'auth', 'protocol', 'disabled']],
    ['online', ['online']],
    ['needs_auth', ['auth']],
    ['connection_failed', ['connection']],
    ['protocol_error', ['protocol']],
    ['not_detected', ['missing']],
    ['disabled', ['disabled']],
  ])('filters %s agents without changing relative order', (filter, expectedIds) => {
    expect(filterAgentsByAvailability(agents, filter).map((item) => item.id)).toEqual(expectedIds);
  });
});
