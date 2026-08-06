import type { ManagedAgent } from '@/renderer/utils/model/agentTypes';

export type AgentAvailabilityFilter =
  'all' | 'online' | 'needs_auth' | 'connection_failed' | 'protocol_error' | 'not_detected' | 'disabled';

const isProtocolError = (agent: ManagedAgent): boolean =>
  agent.last_check_error_code === 'acp_init_failed' ||
  agent.last_check_error_code === 'protocol_error' ||
  agent.last_check_error_code === 'rpc_error';

const matchesFilter = (agent: ManagedAgent, filter: AgentAvailabilityFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'disabled') return agent.enabled === false;
  if (agent.enabled === false) return false;
  if (filter === 'needs_auth') return agent.status === 'offline' && agent.last_check_error_code === 'auth_required';
  if (filter === 'protocol_error') return agent.status === 'offline' && isProtocolError(agent);
  if (filter === 'connection_failed') {
    return agent.status === 'offline' && agent.last_check_error_code !== 'auth_required' && !isProtocolError(agent);
  }
  if (filter === 'not_detected') return agent.status === 'missing' || agent.status === 'unchecked';
  return agent.status === 'online';
};

export const getAgentAvailabilityFilterStats = (agents: ManagedAgent[]) => ({
  all: agents.length,
  online: agents.filter((agent) => matchesFilter(agent, 'online')).length,
  needs_auth: agents.filter((agent) => matchesFilter(agent, 'needs_auth')).length,
  connection_failed: agents.filter((agent) => matchesFilter(agent, 'connection_failed')).length,
  protocol_error: agents.filter((agent) => matchesFilter(agent, 'protocol_error')).length,
  not_detected: agents.filter((agent) => matchesFilter(agent, 'not_detected')).length,
  disabled: agents.filter((agent) => matchesFilter(agent, 'disabled')).length,
});

export const filterAgentsByAvailability = (agents: ManagedAgent[], filter: AgentAvailabilityFilter): ManagedAgent[] => {
  return agents.filter((agent) => matchesFilter(agent, filter));
};
