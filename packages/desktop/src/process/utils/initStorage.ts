/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync as _mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { getPlatformServices } from '@/common/platform';
import { application } from '@/common/adapter/ipcBridge';
import type { TMessage } from '@/common/chat/chatLib';
import type {
  IChatConversationRefer,
  IEnvStorageRefer,
  ILegacyConfigStorageRefer,
  TChatConversation,
  TProviderWithModel,
} from '@/common/config/storage';
import { ConfigStorage, EnvStorage } from '@/common/config/storage';
import {
  copyDirectoryRecursively,
  ensureDirectory,
  getConfigPath,
  getDataPath,
  getTempPath,
  hasElectronAppPath,
  verifyDirectoryFiles,
} from './utils';
import { runLegacyDatabaseMigrations } from '@process/services/database/runLegacyDatabaseMigrations';
// Platform and architecture types (moved from deleted updateConfig)
type PlatformType = 'win32' | 'darwin' | 'linux';
type ArchitectureType = 'x64' | 'arm64' | 'ia32' | 'arm';

const nodePath = path;

const STORAGE_PATH = {
  config: 'tjuaeui-config.txt',
  chatMessage: 'tjuaeui-chat-message.txt',
  chat: 'tjuaeui-chat.txt',
  env: '.tjuaeui-env',
};

const getHomePage = getConfigPath;

const mkdirSync = (path: string) => {
  return _mkdirSync(path, { recursive: true });
};

/**
 * 迁移老版本数据从temp目录到userData/config目录
 */
const migrateLegacyData = async () => {
  const oldDir = getTempPath(); // 老的temp目录
  const newDir = getConfigPath(); // 新的userData/config目录

  try {
    // 检查新目录是否为空（不存在或者存在但无内容）
    const isNewDirEmpty =
      !existsSync(newDir) ||
      (() => {
        try {
          return existsSync(newDir) && readdirSync(newDir).length === 0;
        } catch (error) {
          console.warn('[TjuaeUI] Warning: Could not read new directory during migration check:', error);
          return false; // 假设非空以避免迁移覆盖
        }
      })();

    // 检查迁移条件：老目录存在且新目录为空
    if (existsSync(oldDir) && isNewDirEmpty) {
      // 创建目标目录
      mkdirSync(newDir);

      // 复制所有文件和文件夹
      await copyDirectoryRecursively(oldDir, newDir);

      // 验证迁移是否成功
      const isVerified = await verifyDirectoryFiles(oldDir, newDir);
      if (isVerified) {
        // 确保不会删除相同的目录
        if (path.resolve(oldDir) !== path.resolve(newDir)) {
          try {
            await fs.rm(oldDir, { recursive: true });
          } catch (cleanupError) {
            console.warn('[TjuaeUI] 原目录清理失败，请手动删除:', oldDir, cleanupError);
          }
        }
      }

      return true;
    }
  } catch (error) {
    console.error('[TjuaeUI] 数据迁移失败:', error);
  }

  return false;
};

const WriteFile = async (file_path: string, data: string) => {
  // Ensure parent directory exists to prevent ENOENT on first write
  const dir = nodePath.dirname(file_path);
  await fs.mkdir(dir, { recursive: true });
  return fs.writeFile(file_path, data);
};

/**
 * In-memory JSON store backed by a file on disk.
 *
 * Data is loaded once (synchronously on first access) and kept in memory.
 * - `get` / `getSync` read from the in-memory cache (microseconds).
 * - `set` / `remove` / `clear` update the cache first, then persist to disk.
 * - Disk writes are serialized via a simple promise chain to prevent corruption.
 *
 * The on-disk format stays base64(encodeURIComponent(JSON)) for backward compat.
 */
