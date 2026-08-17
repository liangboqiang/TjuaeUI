/**
 * Decide whether this process is allowed to register the backend startup flow
 * (whenReady -> handleAppReady -> startBackendOrExit).
 *
 * Only the instance that owns the single-instance lock may spawn tjuaecore. A
 * lock-losing instance must never register backend startup; otherwise it races
 * the first instance's tjuaecore over the same data directory, which produced
 * the "local data repair failed" false alarm.
 *
 * Extracted as a pure function so the gating decision is unit-testable without
 * importing index.ts (whose module top-level runs heavy Electron side effects).
 */
export function shouldRegisterBackendStartup(gotTheLock: boolean): boolean {
  return gotTheLock === true;
}
