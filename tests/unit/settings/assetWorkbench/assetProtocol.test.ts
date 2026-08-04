import {
  ASSET_COLLABORATION_PROTOCOL_VERSION,
  REQUIRED_ASSET_COLLABORATION_CAPABILITIES,
  validateAssetCollaborationProtocol,
} from '@/renderer/pages/settings/Assets/components/assetProtocol';
import { describe, expect, it } from 'vitest';

describe('asset collaboration protocol gate', () => {
  const expectedBuildIdentifier = '0.2.0';

  it('accepts the complete v1 protocol explicitly advertised by Core', () => {
    expect(
      validateAssetCollaborationProtocol(
        {
          protocolVersion: ASSET_COLLABORATION_PROTOCOL_VERSION,
          buildIdentifier: expectedBuildIdentifier,
          capabilities: [...REQUIRED_ASSET_COLLABORATION_CAPABILITIES],
        },
        expectedBuildIdentifier
      )
    ).toEqual({ compatible: true });
  });

  it('rejects a Core with a different protocol version instead of selecting a legacy flow', () => {
    expect(
      validateAssetCollaborationProtocol(
        {
          protocolVersion: '0.9.0',
          buildIdentifier: expectedBuildIdentifier,
          capabilities: [...REQUIRED_ASSET_COLLABORATION_CAPABILITIES],
        },
        expectedBuildIdentifier
      )
    ).toEqual({ compatible: false, reason: 'versionMismatch' });
  });

  it('rejects a stale Core build even when its asset protocol and capabilities match', () => {
    expect(
      validateAssetCollaborationProtocol(
        {
          protocolVersion: ASSET_COLLABORATION_PROTOCOL_VERSION,
          buildIdentifier: '0.1.0',
          capabilities: [...REQUIRED_ASSET_COLLABORATION_CAPABILITIES],
        },
        expectedBuildIdentifier
      )
    ).toEqual({
      compatible: false,
      reason: 'buildMismatch',
      expectedBuildIdentifier,
      actualBuildIdentifier: '0.1.0',
    });
  });

  it('rejects a Core that omits a required capability', () => {
    expect(
      validateAssetCollaborationProtocol(
        {
          protocolVersion: ASSET_COLLABORATION_PROTOCOL_VERSION,
          buildIdentifier: expectedBuildIdentifier,
          capabilities: REQUIRED_ASSET_COLLABORATION_CAPABILITIES.slice(0, -1),
        },
        expectedBuildIdentifier
      )
    ).toEqual({ compatible: false, reason: 'capabilityMissing' });
  });
});
