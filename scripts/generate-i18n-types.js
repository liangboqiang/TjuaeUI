#!/usr/bin/env node
/**
 * 根据参考语言模块生成强类型 i18n 键声明。
 *
 * 用法：
 *   node scripts/generate-i18n-types.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOCALES_DIR = path.resolve(__dirname, '../packages/desktop/src/renderer/services/i18n/locales');
const OUTPUT_FILE = path.resolve(__dirname, '../packages/desktop/src/renderer/services/i18n/i18n-keys.d.ts');
const OXFMT_BIN = path.resolve(
  __dirname,
  process.platform === 'win32' ? '../node_modules/.bin/oxfmt.exe' : '../node_modules/.bin/oxfmt'
);
const i18nConfig = require('../packages/desktop/src/common/config/i18n-config.json');
const REFERENCE_LANGUAGE = i18nConfig.referenceLanguage;
const REQUIRED_MODULES = i18nConfig.modules;

function getAllKeys(obj, prefix = '') {
  const keys = [];

  if (typeof obj !== 'object' || obj === null) {
    return keys;
  }

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

function collectReferenceKeys() {
  const allKeys = new Set();

  for (const moduleName of REQUIRED_MODULES) {
    const moduleFile = path.join(LOCALES_DIR, REFERENCE_LANGUAGE, `${moduleName}.json`);
    if (!fs.existsSync(moduleFile)) {
      throw new Error(`缺少参考语言模块：${REFERENCE_LANGUAGE}/${moduleName}.json`);
    }

    const content = JSON.parse(fs.readFileSync(moduleFile, 'utf-8'));
    for (const key of getAllKeys(content)) {
      allKeys.add(`${moduleName}.${key}`);
    }
  }

  return Array.from(allKeys).sort();
}

function buildI18nKeysDts(keys) {
  const keyUnion = keys.length > 0 ? keys.map((key) => `  | '${key}'`).join('\n') : '  | never';

  return `/* eslint-disable */\n/**\n * 自动生成文件，请勿手动编辑。\n * 生成脚本：scripts/generate-i18n-types.js\n */\n\nexport type I18nKey =\n${keyUnion};\n\nexport type I18nModule =\n${REQUIRED_MODULES.map((moduleName) => `  | '${moduleName}'`).join('\n')};\n`;
}

function generateI18nKeysDtsContent() {
  const keys = collectReferenceKeys();
  return buildI18nKeysDts(keys);
}

function formatOutputFile(filePath) {
  const commands = [`bunx prettier --write "${filePath}"`];

  if (fs.existsSync(OXFMT_BIN)) {
    commands.push(`"${OXFMT_BIN}" "${filePath}"`);
  }

  for (const command of commands) {
    try {
      execSync(command, { stdio: 'inherit' });
      return;
    } catch {
      // 尝试下一个可用格式化工具。
    }
  }

  console.warn(`⚠️  无法自动格式化 ${path.relative(process.cwd(), filePath)}，将保留当前格式。`);
}

function writeOutputFile(content) {
  const current = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, 'utf-8') : null;
  if (current === content) {
    console.log(`✅ i18n 键类型已是最新：${path.relative(process.cwd(), OUTPUT_FILE)}`);
    return;
  }

  fs.writeFileSync(OUTPUT_FILE, content, 'utf-8');
  formatOutputFile(OUTPUT_FILE);
  console.log(`✅ 已生成 i18n 键类型：${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

if (require.main === module) {
  const content = generateI18nKeysDtsContent();
  writeOutputFile(content);
}

module.exports = {
  REQUIRED_MODULES,
  collectReferenceKeys,
  generateI18nKeysDtsContent,
  getAllKeys,
};
