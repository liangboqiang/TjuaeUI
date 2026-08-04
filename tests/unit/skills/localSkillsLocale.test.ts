import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const localeDir = path.join(process.cwd(), 'packages/desktop/src/renderer/services/i18n/locales');
const requiredLocalSkillKeys = [
  'description',
  'noSkills',
  'fetchError',
  'deleteSuccess',
  'deleteError',
  'deleteConfirmTitle',
  'deleteConfirmContent',
  'batchManage',
  'batchSelectedCount',
  'batchDeleteAction',
  'batchDeleteConfirmTitle',
  'batchDeleteConfirmContent',
  'batchDeleteSuccess',
  'batchDeletePartial',
  'usedByCount',
  'manageLocally',
  'searchPlaceholder',
  'noSearchResults',
  'customHint',
];

const removedImportExportKeys = [
  'manualImport',
  'importAll',
  'exportTo',
  'importHistoryTitle',
  'importErrors',
  'manageInHub',
];

const assistantA2aKeys = [
  'assistantA2aRemoteSection',
  'assistantA2aRemoteHint',
  'assistantA2aSyncCard',
  'assistantA2aSyncSuccess',
  'assistantA2aLoadFailed',
  'assistantA2aNoCard',
  'assistantA2aLocalAssetsDisabled',
  'assistantA2aEndpoint',
  'assistantA2aTenant',
  'assistantA2aInputModes',
  'assistantA2aOutputModes',
  'assistantA2aSecurity',
  'assistantA2aConfiguredAuth',
  'assistantA2aNoAuthentication',
  'assistantA2aInterfacesTitle',
  'assistantA2aCapabilities',
  'assistantA2aSkillsTitle',
  'assistantA2aNoSkills',
  'assistantA2aNoValue',
];

const flattenStrings = (value: unknown, prefix = ''): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value).reduce<Record<string, string>>((result, [key, nested]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof nested === 'string') result[nextKey] = nested;
    else Object.assign(result, flattenStrings(nested, nextKey));
    return result;
  }, {});
};

describe('local skill locale copy', () => {
  const localeFiles = fs
    .readdirSync(localeDir)
    .map((locale) => path.join(localeDir, locale, 'settings.json'))
    .filter((file) => fs.existsSync(file));

  it('defines the complete local Core skill experience for every locale', () => {
    for (const file of localeFiles) {
      const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const key of requiredLocalSkillKeys) {
        expect(settings.localSkills, `${file}:${key}`).toHaveProperty(key);
        expect(settings.localSkills[key], `${file}:${key}`).toBeTruthy();
      }
    }
  });

  it('does not retain the removed import/export or Skills Hub vocabulary', () => {
    for (const file of localeFiles) {
      const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(settings, file).not.toHaveProperty('skillsHub');
      expect(settings, file).not.toHaveProperty('assetHub');
      expect(settings.engineManagement, file).not.toHaveProperty('officialAgents');
      for (const key of removedImportExportKeys) {
        expect(settings.localSkills, `${file}:${key}`).not.toHaveProperty(key);
      }
    }
  });

  it('does not fall back to English for the local-library guidance in translated locales', () => {
    const english = JSON.parse(fs.readFileSync(path.join(localeDir, 'en-US', 'settings.json'), 'utf8')).localSkills;
    for (const file of localeFiles.filter((entry) => !entry.includes(`${path.sep}en-US${path.sep}`))) {
      const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const key of ['description', 'noSkills', 'customHint']) {
        expect(settings.localSkills[key], `${file}:${key}`).not.toBe(english[key]);
      }
    }
  });

  it('keeps collaboration and A2A copy genuinely localized instead of cloning the English block', () => {
    const english = JSON.parse(fs.readFileSync(path.join(localeDir, 'en-US', 'settings.json'), 'utf8'));
    const englishWorkbench = flattenStrings(english.assetWorkbench);
    const englishPublish = flattenStrings(english.assetPublish);

    for (const file of localeFiles.filter((entry) => !entry.includes(`${path.sep}en-US${path.sep}`))) {
      const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const key of assistantA2aKeys) {
        expect(settings[key], `${file}:${key}`).toBeTruthy();
        expect(settings[key], `${file}:${key}`).not.toBe(english[key]);
      }

      const workbench = flattenStrings(settings.assetWorkbench);
      const publish = flattenStrings(settings.assetPublish);
      const unchangedWorkbenchKeys = Object.keys(englishWorkbench).filter(
        (key) => workbench[key] === englishWorkbench[key]
      );
      const unchangedPublishKeys = Object.keys(englishPublish).filter((key) => publish[key] === englishPublish[key]);
      expect(unchangedWorkbenchKeys.length, `${file}:assetWorkbench`).toBeLessThanOrEqual(10);
      expect(unchangedPublishKeys.length, `${file}:assetPublish`).toBeLessThanOrEqual(1);
      expect(settings.assistantA2aLoadFailed, file).not.toContain('{{error}}');
    }
  });
});