const JsonFileBuilder = <S extends object = Record<string, unknown>>(file_path: string) => {
  // -- encoding helpers (unchanged, keeps backward compat) --
  const encode = (data: unknown) => btoa(encodeURIComponent(String(data)));
  const decode = (base64: string) => decodeURIComponent(atob(base64));

  // -- in-memory cache --
  let cache: S | null = null;

  const loadSync = (): S => {
    try {
      const raw = readFileSync(file_path).toString();
      if (!raw || raw.trim() === '') return {} as S;
      const decoded = decode(raw);
      if (!decoded || decoded.trim() === '') return {} as S;
      const parsed = JSON.parse(decoded) as S;
      if (file_path.includes('chat.txt') && Object.keys(parsed).length === 0) {
        console.warn(`[Storage] Chat history file appears to be empty: ${file_path}`);
      }
      return parsed;
    } catch {
      return {} as S;
    }
  };

  const ensureLoaded = (): S => {
    if (cache === null) {
      cache = loadSync();
    }
    return cache;
  };

  // -- serialized disk persistence --
  let writeChain: Promise<unknown> = Promise.resolve();

  const persist = (): Promise<S> => {
    const data = cache ?? ({} as S);
    const encoded = encode(JSON.stringify(data));
    // Write once, branch the promise: writeChain stays resolved (so one
    // failure doesn't block subsequent writes), callers get the real error.
    const writeOp = writeChain.then(() => WriteFile(file_path, encoded));
    writeChain = writeOp.catch(() => {});
    return writeOp.then(
      () => data,
      (err) => {
        console.error(`[Storage] Failed to persist ${file_path}:`, err);
        throw err;
      }
    );
  };

  // -- public API (same shape as before) --
  const toJson = async (): Promise<S> => ensureLoaded();

  const setJson = async (data: S): Promise<S> => {
    cache = data;
    return persist();
  };

  const toJsonSync = (): S => ensureLoaded();

  return {
    toJson,
    setJson,
    toJsonSync,
    async set<K extends keyof S>(key: K, value: Awaited<S>[K]): Promise<Awaited<S>[K]> {
      const data = ensureLoaded();
      data[key] = value;
      await persist();
      return value;
    },
    async get<K extends keyof S>(key: K): Promise<Awaited<S>[K]> {
      return ensureLoaded()[key] as Awaited<S>[K];
    },
    async remove<K extends keyof S>(key: K) {
      const data = ensureLoaded();
      delete data[key];
      return persist();
    },
    clear() {
      cache = {} as S;
      return persist();
    },
    getSync<K extends keyof S>(key: K): S[K] {
      return ensureLoaded()[key];
    },
    update<K extends keyof S>(key: K, updateFn: (value: S[K], data: S) => Promise<S[K]>) {
      const data = ensureLoaded();
      return updateFn(data[key], data).then((value) => {
        data[key] = value;
        return persist();
      });
    },
    backup(fullName: string) {
      const dir = nodePath.dirname(fullName);
      if (!existsSync(dir)) {
        mkdirSync(dir);
      }
      // Backup: copy the file then remove original
      const doCopy = () => fs.copyFile(file_path, fullName).then(() => fs.rm(file_path, { recursive: true }));
      const backupOp = writeChain.then(doCopy);
      writeChain = backupOp.catch(() => {});
      return backupOp.then(
        () => {},
        (err) => {
          console.error(`[Storage] Backup failed:`, err);
          throw err;
        }
      );
    },
  };
};

const envFile = JsonFileBuilder<IEnvStorageRefer>(path.join(getHomePage(), STORAGE_PATH.env));

const dirConfig = envFile.getSync('tjuaeui.dir');

const cacheDir = dirConfig?.cacheDir || getHomePage();

const configFile = JsonFileBuilder<ILegacyConfigStorageRefer>(path.join(cacheDir, STORAGE_PATH.config));
type ConversationHistoryData = Record<string, TMessage[]>;

const _chatMessageFile = JsonFileBuilder<ConversationHistoryData>(path.join(cacheDir, STORAGE_PATH.chatMessage));
const _chatFile = JsonFileBuilder<IChatConversationRefer>(path.join(cacheDir, STORAGE_PATH.chat));

