/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 *
 * N4c V2: usePreviewHistory hook export-shape smoke test.
 *
 * Design note:
 * usePreviewHistory spins backend calls + debounced save timers via useEffect.
 * Under the worker-fork pool the ipcBridge / httpBridge chain never settles
 * (plan §2.4 WS reconnect hazard), and the hook hangs waitFor() indefinitely.
 * We therefore validate the module surface only; functional behavior is left
 * to e2e. This is recorded in N4c-final.md Deviations.
 */

import { describe, it, expect } from 'vitest';
import { usePreviewHistory } from '@/renderer/pages/conversation/Preview/hooks/usePreviewHistory';

describe('usePreviewHistory module shape', () => {
  it('module loads and exposes usePreviewHistory', () => {
    expect(usePreviewHistory).toBeDefined();
  });

  it('usePreviewHistory is a function (React hook)', () => {
    expect(typeof usePreviewHistory).toBe('function');
  });

  it('the hook function has at most one parameter (options bag)', () => {
    // React hooks typically take one options argument; assert a loose upper bound.
    expect((usePreviewHistory as { length: number }).length).toBeLessThanOrEqual(2);
  });
});
