const stripWindowsVerbatimPrefix = (value: string): string => {
  if (value.startsWith('\\\\?\\UNC\\')) return `\\\\${value.slice(8)}`;
  if (value.startsWith('\\\\?\\')) return value.slice(4);
  return value;
};

const normalizePath = (value: string): string => {
  const stripped = stripWindowsVerbatimPrefix(value.trim()).normalize('NFC').replace(/\\/gu, '/');
  const collapsed = stripped.replace(/\/{2,}/gu, '/').replace(/\/$/u, '');
  return /^[A-Za-z]:\//u.test(collapsed) ? collapsed.toLocaleLowerCase('en-US') : collapsed;
};

export const createFileResourceKey = (workspace: string, filePath: string): string => {
  const normalizedWorkspace = normalizePath(workspace);
  const normalizedFilePath = normalizePath(filePath);
  const isAbsolutePath = /^[a-z]:\//u.test(normalizedFilePath) || normalizedFilePath.startsWith('/');
  const resolvedPath = isAbsolutePath
    ? normalizedFilePath
    : [normalizedWorkspace, normalizedFilePath].filter(Boolean).join('/');
  return `file:${resolvedPath}`;
};

export const createRevisionResourceKey = (workspace: string, filePath: string, revision: string): string =>
  `revision:${createFileResourceKey(workspace, filePath)}:${revision.trim().toLocaleLowerCase('en-US')}`;

export const createDiffResourceKey = (workspace: string, filePath: string, base = 'working-tree'): string =>
  `diff:${createFileResourceKey(workspace, filePath)}:${base.trim().toLocaleLowerCase('en-US')}`;
