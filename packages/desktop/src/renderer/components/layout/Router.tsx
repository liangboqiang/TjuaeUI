import React, { Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLoader from '@renderer/components/layout/AppLoader';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { TEAM_MODE_ENABLED } from '@/common/config/constants';
import AssetCollaborationGate from '@renderer/pages/settings/Assets/components/AssetCollaborationGate';
const Conversation = React.lazy(() => import('@renderer/pages/conversation'));
const Guid = React.lazy(() => import('@renderer/pages/guid'));
const AppearanceSettings = React.lazy(() => import('@renderer/pages/settings/AppearanceSettings'));
const ModeSettings = React.lazy(() => import('@renderer/pages/settings/ModeSettings'));
const SystemSettings = React.lazy(() => import('@renderer/pages/settings/SystemSettings'));
const WebuiSettings = React.lazy(() => import('@renderer/pages/settings/WebuiSettings'));
const MarketPage = React.lazy(() => import('@renderer/pages/settings/Assets/MarketPage'));
const LocalAssetPage = React.lazy(() => import('@renderer/pages/settings/Assets/LocalAssetPage'));
const EngineDiagnosticsPage = React.lazy(() => import('@renderer/pages/settings/Assets/EngineDiagnosticsPage'));
const ExtensionSettingsPage = React.lazy(() => import('@renderer/pages/settings/ExtensionSettingsPage'));
const LoginPage = React.lazy(() => import('@renderer/pages/login'));
const ComponentsShowcase = React.lazy(() => import('@renderer/pages/TestShowcase'));
const ScheduledTasksPage = React.lazy(() => import('@renderer/pages/cron/ScheduledTasksPage'));
const TaskDetailPage = React.lazy(() => import('@renderer/pages/cron/ScheduledTasksPage/TaskDetailPage'));
const TeamIndex = React.lazy(() => import('@renderer/pages/team'));

const withRouteFallback = (Component: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<AppLoader />}>
    <Component />
  </Suspense>
);

export const withAssetRouteFallback = (Component: React.LazyExoticComponent<React.ComponentType>) => (
  <AssetCollaborationGate>{withRouteFallback(Component)}</AssetCollaborationGate>
);

const ProtectedLayout: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  if (status === 'checking') {
    return <AppLoader />;
  }

  if (status !== 'authenticated') {
    return <Navigate to='/login' replace />;
  }

  return React.cloneElement(layout);
};

const PanelRoute: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  return (
    <HashRouter>
      <Routes>
        <Route
          path='/login'
          element={status === 'authenticated' ? <Navigate to='/guid' replace /> : withRouteFallback(LoginPage)}
        />
        <Route element={<ProtectedLayout layout={layout} />}>
          <Route index element={<Navigate to='/guid' replace />} />
          <Route path='/guid' element={withRouteFallback(Guid)} />
          <Route path='/conversation/:id' element={withRouteFallback(Conversation)} />
          <Route
            path='/team/:id'
            element={TEAM_MODE_ENABLED ? withRouteFallback(TeamIndex) : <Navigate to='/guid' replace />}
          />
          <Route path='/settings/model' element={withRouteFallback(ModeSettings)} />
          <Route path='/settings/assistants' element={withAssetRouteFallback(LocalAssetPage)} />
          <Route path='/settings/assistants/assets/:assetId' element={withAssetRouteFallback(LocalAssetPage)} />
          <Route path='/settings/engine' element={withAssetRouteFallback(LocalAssetPage)} />
          <Route path='/settings/engine/diagnostics' element={withAssetRouteFallback(EngineDiagnosticsPage)} />
          <Route path='/settings/engine/assets/:assetId' element={withAssetRouteFallback(LocalAssetPage)} />
          <Route path='/settings/skills' element={withAssetRouteFallback(LocalAssetPage)} />
          <Route path='/settings/skills/assets/:assetId' element={withAssetRouteFallback(LocalAssetPage)} />
          <Route path='/settings/tools' element={withAssetRouteFallback(LocalAssetPage)} />
          <Route path='/settings/tools/assets/:assetId' element={withAssetRouteFallback(LocalAssetPage)} />
          <Route path='/settings/appearance' element={withRouteFallback(AppearanceSettings)} />
          <Route path='/settings/webui' element={withRouteFallback(WebuiSettings)} />
          <Route path='/settings/market' element={withAssetRouteFallback(MarketPage)} />
          <Route path='/settings/system' element={withRouteFallback(SystemSettings)} />
          <Route path='/settings/about' element={withRouteFallback(SystemSettings)} />
          <Route path='/settings/ext/:tabId' element={withRouteFallback(ExtensionSettingsPage)} />
          <Route path='/settings' element={<Navigate to='/settings/engine' replace />} />
          <Route path='/test/components' element={withRouteFallback(ComponentsShowcase)} />
          <Route path='/scheduled' element={withRouteFallback(ScheduledTasksPage)} />
          <Route path='/scheduled/:job_id' element={withRouteFallback(TaskDetailPage)} />
        </Route>
        <Route path='*' element={<Navigate to={status === 'authenticated' ? '/guid' : '/login'} replace />} />
      </Routes>
    </HashRouter>
  );
};

export default PanelRoute;
