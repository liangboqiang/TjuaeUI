/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { isDiscoverA2aAgentResponse, normalizeDiscoverA2aAgentResponse } from '@/renderer/utils/model/a2aTypes';
import { describe, expect, it } from 'vitest';

const validResponse = {
  card_url: 'https://agent.example/.well-known/agent-card.json',
  base_url: 'https://agent.example',
  compatibility_mode: 'v1',
  card: {
    name: 'Example Agent',
    description: 'Example',
    agent_version: '1.0.0',
    protocol_version: '1.0',
    selected_binding: 'json_rpc',
    selected_interface_url: 'https://agent.example',
    supported_interfaces: [
      {
        url: 'https://agent.example',
        binding: 'json_rpc',
        protocol_version: '1.0',
      },
    ],
    supported_bindings: ['json_rpc'],
    default_input_modes: ['text/plain'],
    default_output_modes: ['text/plain'],
    skills: [],
    capabilities: {},
    security_schemes: {},
    security_requirements: [],
    required_extensions: [],
  },
  requires_authentication: false,
  requires_origin_confirmation: false,
  warnings: [],
};

describe('isDiscoverA2aAgentResponse', () => {
  it('accepts the current discovery contract', () => {
    expect(isDiscoverA2aAgentResponse(validResponse)).toBe(true);
  });

  it('normalizes absent optional security metadata from an older Core build', () => {
    const normalized = normalizeDiscoverA2aAgentResponse({
      ...validResponse,
      card: {
        ...validResponse.card,
        capabilities: null,
        security_schemes: null,
        security_requirements: null,
        required_extensions: null,
      },
    });

    expect(normalized?.card.capabilities).toEqual({});
    expect(normalized?.card.security_schemes).toEqual({});
    expect(normalized?.card.security_requirements).toEqual([]);
    expect(normalized?.card.required_extensions).toEqual([]);
  });

  it.each([
    [],
    { success: true, data: [] },
    { ...validResponse, card: undefined },
    { ...validResponse, card: { ...validResponse.card, name: undefined } },
  ])('rejects an incompatible backend response without dereferencing it', (response) => {
    expect(isDiscoverA2aAgentResponse(response)).toBe(false);
  });
});
