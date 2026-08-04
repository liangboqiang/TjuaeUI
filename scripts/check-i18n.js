#!/usr/bin/env node
/**
 * i18n 校验脚本。
 * 供提交前钩子检查翻译完整性和一致性。
 *
 * 用法：node scripts/check-i18n.js
 */

const fs = require('fs');
const path = require('path');
const { REQUIRED_MODULES, collectReferenceKeys, getAllKeys } = require('./generate-i18n-types');
const i18nConfig = require('../packages/desktop/src/common/config/i18n-config.json');

const LOCALES_DIR = path.resolve(__dirname, '../packages/desktop/src/renderer/services/i18n/locales');
const I18N_KEYS_DTS = path.resolve(__dirname, '../packages/desktop/src/renderer/services/i18n/i18n-keys.d.ts');
const RENDERER_DIR = path.resolve(__dirname, '../packages/desktop/src/renderer');
const SUPPORTED_LANGUAGES = i18nConfig.supportedLanguages;
const REFERENCE_LANGUAGE = i18nConfig.referenceLanguage;

let hasErrors = false;
let hasWarnings = false;

function logError(message) {
  console.error(`❌ ${message}`);
  hasErrors = true;
}

function logWarning(message) {
  console.warn(`⚠️  ${message}`);
  hasWarnings = true;
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

function extractTypeUnionValues(content, typeName) {
  const match = content.match(new RegExp(`export type ${typeName} =([\\s\\S]*?);`));
  if (!match) {
    return [];
  }

  const values = [];
  const valueRegex = /'([^']+)'/g;
  for (const item of match[1].matchAll(valueRegex)) {
    values.push(item[1]);
  }

  return values;
}

function isSameSet(a, b) {
  if (a.size !== b.size) {
    return false;
  }

  for (const item of a) {
    if (!b.has(item)) {
      return false;
    }
  }

  return true;
}

function checkI18nTypeDefinitionInSync() {
  console.log('\n🧩 正在检查 i18n 键类型定义同步状态……\n');

  if (!fs.existsSync(I18N_KEYS_DTS)) {
    logError(`缺少 i18n 键类型文件：${path.relative(process.cwd(), I18N_KEYS_DTS)}`);
    logError('请运行：bun run i18n:types');
    return;
  }

  const actual = fs.readFileSync(I18N_KEYS_DTS, 'utf-8');
  const actualKeys = new Set(extractTypeUnionValues(actual, 'I18nKey'));
  const expectedKeys = new Set(collectReferenceKeys());

  if (!isSameSet(actualKeys, expectedKeys)) {
    logError(`i18n 键类型文件已过期：${path.relative(process.cwd(), I18N_KEYS_DTS)}`);
    logError('请运行：bun run i18n:types');
    return;
  }

  const actualModules = new Set(extractTypeUnionValues(actual, 'I18nModule'));
  const expectedModules = new Set(REQUIRED_MODULES);
  if (!isSameSet(actualModules, expectedModules)) {
    logError(`i18n 模块类型文件已过期：${path.relative(process.cwd(), I18N_KEYS_DTS)}`);
    logError('请运行：bun run i18n:types');
    return;
  }

  logSuccess('i18n 键类型定义已同步');
}

