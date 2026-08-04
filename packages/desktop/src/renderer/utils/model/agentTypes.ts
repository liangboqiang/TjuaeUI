/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TFunction } from 'i18next';

/**
 * SWR key for the Engine settings management view (`/api/engines/management`).
 *
 * Phase 2 removed the renderer-side detected-agent candidate cache; business
 * surfaces now consume assistants only. The management view keeps its own
 * diagnostics cache so disabled/missing rows remain visible for troubleshooting.
 */
export const MANAGED_ENGINES_SWR_KEY = 'engines.managed';

/** Type of an agent. */
export type AgentType = 'acp' | 'a2a' | 'remote' | 'tjuaecli' | 'openclaw-gateway' | 'nanobot';

/** Source tier of an agent row, mirroring backend `agent_source` enum. */
export type AgentSource = 'internal' | 'builtin' | 'extension' | 'custom';

export type AgentManagementStatus = 'online' | 'offline' | 'missing' | 'unchecked';
export type AgentSnapshotCheckStatus = 'online' | 'offline';
export type AgentSnapshotCheckKind = 'startup' | 'scheduled' | 'manual' | 'session';
export type AgentDiagnosticRunState = 'running' | 'completed';
export type AgentDiagnosticRun = {
  run_id: string;
  trigger: AgentSnapshotCheckKind;
  state: AgentDiagnosticRunState;
  total: number;
  completed: number;
  online: number;
  needs_attention: number;
  missing: number;
  started_at: number;
  finished_at?: number;
};
export type AgentDiagnosticsChangedPayload = {
  run: AgentDiagnosticRun;
  agent?: ManagedAgent;
};
export type AgentManagementErrorDetails = {
  code?: string;
  command?: string;
  resource?: string;
  agent_name?: string;
  backend?: string;
};

export type AgentModeOption = {
  value: string;
  label: string;
  description?: string;
};

/** Source-specific bookkeeping (how to probe, how to upgrade). */
export type AgentSourceInfo = {
  binary_name?: string;
  bridge_binary?: string;
  hub_package_id?: string;
  version?: string;
};

/** Environment variable entry passed to a spawned agent process. */
export type AgentEnvEntry = {
  name: string;
  value: string;
  description?: string;
};

/**
 * Adapter-side behaviour switches. New flags are added here by extending
 * the struct on the backend — the frontend should read them defensively
 * because older rows may not have every field populated.
 *
 * Whether the agent supports session/load is NOT in this bag — read
 * `handshake.agent_capabilities.load_session` instead, since the CLI
 * advertises that during init.
 */
export type BehaviorPolicy = {
  supports_side_question?: boolean;
};

/**
 * Handshake-derived fields captured from the ACP init/session-response.
 * Each field is opaque JSON the backend passes through verbatim; typing
 * happens in whatever call site actually consumes it.
 */
export type AgentHandshake = {
  agent_capabilities?: unknown;
  auth_methods?: unknown;
  config_options?: unknown;
  available_modes?: unknown;
  available_models?: unknown;
  available_commands?: unknown;
};

/** Unified agent metadata persisted in the backend `agent_metadata` table. */
export type AgentMetadata = {
  id: string;
  icon?: string;
  avatar?: string;
  custom_agent_id?: string;
  name: string;
  name_i18n?: Record<string, string>;
  description?: string;
  description_i18n?: Record<string, string>;

  /** Vendor label (e.g. "claude"). Absent for agents without vendor grouping. */
  backend?: string;
  /** Top-level runtime discriminant: "acp" | "remote" | "nanobot" | "tjuaecli" | … */
  agent_type: AgentType;
  agent_source: AgentSource;
  agent_source_info?: AgentSourceInfo;

  enabled: boolean;
  /** True iff the backend resolved the spawn command on `$PATH` at hydrate time. */
  available: boolean;
  /** True when the management view resolved the agent command on `$PATH`. */
  installed?: boolean;
  isExtension?: boolean;
  /** True when the agent supports team mode (MCP stdio capable). Computed by backend. */
  team_capable?: boolean;
  /** Stable catalog ordering. */
  sort_order: number;
  /** Derived status used by the Agent settings management view. */
  status?: AgentManagementStatus;
  /** True when the agent has a command_override set (requires auth). */
  has_command_override?: boolean;
  /** Count of environment variable overrides set. */
  env_override_key_count?: number;

  /** Pre-resolution spawn command as stored in the catalog (e.g. "bun"). */
  command?: string;
  args?: string[];
  env?: AgentEnvEntry[];
  native_skills_dirs?: string[];

  behavior_policy?: BehaviorPolicy;

  /** Native mode id that TjuaeUI's legacy `yolo` / `yoloNoSandbox`
   *  aliases resolve to before calling `session/set_mode`. Absent
   *  when the backend has no yolo equivalent. */
  yolo_id?: string;

  last_check_status?: AgentSnapshotCheckStatus;
  last_check_kind?: AgentSnapshotCheckKind;
  last_check_error_code?: string;
  last_check_error_message?: string;
  last_check_error_details?: AgentManagementErrorDetails;
  last_check_guidance?: string;
  last_check_latency_ms?: number;
  last_check_at?: number;
  last_success_at?: number;
  last_failure_at?: number;

  handshake?: AgentHandshake;
};

