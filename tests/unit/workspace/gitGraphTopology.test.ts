import type { GitCommitInfo } from '@/common/types/platform/gitWorkspace';
import { buildGitGraphTopology } from '@/renderer/pages/conversation/Workspace/utils/gitGraphTopology';
import { describe, expect, it } from 'vitest';

const commit = (hash: string, parents: string[]): GitCommitInfo => ({
  hash,
  shortHash: hash,
  parents,
  decorations: [],
  author: 'Tjuae',
  authoredAt: 1,
  subject: hash,
});

describe('buildGitGraphTopology', () => {
  it('keeps a linear history in one lane', () => {
    const rows = buildGitGraphTopology([commit('c3', ['c2']), commit('c2', ['c1']), commit('c1', [])]);
    expect(rows.map((row) => row.lane)).toEqual([0, 0, 0]);
    expect(rows.map((row) => row.laneCount)).toEqual([1, 1, 1]);
  });

  it('creates and reconnects a second lane for a merge parent', () => {
    const rows = buildGitGraphTopology([
      commit('merge', ['main-parent', 'topic-parent']),
      commit('main-parent', ['base']),
      commit('topic-parent', ['base']),
      commit('base', []),
    ]);

    expect(rows[0]?.parentEdges).toHaveLength(2);
    expect(rows[0]?.laneCount).toBe(2);
    expect(rows.some((row) => row.lane === 1)).toBe(true);
    expect(rows.at(-1)?.commit.hash).toBe('base');
  });
});