// 校验目录和文件结构。
function checkDirectoryStructure() {
  console.log('\n📁 正在检查目录结构……\n');

  // 校验每个语言目录。
  for (const lang of SUPPORTED_LANGUAGES) {
    const langDir = path.join(LOCALES_DIR, lang);

    if (!fs.existsSync(langDir)) {
      logError(`缺少语言目录：${lang}`);
      continue;
    }

    logSuccess(`语言目录存在：${lang}`);

    // 校验必要的模块文件。
    for (const moduleName of REQUIRED_MODULES) {
      const moduleFile = path.join(langDir, `${moduleName}.json`);

      if (!fs.existsSync(moduleFile)) {
        logError(`缺少模块文件：${lang}/${moduleName}.json`);
        continue;
      }

      // 校验 JSON 语法。
      try {
        const content = fs.readFileSync(moduleFile, 'utf-8');
        JSON.parse(content);
      } catch (error) {
        logError(`JSON 无效：${lang}/${moduleName}.json - ${error.message}`);
      }
    }

    // 校验 index.ts。
    const indexFile = path.join(langDir, 'index.ts');
    if (!fs.existsSync(indexFile)) {
      logWarning(`缺少索引文件：${lang}/index.ts`);
    }
  }

  // 确保旧的单文件语言 JSON 已删除。
  for (const lang of SUPPORTED_LANGUAGES) {
    const oldFile = path.join(LOCALES_DIR, `${lang}.json`);
    if (fs.existsSync(oldFile)) {
      logError(`发现旧版 JSON 文件，请删除：${lang}.json`);
    }
  }
}

// 校验各语言的翻译键一致性。
function checkTranslationKeys() {
  console.log('\n🔑 正在检查翻译键一致性……\n');

  const referenceLang = REFERENCE_LANGUAGE;
  const referenceKeys = {};

  // 从参考语言收集基准键。
  for (const moduleName of REQUIRED_MODULES) {
    const moduleFile = path.join(LOCALES_DIR, referenceLang, `${moduleName}.json`);
    if (fs.existsSync(moduleFile)) {
      try {
        const content = JSON.parse(fs.readFileSync(moduleFile, 'utf-8'));
        referenceKeys[moduleName] = getAllKeys(content);
      } catch {
        logError(`无法读取参考模块：${referenceLang}/${moduleName}.json`);
      }
    }
  }

  // 按基准校验其他语言。
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang === referenceLang) continue;

    logInfo(`正在检查 ${lang}……`);

    let missingCount = 0;

    for (const moduleName of REQUIRED_MODULES) {
      const moduleFile = path.join(LOCALES_DIR, lang, `${moduleName}.json`);
      const expectedKeys = referenceKeys[moduleName] || [];

      if (fs.existsSync(moduleFile)) {
        try {
          const content = JSON.parse(fs.readFileSync(moduleFile, 'utf-8'));
          const actualKeySet = new Set(getAllKeys(content));

          const missing = expectedKeys.filter((key) => !actualKeySet.has(key));
          missingCount += missing.length;

          if (missing.length > 0) {
            logWarning(
              `${lang}/${moduleName}.json 缺少 ${missing.length} 个键：${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '……' : ''}`
            );
          }
        } catch {
          logError(`无法读取模块：${lang}/${moduleName}.json`);
        }
      }
    }

    const totalKeys = Object.values(referenceKeys).flat().length;
    const missingPercent = totalKeys > 0 ? ((missingCount / totalKeys) * 100).toFixed(1) : '0.0';

    if (missingCount > 0) {
      logWarning(`${lang} 缺少 ${missingCount} 个键（${missingPercent}%）`);
    } else {
      logSuccess(`${lang} 翻译完整`);
    }
  }
}

function collectEmptyValuePaths(obj, prefix = '') {
  const emptyPaths = [];

  if (typeof obj !== 'object' || obj === null) {
    return emptyPaths;
  }

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null) {
      emptyPaths.push(...collectEmptyValuePaths(value, fullKey));
      continue;
    }

    if (typeof value === 'string' && value.trim() === '') {
      emptyPaths.push(fullKey);
    }
  }

  return emptyPaths;
}

// 校验空翻译模块与空字符串值。
function checkEmptyTranslations() {
  console.log('\n📭 正在检查空翻译……\n');

  for (const lang of SUPPORTED_LANGUAGES) {
    for (const moduleName of REQUIRED_MODULES) {
      const moduleFile = path.join(LOCALES_DIR, lang, `${moduleName}.json`);

      if (fs.existsSync(moduleFile)) {
        try {
          const content = fs.readFileSync(moduleFile, 'utf-8');
          const data = JSON.parse(content);

          if (Object.keys(data).length === 0) {
            logWarning(`空模块：${lang}/${moduleName}.json`);
            continue;
          }

          const emptyValuePaths = collectEmptyValuePaths(data);
          if (emptyValuePaths.length > 0) {
            logWarning(
              `${lang}/${moduleName}.json 有 ${emptyValuePaths.length} 个空值：${emptyValuePaths.slice(0, 3).join(', ')}${emptyValuePaths.length > 3 ? '……' : ''}`
            );
          }
        } catch {
          // 其他检查已报告。
        }
      }
    }
  }
}

function collectAllCodeFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'i18n-keys.d.ts') {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'out') {
        continue;
      }
      files.push(...collectAllCodeFiles(fullPath));
      continue;
    }

    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }

  return files;
}

function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function buildReferenceKeySet() {
  const keySet = new Set();

  for (const moduleName of REQUIRED_MODULES) {
    const moduleFile = path.join(LOCALES_DIR, REFERENCE_LANGUAGE, `${moduleName}.json`);
    if (!fs.existsSync(moduleFile)) {
      continue;
    }

    const content = JSON.parse(fs.readFileSync(moduleFile, 'utf-8'));
    const keys = getAllKeys(content);
    for (const key of keys) {
      keySet.add(`${moduleName}.${key}`);
    }
  }

  return keySet;
}

function checkLiteralKeyUsages() {
  console.log('\n🧪 正在检查字面量 t() 键用法……\n');

  const referenceKeySet = buildReferenceKeySet();
  const files = collectAllCodeFiles(RENDERER_DIR);
  const keyRegex = /\b(?:i18n\.)?t\(\s*(['"`])([^'"`]+)\1/g;

  let invalidCount = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const code = stripComments(content);

    for (const match of code.matchAll(keyRegex)) {
      const key = match[2].trim();

      if (!key || key.includes('${') || key.startsWith('http://') || key.startsWith('https://')) {
        continue;
      }

      if (!key.includes('.')) {
        continue;
      }

      if (!referenceKeySet.has(key)) {
        invalidCount += 1;
        logWarning(`未知 i18n 键：${key}（${path.relative(process.cwd(), file)}）`);
      }
    }
  }

  if (invalidCount === 0) {
    logSuccess('渲染进程代码中没有无效的字面量 i18n 键');
  } else {
    logInfo(`发现 ${invalidCount} 个未知字面量 i18n 键（仅警告）`);
  }
}

// 校验 i18n 运行时配置。
function checkIndexConfig() {
  console.log('\n⚙️  正在检查 i18n 配置……\n');

  const indexFile = path.join(__dirname, '../packages/desktop/src/renderer/services/i18n/index.ts');

  if (!fs.existsSync(indexFile)) {
    logError('缺少 i18n 配置文件：packages/desktop/src/renderer/services/i18n/index.ts');
    return;
  }

  const content = fs.readFileSync(indexFile, 'utf-8');

  if (!content.includes('i18n-config.json')) {
    logError('i18n 配置必须从 src/common/config/i18n-config.json 加载共享常量');
  }

  if (!content.includes('export const supportedLanguages')) {
    logError('i18n 配置必须导出 supportedLanguages');
  }

  // 确保存在延迟加载支持。
  if (!content.includes('loadLocaleModules') && !content.includes('import(')) {
    logWarning('i18n 配置可能未使用延迟加载');
  }

  logSuccess('i18n 配置检查通过');
}

function main() {
  console.log('\n🔍 i18n 校验开始\n');
  console.log('========================================');

  checkDirectoryStructure();
  checkTranslationKeys();
  checkEmptyTranslations();
  checkLiteralKeyUsages();
  checkI18nTypeDefinitionInSync();
  checkIndexConfig();

  console.log('\n========================================');
  console.log('\n📊 校验摘要：\n');

  if (hasErrors) {
    console.log('❌ 校验失败，请在提交前修复问题。');
    process.exit(1);
  }

  if (hasWarnings) {
    console.log('⚠️  发现警告。');
  }

  console.log('✅ i18n 校验通过\n');
  process.exit(0);
}

main();
