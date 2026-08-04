/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

export type A2aCompatibilityMode = 'v1' | 'v03';
export type A2aBinding = 'json_rpc' | 'http_json' | 'grpc';
export type A2aAuthKind = 'none' | 'bearer' | 'api_key' | 'basic' | 'custom_header' | 'oauth2' | 'oidc' | 'mtls';
export type A2aCredentialLocation = 'header' | 'query' | 'cookie';

export type A2aCredentialInput = {
  kind: A2aAuthKind;
  scheme_name?: string;
  header_name?: string;
  location?: A2aCredentialLocation;
  secret?: string;
  metadata?: Record<string, unknown>;
};

export type A2aConfiguredCredentialSummary = {
  kind: A2aAuthKind;
  scheme_name?: string;
  header_name?: string;
  location?: A2aCredentialLocation;
};

export type A2aOAuthFlowKind = 'authorization_code' | 'device_code' | 'client_credentials';

export type StartA2aOAuthRequest = {
  id: string;
  scheme_name?: string;
  client_id: string;
  client_secret?: string;
  redirect_uri?: string;
  flow?: A2aOAuthFlowKind;
  scopes?: string[];
};

export type StartA2aOAuthResponse = {
  state: string;
  flow: A2aOAuthFlowKind;
  authorization_url?: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  user_code?: string;
  expires_at: number;
  interval_seconds?: number;
};

export type CompleteA2aOAuthRequest = {
  id: string;
  state: string;
  code?: string;
};

export type DiscoverA2aAgentRequest = {
  url: string;
  allow_insecure?: boolean;
  allow_private_network?: boolean;
  compatibility_mode?: A2aCompatibilityMode;
  credential?: A2aCredentialInput;
  credentials?: A2aCredentialInput[];
};

export type CreateA2aAgentRequest = DiscoverA2aAgentRequest & {
  display_name?: string;
  trusted_origin?: string;
};

export type UpdateA2aAgentRequest = {
  id: string;
  url?: string;
  display_name?: string | null;
  allow_insecure?: boolean;
  allow_private_network?: boolean;
  compatibility_mode?: A2aCompatibilityMode;
  credential?: A2aCredentialInput | null;
  credentials?: A2aCredentialInput[];
  clear_credentials?: boolean;
  trusted_origin?: string | null;
};

export type A2aAgentSkillSummary = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  input_modes?: string[];
  output_modes?: string[];
};

export type A2aAgentCardSummary = {
  name: string;
  description: string;
  agent_version: string;
  protocol_version: string;
  selected_binding: A2aBinding;
  selected_interface_url: string;
  selected_tenant?: string;
  supported_interfaces: A2aAgentInterfaceSummary[];
  supported_bindings: A2aBinding[];
  default_input_modes: string[];
  default_output_modes: string[];
  skills: A2aAgentSkillSummary[];
  capabilities: Record<string, unknown>;
  security_schemes: Record<string, unknown>;
  security_requirements: Array<Record<string, string[]>>;
  required_extensions: string[];
};

export type A2aAgentInterfaceSummary = {
  url: string;
  binding: A2aBinding;
  protocol_version: string;
  tenant?: string;
};

