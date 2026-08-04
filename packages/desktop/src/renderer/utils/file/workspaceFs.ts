
import { ipcBridge } from '@/common';

export const removeWorkspaceEntry = (path: string, workspace?: string) => {
  return ipcBridge.fs.removeEntry.invoke({ path, workspace });
};

export const renameWorkspaceEntry = (path: string, new_name: string, workspace?: string) => {
  return ipcBridge.fs.renameEntry.invoke({ path, new_name, workspace });
};
