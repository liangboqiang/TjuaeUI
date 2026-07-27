/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 *
 * Locks the neutral MODEL_PLATFORMS entry points without giving any provider
 * a promotional position.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_PLATFORM_VALUE, MODEL_PLATFORMS } from '@renderer/utils/model/modelPlatforms';

describe('MODEL_PLATFORMS ordering', () => {
  it('keeps Custom first followed by protocol-oriented platform choices', () => {
    const values = MODEL_PLATFORMS.map((p) => p.value);
    expect(values.slice(0, 4)).toEqual(['custom', 'new-api', 'gemini', 'gemini-vertex-ai']);
  });

  it('defaults the add-model modal platform to the first list entry', () => {
    expect(DEFAULT_PLATFORM_VALUE).toBe(MODEL_PLATFORMS[0].value);
    expect(DEFAULT_PLATFORM_VALUE).toBe('custom');
  });

  it('defines each Moonshot entry exactly once', () => {
    const moonshotEntries = MODEL_PLATFORMS.filter((p) => p.value.startsWith('Moonshot'));
    expect(moonshotEntries.map((p) => p.value)).toEqual(['Moonshot', 'Moonshot-Global']);
    expect(moonshotEntries.map((p) => p.base_url)).toEqual([
      'https://api.moonshot.cn/v1',
      'https://api.moonshot.ai/v1',
    ]);
  });
});
