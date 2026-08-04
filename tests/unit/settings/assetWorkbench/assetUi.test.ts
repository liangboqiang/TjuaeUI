import type { AssetDetail } from '@/common/types/agent/assets';
import {
  getMarketStatusPresentation,
  getRuntimeStatePresentation,
  resolveDefaultAssetFile,
  resolveDefaultMarketAssetFile,
} from '@/renderer/pages/settings/Assets/components/assetUi';
import { describe, expect, it } from 'vitest';

const detail = (overrides: Partial<AssetDetail>): AssetDetail =>
  ({
    id: 'asset',
    kind: 'skill',
    displayName: 'Asset',
    origin: 'local',
    trust: 'community',
    scope: 'user',
    editability: 'full',
    definitionDigest: 'sha256-definition',
    runtimeState: 'inactive',
    allowedActions: ['view', 'edit'],
    createdAt: 1,
    updatedAt: 2,
    contentSource: 'local',
    sourceDigest: 'sha256-source',
    entryFile: 'README.md',
    files: [
      { path: 'README.md', digest: 'readme', size: 1, mediaType: 'text/markdown', text: true },
      { path: 'nested/SKILL.md', digest: 'skill', size: 1, mediaType: 'text/markdown', text: true },
    ],
    ...overrides,
  }) as AssetDetail;

describe('asset workbench presentation rules', () => {
  it('opens SKILL.md first for skills even when a different entry is declared', () => {
    expect(resolveDefaultAssetFile(detail({}))?.path).toBe('nested/SKILL.md');
  });

  it('falls back to a declared entry for non-skill assets', () => {
    expect(resolveDefaultAssetFile(detail({ kind: 'assistant' }))?.path).toBe('README.md');
  });

  it('uses presence rather than a fabricated sync state when the market asset is not installed', () => {
    expect(
      getMarketStatusPresentation({
        id: 'remote',
        kind: 'skill',
        runtimeId: 'remote',
        dependencies: [],
        displayName: 'Remote',
        description: '',
        version: '1.0.0',
        definitionDigest: 'sha256-remote',
        entryFile: 'SKILL.md',
        packageName: 'package',
        author: 'Tjuae',
        license: 'Apache-2.0',
        trust: 'official',
        status: 'active',
        compatibility: { compatible: true, tjuae: '^1.0.0' },
        sourceRevision: 'revision',
        files: [],
        tags: [],
        presenceState: 'notInstalled',
        allowedActions: ['view', 'install'],
      }).labelKey
    ).toBe('settings.assetWorkbench.presenceStates.notInstalled');
  });

  it('uses the tracked local sync state only after the remote asset is installed', () => {
    expect(
      getMarketStatusPresentation({
        id: 'remote',
        kind: 'skill',
        runtimeId: 'remote',
        dependencies: [],
        displayName: 'Remote',
        description: '',
        version: '1.0.0',
        definitionDigest: 'sha256-remote',
        entryFile: 'SKILL.md',
        packageName: 'package',
        author: 'Tjuae',
        license: 'Apache-2.0',
        trust: 'official',
        status: 'active',
        compatibility: { compatible: true, tjuae: '^1.0.0' },
        sourceRevision: 'revision',
        files: [],
        tags: [],
        presenceState: 'installed',
        syncState: 'remoteUpdated',
        allowedActions: ['view', 'sync'],
        local: { localAssetId: 'skill:remote', localDigest: 'sha256-local' },
      }).labelKey
    ).toBe('settings.assetWorkbench.syncStates.remoteUpdated');
  });

  it('opens SKILL.md before the declared entry in a remote skill', () => {
    expect(
      resolveDefaultMarketAssetFile({
        id: 'remote',
        kind: 'skill',
        runtimeId: 'remote',
        dependencies: [],
        displayName: 'Remote',
        description: '',
        version: '1.0.0',
        definitionDigest: 'sha256-remote',
        entryFile: 'README.md',
        packageName: 'package',
        author: 'Tjuae',
        license: 'Apache-2.0',
        trust: 'official',
        status: 'active',
        compatibility: { compatible: true, tjuae: '^1.0.0' },
        sourceRevision: 'revision',
        files: [
          { path: 'README.md', digest: 'readme', size: 1, mediaType: 'text/markdown' },
          { path: 'skills/demo/SKILL.md', digest: 'skill', size: 1, mediaType: 'text/markdown' },
        ],
        tags: [],
        presenceState: 'notInstalled',
        allowedActions: ['view', 'install'],
      })?.path
    ).toBe('skills/demo/SKILL.md');
  });

  it('renders runtime state independently from market synchronization state', () => {
    expect(getRuntimeStatePresentation('active').labelKey).toBe('settings.assetRuntime.states.active');
    expect(getRuntimeStatePresentation('needsRepair').labelKey).toBe('settings.assetRuntime.states.needsRepair');
  });
});