/**
 * Agent Settings diagnostics row returned by `/api/agents/management`.
 *
 * This is intentionally separate from `AgentMetadata`: the management surface
 * needs disabled/missing rows plus diagnostic snapshots, while business
 * surfaces no longer consume `/api/agents` directly.
 */
export type ManagedAgent = Omit<AgentMetadata, 'available' | 'handshake'> & {
  installed: boolean;
  status: AgentManagementStatus;
  config_options?: unknown;
  available_modes?: unknown;
  available_models?: unknown;
  available_commands?: unknown;
  handshake?: AgentHandshake;
};

/** Engine-management read model. The underlying registry still uses agent protocol metadata internally. */
export type ManagedEngine = ManagedAgent;

/**
 * Fetcher for MANAGED_ENGINES_SWR_KEY — the Engine settings management view.
 * Hits `/api/engines/management` so user-disabled and missing rows remain
 * visible for diagnostics and re-enable/test-connection actions. Engine
 * selectors also use this catalog so `online` / `unchecked` / `missing` /
 * `offline` semantics stay consistent with the Agent settings page.
 */
export async function fetchManagedEngines(): Promise<ManagedEngine[]> {
  try {
    const agents = await ipcBridge.acpConversation.getManagedEngines.invoke();
    if (Array.isArray(agents)) {
      return agents as ManagedEngine[];
    }
  } catch {
    // fallback to empty
  }
  return [];
}

const getAgentManagementErrorDetails = (details: unknown): AgentManagementErrorDetails => {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return {};
  }
  return details as AgentManagementErrorDetails;
};

export function formatManagedAgentDiagnosticMessage(t: TFunction, agent: ManagedAgent): string {
  const fallback = t('settings.engineManagement.testConnectionUnavailable', { name: agent.name });
  const details = getAgentManagementErrorDetails(agent.last_check_error_details);
  const command = details.command || agent.command || agent.backend || agent.name;
  const resource = details.resource || agent.backend || agent.name;

  switch (agent.last_check_error_code) {
    case 'command_not_found':
    case 'bridge_missing':
    case 'primary_missing':
    case 'command_missing':
      return t(`settings.engineManagement.errorCodes.${agent.last_check_error_code}`, {
        command,
        defaultValue: fallback,
      });
    case 'acp_init_failed':
    case 'auth_required':
    case 'health_check_failed':
    case 'session_send_failed':
    case 'no_provider':
    case 'disabled':
    case 'no_command':
      return t(`settings.engineManagement.errorCodes.${agent.last_check_error_code}`, {
        name: agent.name,
        backend: agent.backend || details.backend || agent.name,
        defaultValue: fallback,
      });
    case 'managed_runtime_unavailable':
      return t('settings.engineManagement.errorCodes.managed_runtime_unavailable', {
        resource,
        defaultValue: fallback,
      });
    case 'version_probe_failed':
    case 'version_probe_timeout':
    case 'process_start_failed':
    case 'connection_timeout':
    case 'setup_rejected':
    case 'session_create_failed':
    case 'protocol_incompatible':
    case 'a2a_protocol_error':
    case 'a2a_card_invalid':
    case 'a2a_version_unsupported':
    case 'configuration_missing':
    case 'a2a_origin_untrusted':
    case 'a2a_auth_required':
    case 'a2a_network_blocked':
    case 'a2a_connection_failed':
    case 'diagnostic_workspace_failed':
    case 'catalog_load_failed':
    case 'runtime_unavailable':
    case 'unsupported_backend':
    case 'package_lock_invalid':
      return t(`settings.engineManagement.errorCodes.${agent.last_check_error_code}`, {
        name: agent.name,
        defaultValue: fallback,
      });
    default:
      return fallback;
  }
}

/**
 * Extract the list of MCP transport types an agent supports.
 *
 * Reads `handshake.agent_capabilities.mcp_capabilities.{stdio,http,sse}`
 * (populated by the ACP init response). Returns `undefined` when the
 * agent has not completed a handshake — callers should treat that as
 * "unknown" rather than "nothing supported".
 */
export function getSupportedMcpTransports(agent: AgentMetadata): string[] | undefined {
  const caps = (agent.handshake?.agent_capabilities as { mcp_capabilities?: unknown } | undefined)?.mcp_capabilities;
  if (!caps || typeof caps !== 'object') {
    return undefined;
  }
  const flags = caps as { stdio?: unknown; http?: unknown; sse?: unknown };
  const transports: string[] = [];
  if (flags.stdio === true) transports.push('stdio');
  if (flags.http === true) transports.push('http');
  if (flags.sse === true) transports.push('sse');
  return transports;
}
