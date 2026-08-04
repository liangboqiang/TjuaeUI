
import type { IAppRestartResult } from '@/common/adapter/ipcBridge';
import type { App } from 'electron';

type RestartableApp = Pick<App, 'isPackaged' | 'relaunch' | 'exit'>;

export function restartApplication(app: RestartableApp): IAppRestartResult {
  if (!app.isPackaged) {
    console.info('[TjuaeUI] Restart skipped in development mode; manual restart required');
    return {
      restarted: false,
      manualRestartRequired: true,
      reason: 'dev-mode',
    };
  }

  console.info('[TjuaeUI] Relaunching application to apply changes');
  app.relaunch();
  app.exit(0);
  return {
    restarted: true,
    manualRestartRequired: false,
  };
}
