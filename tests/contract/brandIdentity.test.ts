/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const LEGAL_ATTRIBUTION_FILE = 'UPSTREAM.md';
const GENERATED_HASH_FILE = 'bun.lock';
const RETIRED_LOGO_SHA256 = '9c053c765a4e47184b3f642b8bb51e587c6ba8b082e939a54af79d11181ef970';
const CANONICAL_VECTOR_LOGO_ASSET = 'packages/desktop/src/renderer/assets/logos/brand/app.svg';
const RETIRED_RENDERER_RASTER_LOGO_ASSET = 'packages/desktop/src/renderer/assets/logos/brand/app.png';
const VECTOR_LOGO_ENTRY_POINTS = [
  'packages/desktop/src/renderer/components/layout/Layout.tsx',
  'packages/desktop/src/renderer/index.html',
  'packages/desktop/src/renderer/pages/login/index.tsx',
  'packages/desktop/src/renderer/utils/model/assistantAvatar.ts',
  'readme.md',
] as const;
const GENERATED_RASTER_LOGO_ASSETS = {
  'mobile/assets/images/icon.png': {
    width: 1024,
    height: 1024,
  },
  'public/pwa/icon-180.png': {
    width: 180,
    height: 180,
  },
  'public/pwa/icon-192.png': {
    width: 192,
    height: 192,
  },
  'public/pwa/icon-512.png': {
    width: 512,
    height: 512,
  },
  'resources/app.png': {
    width: 512,
    height: 512,
  },
  'resources/app_dev.png': {
    width: 512,
    height: 512,
  },
  'resources/icon.png': {
    width: 512,
    height: 512,
  },
} as const;
const GENERATED_NATIVE_LOGO_ASSETS = ['resources/app.ico', 'resources/app.icns'] as const;

const getTrackedFiles = (): string[] =>
  execFileSync('git', ['ls-files', '-z'], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);

const sha256 = (content: Buffer): string => createHash('sha256').update(content).digest('hex');

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
  it('ships one circular vector logo and exact generated derivatives for every product surface', async () => {
    const vectorLogo = fs.readFileSync(path.join(REPOSITORY_ROOT, CANONICAL_VECTOR_LOGO_ASSET), 'utf8');

    expect(vectorLogo).toContain('<svg');
    expect(vectorLogo).toContain('viewBox="128 128 768 768"');
    expect(vectorLogo).toContain('<clipPath id="brand-logo-circle">');
    expect(vectorLogo).toContain('<circle cx="512" cy="512" r="384"');
    expect(vectorLogo).toContain('<g clip-path="url(#brand-logo-circle)">');
    expect(vectorLogo).toContain('<path');
    expect(vectorLogo).not.toContain('<image');
    expect(vectorLogo).not.toContain('data:image');
    expect(fs.existsSync(path.join(REPOSITORY_ROOT, RETIRED_RENDERER_RASTER_LOGO_ASSET))).toBe(false);
    expect(fs.readFileSync(path.join(REPOSITORY_ROOT, 'public/pwa/icon.svg'), 'utf8')).toBe(vectorLogo);
    expect(fs.readFileSync(path.join(REPOSITORY_ROOT, 'public/manifest.webmanifest'), 'utf8')).toContain(
      './pwa/icon.svg'
    );

    for (const relativePath of VECTOR_LOGO_ENTRY_POINTS) {
      const entryPoint = fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), 'utf8');
      expect(entryPoint).toContain('app.svg');
      expect(entryPoint).not.toContain('app.png');
    }

    execFileSync(process.execPath, [path.join(REPOSITORY_ROOT, 'scripts/generate-brand-assets.js'), '--check'], {
      cwd: REPOSITORY_ROOT,
      stdio: 'pipe',
    });

    await Promise.all(
      Object.entries(GENERATED_RASTER_LOGO_ASSETS).map(async ([relativePath, expected]) => {
        const content = fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath));
        const { data, info } = await sharp(content).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        expect(info.width, relativePath).toBe(expected.width);
        expect(info.height, relativePath).toBe(expected.height);

        const alphaAt = (x: number, y: number): number => data[(y * info.width + x) * info.channels + 3];
        expect(alphaAt(0, 0), `${relativePath} top-left corner`).toBe(0);
        expect(alphaAt(info.width - 1, 0), `${relativePath} top-right corner`).toBe(0);
        expect(alphaAt(0, info.height - 1), `${relativePath} bottom-left corner`).toBe(0);
        expect(alphaAt(info.width - 1, info.height - 1), `${relativePath} bottom-right corner`).toBe(0);
        expect(alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2)), `${relativePath} center`).toBe(255);
      })
    );

    for (const relativePath of GENERATED_NATIVE_LOGO_ASSETS) {
      expect(fs.statSync(path.join(REPOSITORY_ROOT, relativePath)).size, relativePath).toBeGreaterThan(0);
    }
    expect(fs.readFileSync(path.join(REPOSITORY_ROOT, 'resources/app.ico')).readUInt16LE(4)).toBe(7);
    expect(fs.readFileSync(path.join(REPOSITORY_ROOT, 'resources/app.icns')).subarray(0, 4).toString('ascii')).toBe(
      'icns'
    );
  });

  it('contains no retired application logo payload under another tracked image path', () => {
    const violations = getTrackedFiles()
      .filter((relativePath) => /\.(?:icns|ico|jpe?g|png|webp)$/i.test(relativePath))
      .filter((relativePath) => fs.existsSync(path.join(REPOSITORY_ROOT, relativePath)))
      .filter(
        (relativePath) => sha256(fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath))) === RETIRED_LOGO_SHA256
      )
      .map((relativePath) => relativePath.replaceAll('\\', '/'));

    expect(violations).toEqual([]);
  });

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
