import type { ManagedAgent } from '@/renderer/utils/model/agentTypes';

export type AgentAvailabilityFilter = 'all' | 'online' | 'needs_auth' | 'offline' | 'missing' | 'unchecked';

const matchesFilter = (agent: ManagedAgent, filter: AgentAvailabilityFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'needs_auth') return agent.status === 'offline' && agent.last_check_error_code === 'auth_required';
  if (filter === 'offline') return agent.status === 'offline' && agent.last_check_error_code !== 'auth_required';
  return agent.status === filter;
};

export const getAgentAvailabilityFilterStats = (agents: ManagedAgent[]) => ({
  all: agents.length,
  online: agents.filter((agent) => matchesFilter(agent, 'online')).length,
  needs_auth: agents.filter((agent) => matchesFilter(agent, 'needs_auth')).length,
  offline: agents.filter((agent) => matchesFilter(agent, 'offline')).length,
  missing: agents.filter((agent) => matchesFilter(agent, 'missing')).length,
  unchecked: agents.filter((agent) => matchesFilter(agent, 'unchecked')).length,
});

export const filterAgentsByAvailability = (agents: ManagedAgent[], filter: AgentAvailabilityFilter): ManagedAgent[] => {
  return agents.filter((agent) => matchesFilter(agent, filter));
};
