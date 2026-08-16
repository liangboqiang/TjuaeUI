import type { GitCommitInfo } from '@/common/types/platform/gitWorkspace';

export type GitGraphEdge = {
  from: number;
  to: number;
  color: number;
};

export type GitGraphRow = {
  commit: GitCommitInfo;
  lane: number;
  color: number;
  laneCount: number;
  continuations: GitGraphEdge[];
  parentEdges: GitGraphEdge[];
};

type ActiveLane = {
  tip: string;
  color: number;
};

/**
 * Convert newest-to-oldest `git log` records into deterministic graph lanes.
 * The active-lane model mirrors IDE commit graphs: every parent keeps a lane,
 * merge parents branch into adjacent lanes, and reconnecting histories reuse
 * their existing lane instead of creating duplicate lines.
 */
export const buildGitGraphTopology = (commits: GitCommitInfo[]): GitGraphRow[] => {
  let lanes: ActiveLane[] = [];
  let nextColor = 0;

  return commits.map((commit) => {
    let lane = lanes.findIndex((entry) => entry.tip === commit.hash);
    if (lane < 0) {
      lanes = [{ tip: commit.hash, color: nextColor++ }, ...lanes];
      lane = 0;
    }

    const before = lanes;
    const current = before[lane];
    const next = before.filter((_, index) => index !== lane);

    commit.parents.forEach((parent, parentIndex) => {
      if (next.some((entry) => entry.tip === parent)) return;
      const insertion = Math.min(lane + parentIndex, next.length);
      next.splice(insertion, 0, {
        tip: parent,
        color: parentIndex === 0 ? current.color : nextColor++,
      });
    });

    const continuations = before
      .map((entry, from) => ({ entry, from }))
      .filter(({ from }) => from !== lane)
      .map(({ entry, from }) => ({
        from,
        to: next.findIndex((candidate) => candidate.tip === entry.tip),
        color: entry.color,
      }))
      .filter((edge) => edge.to >= 0);

    const parentEdges = commit.parents
      .map((parent) => {
        const target = next.findIndex((entry) => entry.tip === parent);
        return {
          from: lane,
          to: target,
          color: target >= 0 ? next[target].color : current.color,
        };
      })
      .filter((edge) => edge.to >= 0);

    const row: GitGraphRow = {
      commit,
      lane,
      color: current.color,
      laneCount: Math.max(before.length, next.length, 1),
      continuations,
      parentEdges,
    };
    lanes = next;
    return row;
  });
};
