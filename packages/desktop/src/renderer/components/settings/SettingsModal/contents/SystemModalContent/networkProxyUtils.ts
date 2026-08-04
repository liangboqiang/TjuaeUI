/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

export const DEFAULT_NETWORK_PROXY_BYPASS = 'localhost,127.0.0.1,::1';

export const normalizeNetworkProxyUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed || /[\r\n]/u.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `http://${trimmed}`);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
      return null;
    }
    if ((parsed.pathname && parsed.pathname !== '/') || parsed.search || parsed.hash) {
      return null;
    }
    return parsed.toString().replace(/\/$/u, '');
  } catch {
    return null;
  }
};