export type DiscoverA2aAgentResponse = {
  card_url: string;
  base_url: string;
  compatibility_mode: A2aCompatibilityMode;
  card: A2aAgentCardSummary;
  requires_authentication: boolean;
  requires_origin_confirmation: boolean;
  warnings: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * IPC and HTTP responses cross a runtime boundary, so their compile-time type
 * alone cannot protect the editor from an older or incompatible backend.
 */
export const isDiscoverA2aAgentResponse = (value: unknown): value is DiscoverA2aAgentResponse => {
  if (!isRecord(value) || !isRecord(value.card)) return false;

  const card = value.card;
  return (
    typeof value.card_url === 'string' &&
    typeof value.base_url === 'string' &&
    (value.compatibility_mode === 'v1' || value.compatibility_mode === 'v03') &&
    typeof value.requires_authentication === 'boolean' &&
    typeof value.requires_origin_confirmation === 'boolean' &&
    Array.isArray(value.warnings) &&
    typeof card.name === 'string' &&
    typeof card.description === 'string' &&
    typeof card.agent_version === 'string' &&
    typeof card.protocol_version === 'string' &&
    (card.selected_binding === 'json_rpc' ||
      card.selected_binding === 'http_json' ||
      card.selected_binding === 'grpc') &&
    typeof card.selected_interface_url === 'string' &&
    Array.isArray(card.supported_interfaces) &&
    Array.isArray(card.supported_bindings) &&
    Array.isArray(card.default_input_modes) &&
    Array.isArray(card.default_output_modes) &&
    Array.isArray(card.skills) &&
    isRecord(card.capabilities) &&
    isRecord(card.security_schemes) &&
    Array.isArray(card.security_requirements) &&
    Array.isArray(card.required_extensions)
  );
};

/**
 * Older Core builds serialized absent optional A2A security metadata as null,
 * while the renderer contract intentionally exposes empty collections. Keep
 * this rolling-upgrade boundary tolerant without weakening the strict guard.
 */
export const normalizeDiscoverA2aAgentResponse = (value: unknown): DiscoverA2aAgentResponse | null => {
  if (!isRecord(value) || !isRecord(value.card)) return null;

  const normalized = {
    ...value,
    card: {
      ...value.card,
      capabilities: value.card.capabilities ?? {},
      security_schemes: value.card.security_schemes ?? {},
      security_requirements: value.card.security_requirements ?? [],
      required_extensions: value.card.required_extensions ?? [],
    },
  };

  return isDiscoverA2aAgentResponse(normalized) ? normalized : null;
};

export type A2aAgentResponse = {
  agent_id: string;
  card_url: string;
  base_url: string;
  display_name?: string;
  allow_insecure: boolean;
  allow_private_network: boolean;
  compatibility_mode: A2aCompatibilityMode;
  card?: A2aAgentCardSummary;
  extended_card?: A2aAgentCardSummary;
  has_extended_card: boolean;
  has_credentials: boolean;
  credential_kind?: A2aAuthKind;
  credential_kinds: A2aAuthKind[];
  configured_security_schemes: string[];
  configured_credentials: A2aConfiguredCredentialSummary[];
  etag?: string;
  last_modified?: string;
  cache_expires_at?: number;
  fetched_at?: number;
  signature_status: string;
  trust_status: string;
  created_at: number;
  updated_at: number;
};

export type RegisterA2aPushRequest = {
  id: string;
  task_id: string;
  callback_base_url: string;
  expires_in_seconds?: number;
};

export type A2aPushSubscriptionResponse = {
  id: string;
  agent_id: string;
  task_id: string;
  config_id: string;
  callback_url: string;
  expires_at: number;
  revoked: boolean;
  created_at: number;
  updated_at: number;
};

export type RequestA2aDelegationPermission = {
  id: string;
  parent_task_id: string;
  target_agent_ids: string[];
  scopes: string[];
  expires_in_seconds?: number;
};

export type A2aDelegationPermissionResponse = {
  id: string;
  parent_task_id: string;
  target_agent_ids: string[];
  scopes: string[];
  status: string;
  expires_at: number;
  approved_at?: number;
  revoked_at?: number;
  capability_token?: string;
  created_at: number;
  updated_at: number;
};

export type DelegateA2aTaskRequest = {
  id: string;
  parent_task_id: string;
  target_agent_id: string;
  permission_id: string;
  capability_token: string;
  message: string;
  idempotency_key: string;
};

export type A2aDelegationResponse = {
  id: string;
  parent_task_id: string;
  child_task_id?: string;
  target_agent_id: string;
  permission_id: string;
  state: string;
  context_id?: string;
  last_error_code?: string;
  created_at: number;
  updated_at: number;
};

export type A2aDelegationTaskNode = {
  id: string;
  agent_id: string;
  remote_task_id?: string;
  context_id?: string;
  state: string;
};

export type A2aAuditEventResponse = {
  id: string;
  event_type: string;
  actor_agent_id?: string;
  target_agent_id?: string;
  task_id?: string;
  delegation_id?: string;
  metadata: Record<string, unknown>;
  created_at: number;
};

export type A2aDelegationGraphResponse = {
  root_task_id: string;
  tasks: A2aDelegationTaskNode[];
  delegations: A2aDelegationResponse[];
  audit: A2aAuditEventResponse[];
};
