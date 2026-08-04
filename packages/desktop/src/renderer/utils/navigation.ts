
import type { NavigateFunction, NavigateOptions } from 'react-router-dom';

/**
 * Module-level handle to React Router's `navigate`, registered once by a
 * component mounted inside the Router (see `Layout`). This lets code that runs
 * *outside* the Router context — e.g. a provider mounted above `<Router>` —
 * trigger navigation
 * without calling `useNavigate()` during render (which would throw
 * "useNavigate() may be used only in the context of a <Router>").
 */
let navigateRef: NavigateFunction | null = null;

export const setGlobalNavigate = (navigate: NavigateFunction | null): void => {
  navigateRef = navigate;
};

/**
 * Navigate to a path from anywhere, including outside the Router tree. No-op
 * (with a console warning) if the Router hasn't mounted yet — callers treat
 * navigation as best-effort rather than a hard dependency.
 */
export const globalNavigate = (to: string, options?: NavigateOptions): void => {
  if (!navigateRef) {
    console.warn('[navigation] globalNavigate called before Router mounted; ignoring.');
    return;
  }
  navigateRef(to, options);
};
