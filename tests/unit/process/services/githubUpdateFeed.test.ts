
import { describe, expect, it, vi } from 'vitest';
import { buildGitHubFeedOptions, GITHUB_UPDATE_REPOSITORY } from '@/process/services/githubUpdateFeed';

describe('GitHub update feed options', () => {
  it('uses the TjuaeUI GitHub Releases repository', () => {
    const options = buildGitHubFeedOptions();

    expect(options).toEqual({
      provider: 'github',
      owner: 'liangboqiang',
      repo: 'TjuaeUI',
    });
    expect(GITHUB_UPDATE_REPOSITORY).toEqual({
      owner: 'liangboqiang',
      repo: 'TjuaeUI',
    });
  });
});
