import { Alert, Button, Skeleton } from '@arco-design/web-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { assetProtocolApi, type AssetProtocolCompatibility, validateAssetCollaborationProtocol } from './assetProtocol';

declare const __TJUAE_CORE_BUILD_IDENTIFIER__: string;

type GateState =
  | { status: 'checking' }
  | { status: 'compatible' }
  | { status: 'incompatible'; compatibility?: Exclude<AssetProtocolCompatibility, { compatible: true }> };

type AssetCollaborationGateProps = {
  children: React.ReactNode;
};

/**
 * 资产功能统一入口门禁。未通过协议验证时不渲染资产市场或发布组件，
 * 防止新 UI 误调用旧 Core 的 GitHub 流程。
 */
const AssetCollaborationGate: React.FC<AssetCollaborationGateProps> = ({ children }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<GateState>({ status: 'checking' });

  const verify = useCallback(async () => {
    setState({ status: 'checking' });
    try {
      const protocol = await assetProtocolApi.get.invoke();
      const compatibility = validateAssetCollaborationProtocol(protocol, __TJUAE_CORE_BUILD_IDENTIFIER__);
      if (!('reason' in compatibility)) {
        setState({ status: 'compatible' });
      } else {
        setState({ status: 'incompatible', compatibility });
      }
    } catch {
      // 旧 Core 不存在该端点时也必须停止，而不是降级回旧发布流程。
      setState({ status: 'incompatible' });
    }
  }, []);

  useEffect(() => {
    void verify();
  }, [verify]);

  if (state.status === 'checking') {
    return (
      <div className='min-h-240px p-20px' data-testid='asset-protocol-checking'>
        <Skeleton animation text={{ rows: 4 }} />
        <div className='mt-12px text-12px text-t-secondary'>{t('settings.assetProtocol.checking')}</div>
      </div>
    );
  }

  if (state.status === 'incompatible') {
    const isBuildMismatch = state.compatibility?.reason === 'buildMismatch';
    return (
      <div className='flex min-h-240px items-center justify-center p-20px' data-testid='asset-protocol-incompatible'>
        <Alert
          className='max-w-560px'
          type='error'
          showIcon
          title={t(
            isBuildMismatch ? 'settings.assetProtocol.buildMismatchTitle' : 'settings.assetProtocol.incompatibleTitle'
          )}
          content={t(
            isBuildMismatch
              ? 'settings.assetProtocol.buildMismatchDescription'
              : 'settings.assetProtocol.incompatibleDescription',
            isBuildMismatch
              ? {
                  expected: state.compatibility?.expectedBuildIdentifier,
                  actual: state.compatibility?.actualBuildIdentifier,
                }
              : undefined
          )}
          action={
            <Button size='small' type='outline' onClick={() => void verify()}>
              {t('common.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
};

export default AssetCollaborationGate;