const chatFile = _chatFile;

const buildMessageListStorage = (conversation_id: string, dir: string) => {
  const fullName = path.join(dir, 'tjuaeui-chat-history', conversation_id + '.txt');
  if (!existsSync(fullName)) {
    mkdirSync(path.join(dir, 'tjuaeui-chat-history'));
  }
  return JsonFileBuilder<TMessage[]>(path.join(dir, 'tjuaeui-chat-history', conversation_id + '.txt'));
};

const conversationHistoryProxy = (options: typeof _chatMessageFile, dir: string) => {
  return {
    ...options,
    async set(key: string, data: TMessage[]) {
      const conversation_id = key;
      const storage = buildMessageListStorage(conversation_id, dir);
      return await storage.setJson(data);
    },
    async get(key: string): Promise<TMessage[]> {
      const conversation_id = key;
      const storage = buildMessageListStorage(conversation_id, dir);
      const data = await storage.toJson();
      if (Array.isArray(data)) return data;
      return [];
    },
    backup(conversation_id: string) {
      const storage = buildMessageListStorage(conversation_id, dir);
      return storage.backup(
        path.join(dir, 'tjuaeui-chat-history', 'backup', conversation_id + '_' + Date.now() + '.txt')
      );
    },
  };
};

const chatMessageFile = conversationHistoryProxy(_chatMessageFile, cacheDir);

const initStorage = async () => {
  const t0 = performance.now();
  const mark = (label: string) => console.log(`[TjuaeUI:init] ${label} +${Math.round(performance.now() - t0)}ms`);
  mark('start');

  // 1. 先执行数据迁移（在任何目录创建之前）
  await migrateLegacyData();
  mark('1. migrateLegacyData');

  // 2. 创建必要的目录（迁移后再创建，确保迁移能正常进行）
  // Use ensureDirectory to handle cases where a regular file blocks the path (#841)
  ensureDirectory(getHomePage());
  ensureDirectory(getDataPath());

  // 3. 初始化存储系统
  ConfigStorage.interceptor(configFile);
  EnvStorage.interceptor(envFile);
  mark('3. storage interceptors');

  mark('4. MCP config initialization skipped');

  // 5. Backend only understands the v26-era schema baseline. Older desktop
  //    users may still have a pre-v26 Electron-managed catalog, so we upgrade
  //    that file here, close it, and only then allow the backend to start.
  const legacyDbMigration = await runLegacyDatabaseMigrations();
  const repaired = legacyDbMigration.handoffRepair.repairedColumns.length;
  if (legacyDbMigration.skipped) {
    mark('5. legacyDbMigrations skipped');
  } else if (legacyDbMigration.migrated) {
    mark(
      `5. legacyDbMigrations v${legacyDbMigration.fromVersion}->v${legacyDbMigration.toVersion} handoffRepair=${repaired}`
    );
  } else {
    mark(`5. legacyDbMigrations noop(v${legacyDbMigration.fromVersion}) handoffRepair=${repaired}`);
  }

  if (hasElectronAppPath()) {
    application.systemInfo.provider(() => {
      return Promise.resolve(getSystemDir());
    });
  }
  mark('done');
};

export const ProcessConfig = configFile;

export const ProcessChat = chatFile;

export const ProcessChatMessage = chatMessageFile;

export const ProcessEnv = envFile;

export const getSystemDir = () => {
  // electron-log writes to the platform-standard logs directory
  const logDir = dirConfig?.logDir || getPlatformServices().paths.getLogsDir();

  return {
    cacheDir: cacheDir,
    // getDataPath() returns CLI-safe path (symlink on macOS) to avoid spaces
    // getDataPath() 返回 CLI 安全路径（macOS 上的符号链接）以避免空格问题
    workDir: dirConfig?.workDir || getDataPath(),
    logDir,
    platform: process.platform as PlatformType,
    arch: process.arch as ArchitectureType,
  };
};

export default initStorage;
