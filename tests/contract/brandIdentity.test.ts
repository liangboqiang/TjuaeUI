
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const LEGAL_ATTRIBUTION_FILE = 'UPSTREAM.md';
const GENERATED_HASH_FILE = 'bun.lock';

const getTrackedFiles = (): string[] =>
  execFileSync('git', ['ls-files', '-z'], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);

const buildOldProductToken = (): string => ['ai', 'on'].join('');
const buildOldOrganizationToken = (): string => ['iOffice', 'AI'].join('');
const buildRetiredIntegrationTokens = (): string[] => [
  ['sen', 'try'].join(''),
  ['code', 'cov'].join(''),
  ['tele', 'metry'].join(''),
  ['office', 'cli'].join(''),
  ['d.office', 'cli.ai'].join(''),
  ['analytics', 'id'].join(''),
  ['molt', 'book'].join(''),
  ['openclaw', '-setup'].join(''),
  ['gpt', '-review'].join(''),
  ['gpt', '-pr-assessment'].join(''),
  ['call-', 'openai'].join(''),
  ['gather-', 'pr-diff'].join(''),
  ['read-file-', 'contents'].join(''),
  ['secrets.', 'gh_token'].join(''),
  ['cdn.', 'jsdelivr.net'].join(''),
  ['unpkg', '.com'].join(''),
  ['cdnjs.', 'cloudflare.com'].join(''),
  ['bun x ', '--yes'].join(''),
  ['install --global ', 'node-gyp'].join(''),
  ['dist-', 'latest'].join(''),
  ['tjuaeui_hub_', 'tag'].join(''),
  ['bun-version: ', 'latest'].join(''),
];

describe('repository identity contract', () => {
  it('contains no legacy product identity outside the legal attribution record', () => {
    const oldProductToken = buildOldProductToken().toLowerCase();
    const oldOrganizationToken = buildOldOrganizationToken().toLowerCase();
    const pathViolations: string[] = [];
    const contentViolations: string[] = [];

    for (const relativePath of getTrackedFiles()) {
      const normalizedPath = relativePath.replaceAll('\\', '/');
      const normalizedPathLower = normalizedPath.toLowerCase();
      if (normalizedPathLower.includes(oldProductToken) || normalizedPathLower.includes(oldOrganizationToken)) {
        pathViolations.push(normalizedPath);
      }
      if (normalizedPath === LEGAL_ATTRIBUTION_FILE || normalizedPath === GENERATED_HASH_FILE) continue;

      const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
      if (!fs.existsSync(absolutePath)) continue;
      const content = fs.readFileSync(absolutePath);
      if (content.includes(0)) continue;

      const normalizedContent = content.toString('utf8').toLowerCase();
      if (normalizedContent.includes(oldProductToken) || normalizedContent.includes(oldOrganizationToken)) {
        contentViolations.push(normalizedPath);
      }
    }

    expect(pathViolations).toEqual([]);
    expect(contentViolations).toEqual([]);
  });

  it('contains no retired promotional destinations', () => {
    const forbiddenDestinations = [
      ['trend', 'shift.io'].join(''),
      ['discord', '.gg/'].join(''),
      ['x.com/', 'TjuaeUI'].join('').toLowerCase(),
      ['twitter.com/', 'TjuaeUI'].join('').toLowerCase(),
      ['aff', '='].join(''),
    ];
    const violations: string[] = [];

    for (const relativePath of getTrackedFiles()) {
      if (relativePath === LEGAL_ATTRIBUTION_FILE || relativePath === GENERATED_HASH_FILE) continue;
      const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
      if (!fs.existsSync(absolutePath)) continue;
      const content = fs.readFileSync(absolutePath);
      if (content.includes(0)) continue;

      const normalizedContent = content.toString('utf8').toLowerCase();
      if (forbiddenDestinations.some((destination) => normalizedContent.includes(destination))) {
        violations.push(relativePath.replaceAll('\\', '/'));
      }
    }

    expect(violations).toEqual([]);
  });

  it('contains no retired reporting, hosted review automation, or Office document black box', () => {
    const forbiddenTokens = buildRetiredIntegrationTokens().map((token) => token.toLowerCase());
    const retiredReportingName = ['sen', 'try'].join('');
    const retiredReportingPattern = new RegExp(`(?:^|[^a-z])${retiredReportingName}`);
    const violations: string[] = [];
    const containsRetiredToken = (value: string): boolean =>
      forbiddenTokens.some((token) =>
        token === retiredReportingName ? retiredReportingPattern.test(value) : value.includes(token)
      );

    for (const relativePath of getTrackedFiles()) {
      if (relativePath === LEGAL_ATTRIBUTION_FILE || relativePath === GENERATED_HASH_FILE) continue;
      const normalizedPath = relativePath.replaceAll('\\', '/').toLowerCase();
      const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
      if (!fs.existsSync(absolutePath)) continue;
      const content = fs.readFileSync(absolutePath);
      if (content.includes(0)) continue;

      const normalizedContent = content.toString('utf8').toLowerCase();
      if (containsRetiredToken(normalizedPath) || containsRetiredToken(normalizedContent)) {
        violations.push(relativePath.replaceAll('\\', '/'));
      }
    }

    expect(violations).toEqual([]);
  });
});
