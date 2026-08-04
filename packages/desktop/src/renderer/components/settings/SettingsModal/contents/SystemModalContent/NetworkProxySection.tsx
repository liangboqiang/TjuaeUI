import { ipcBridge } from '@/common';
import type { INetworkProxySettings, INetworkProxyStatus, NetworkProxyMode } from '@/common/adapter/ipcBridge';
import TjuaeSelect from '@/renderer/components/base/TjuaeSelect';
import { Alert, Button, Form, Input, Message } from '@arco-design/web-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_NETWORK_PROXY_BYPASS, normalizeNetworkProxyUrl } from './networkProxyUtils';

const DEFAULT_SETTINGS: INetworkProxySettings = {
  mode: 'follow_system',
  proxy_url: null,
  no_proxy: DEFAULT_NETWORK_PROXY_BYPASS,
};

const NetworkProxySection: React.FC = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<INetworkProxySettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<INetworkProxyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [statusRefreshFailed, setStatusRefreshFailed] = useState(false);
  const [validationFailed, setValidationFailed] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const nextStatus = await ipcBridge.systemSettings.getNetworkProxyStatus.invoke();
      setStatus(nextStatus);
      setStatusRefreshFailed(false);
    } catch (error) {
      setStatusRefreshFailed(true);
      console.error('Failed to refresh network proxy status:', error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [response, nextStatus] = await Promise.all([
          ipcBridge.systemSettings.getNetworkProxy.invoke(),
          ipcBridge.systemSettings.getNetworkProxyStatus.invoke(),
        ]);
        if (cancelled) {
          return;
        }
        setSettings(response.network_proxy);
        setStatus(nextStatus);
        setLoadFailed(false);
        setStatusRefreshFailed(false);
      } catch (error) {
        if (!cancelled) {
          setLoadFailed(true);
          console.error('Failed to load network proxy settings:', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleModeChange = useCallback((mode: string) => {
    setSettings((current) => ({ ...current, mode: mode as NetworkProxyMode }));
    setValidationFailed(false);
  }, []);

  const handleSave = useCallback(async () => {
    const normalizedUrl = settings.mode === 'manual' ? normalizeNetworkProxyUrl(settings.proxy_url ?? '') : null;
    if (settings.mode === 'manual' && normalizedUrl === null) {
      setValidationFailed(true);
      return;
    }

    setSaving(true);
    setValidationFailed(false);
    try {
      const response = await ipcBridge.systemSettings.updateNetworkProxy.invoke({
        mode: settings.mode,
        proxy_url: normalizedUrl,
        no_proxy: settings.no_proxy.trim() || DEFAULT_NETWORK_PROXY_BYPASS,
      });
      setSettings(response.network_proxy);
      await refreshStatus();
      Message.success(t('settings.networkProxySaved'));
    } catch (error) {
      console.error('Failed to save network proxy settings:', error);
      Message.error(t('settings.networkProxySaveFailed'));
    } finally {
      setSaving(false);
    }
  }, [refreshStatus, settings, t]);

  let sourceLabel = t('settings.networkProxySourceNone');
  switch (status?.source) {
    case 'manual':
      sourceLabel = t('settings.networkProxySourceManual');
      break;
    case 'environment':
      sourceLabel = t('settings.networkProxySourceEnvironment');
      break;
    case 'windows_system':
      sourceLabel = t('settings.networkProxySourceWindows');
      break;
    case 'disabled':
      sourceLabel = t('settings.networkProxySourceDisabled');
      break;
  }

  const statusMessage =
    status?.state === 'active'
      ? t('settings.networkProxyStatusActive', {
          source: sourceLabel,
          proxy: status.proxy_url ?? t('settings.networkProxySourceNone'),
        })
      : t('settings.networkProxyStatusDirect', { source: sourceLabel });

  return (
    <div className='px-[12px] md:px-[32px] py-[24px] bg-2 rd-12px md:rd-16px border border-border-2'>
      <div className='mb-20px'>
        <div className='text-14px text-t-primary'>{t('settings.networkProxy')}</div>
        <div className='text-13px text-t-secondary mt-4px'>{t('settings.networkProxyDescription')}</div>
      </div>

      <Form layout='vertical' className='space-y-4px'>
        <Form.Item label={t('settings.networkProxyMode')}>
          <TjuaeSelect value={settings.mode} onChange={handleModeChange} disabled={loading || saving}>
            <TjuaeSelect.Option value='follow_system'>{t('settings.networkProxyModeFollowSystem')}</TjuaeSelect.Option>
            <TjuaeSelect.Option value='manual'>{t('settings.networkProxyModeManual')}</TjuaeSelect.Option>
            <TjuaeSelect.Option value='disabled'>{t('settings.networkProxyModeDisabled')}</TjuaeSelect.Option>
          </TjuaeSelect>
        </Form.Item>

        {settings.mode === 'manual' && (
          <Form.Item
            label={t('settings.networkProxyUrl')}
            validateStatus={validationFailed ? 'error' : undefined}
            help={validationFailed ? t('settings.networkProxyUrlInvalid') : t('settings.networkProxyUrlHelp')}
          >
            <Input
              value={settings.proxy_url ?? ''}
              placeholder='http://127.0.0.1:8080'
              disabled={loading || saving}
              onChange={(proxyUrl) => {
                setSettings((current) => ({ ...current, proxy_url: proxyUrl }));
                setValidationFailed(false);
              }}
            />
          </Form.Item>
        )}

        <Form.Item label={t('settings.networkProxyBypass')} extra={t('settings.networkProxyBypassHelp')}>
          <Input
            value={settings.no_proxy}
            placeholder={DEFAULT_NETWORK_PROXY_BYPASS}
            disabled={loading || saving}
            onChange={(noProxy) => setSettings((current) => ({ ...current, no_proxy: noProxy }))}
          />
        </Form.Item>
      </Form>

      {loadFailed && <Alert type='error' className='mb-12px' content={t('settings.networkProxyLoadFailed')} />}
      {statusRefreshFailed && (
        <Alert type='error' className='mb-12px' content={t('settings.networkProxyStatusRefreshFailed')} />
      )}
      {!loadFailed && status && (
        <Alert
          type={status.state === 'active' ? 'success' : 'info'}
          className='mb-12px'
          content={
            status.warning === 'pac_unsupported'
              ? t('settings.networkProxyWarningPac')
              : status.warning === 'invalid_system_proxy'
                ? t('settings.networkProxyWarningInvalidSystem')
                : statusMessage
          }
        />
      )}

      <div className='flex justify-end gap-8px'>
        <Button disabled={loading || saving} onClick={() => void refreshStatus()}>
          {t('settings.networkProxyRefreshStatus')}
        </Button>
        <Button type='primary' loading={saving} disabled={loading || loadFailed} onClick={() => void handleSave()}>
          {t('settings.networkProxySave')}
        </Button>
      </div>
    </div>
  );
};

export default NetworkProxySection;
