import type { HttpRequestOptions } from './httpBridge';

export const ASSET_COLLABORATION_PROTOCOL_VERSION = '1.0.0';
export const ASSET_COLLABORATION_PROTOCOL_HEADER = 'x-tjuae-asset-protocol';

/**
 * Every asset collaboration request carries an explicit protocol identity.
 * The protocol discovery endpoint deliberately does not use these options.
 */
export const ASSET_PROTOCOL_REQUEST_OPTIONS = {
  redactBody: true,
  headers: {
    [ASSET_COLLABORATION_PROTOCOL_HEADER]: ASSET_COLLABORATION_PROTOCOL_VERSION,
  },
} as const satisfies HttpRequestOptions;
