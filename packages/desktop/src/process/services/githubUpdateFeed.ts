export const GITHUB_UPDATE_REPOSITORY = {
  owner: 'liangboqiang',
  repo: 'TjuaeUI',
} as const;

export function buildGitHubFeedOptions() {
  return {
    provider: 'github' as const,
    ...GITHUB_UPDATE_REPOSITORY,
  };
}
