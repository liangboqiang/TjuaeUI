import type { AssetDiff, AssetResolveStrategy } from '@/common/types/agent/assets';
import { Alert, Modal, Radio, Tag } from '@arco-design/web-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type AssetConflictDialogProps = {
  visible: boolean;
  diff?: AssetDiff;
  loading: boolean;
  onCancel: () => void;
  onResolve: (strategy: AssetResolveStrategy, confirmDestructive: boolean) => Promise<void>;
};

const AssetConflictDialog: React.FC<AssetConflictDialogProps> = ({ visible, diff, loading, onCancel, onResolve }) => {
  const { t } = useTranslation();
  const [strategy, setStrategy] = useState<AssetResolveStrategy>('autoMerge');
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStrategy('autoMerge');
    setConfirmStep(false);
  }, [visible]);

  const counts = useMemo(() => {
    const files = diff?.files ?? [];
    return {
      changed: files.filter((file) => file.status !== 'unchanged').length,
      conflicts: files.filter((file) => file.status === 'conflict').length,
      mergeable: files.filter((file) => file.status === 'diverged' && file.autoMergeable).length,
    };
  }, [diff]);

  const apply = async () => {
    if (strategy === 'useRemote' && !confirmStep) {
      setConfirmStep(true);
      return;
    }
    await onResolve(strategy, strategy === 'useRemote');
  };

  return (
    <Modal
      visible={visible}
      alignCenter
      autoFocus={false}
      focusLock
      maskClosable={!loading}
      escToExit={!loading}
      title={
        confirmStep
          ? t('settings.assetWorkbench.resolve.confirmRemoteTitle')
          : t('settings.assetWorkbench.resolve.title')
      }
      okText={
        confirmStep
          ? t('settings.assetWorkbench.resolve.confirmRemoteAction')
          : strategy === 'useRemote'
            ? t('settings.assetWorkbench.resolve.continue')
            : t('settings.assetWorkbench.resolve.apply')
      }
      cancelText={confirmStep ? t('settings.assetWorkbench.resolve.back') : t('common.cancel')}
      okButtonProps={{ status: confirmStep ? 'danger' : undefined, loading, disabled: !diff }}
      onCancel={() => {
        if (confirmStep) {
          setConfirmStep(false);
        } else {
          onCancel();
        }
      }}
      onOk={() => void apply()}
      className='!w-[min(620px,calc(100vw-24px))]'
      aria-label={t('settings.assetWorkbench.resolve.title')}
    >
      {confirmStep ? (
        <Alert
          type='warning'
          showIcon
          title={t('settings.assetWorkbench.resolve.confirmRemoteTitle')}
          content={t('settings.assetWorkbench.resolve.confirmRemoteDescription')}
        />
      ) : (
        <div className='flex flex-col gap-14px'>
          <p className='m-0 text-13px leading-21px text-t-secondary'>
            {t('settings.assetWorkbench.resolve.description')}
          </p>
          <div className='flex flex-wrap gap-7px' aria-label={t('settings.assetWorkbench.resolve.summary')}>
            <Tag bordered>
              {t('settings.assetWorkbench.resolve.changedCount', {
                count: counts.changed,
              })}
            </Tag>
            <Tag bordered color={counts.conflicts > 0 ? 'red' : 'green'}>
              {t('settings.assetWorkbench.resolve.conflictCount', {
                count: counts.conflicts,
              })}
            </Tag>
            <Tag bordered color='blue'>
              {t('settings.assetWorkbench.resolve.mergeableCount', {
                count: counts.mergeable,
              })}
            </Tag>
          </div>
          <Radio.Group
            direction='vertical'
            value={strategy}
            onChange={(value) => setStrategy(value as AssetResolveStrategy)}
            aria-label={t('settings.assetWorkbench.resolve.strategyLabel')}
            className='w-full'
          >
            {(['autoMerge', 'keepLocal', 'useRemote', 'detach'] as const).map((item) => (
              <Radio key={item} value={item} className='!mr-0 rounded-8px border border-border-2 px-12px py-10px'>
                <span className='flex flex-col gap-2px'>
                  <span className='font-600 text-t-primary'>
                    {t(`settings.assetWorkbench.resolve.strategies.${item}.label`)}
                  </span>
                  <span className='whitespace-normal text-12px leading-18px text-t-secondary'>
                    {t(`settings.assetWorkbench.resolve.strategies.${item}.description`)}
                  </span>
                </span>
              </Radio>
            ))}
          </Radio.Group>
          {strategy === 'autoMerge' && counts.conflicts > 0 ? (
            <Alert type='warning' showIcon content={t('settings.assetWorkbench.resolve.autoMergeBlocked')} />
          ) : null}
        </div>
      )}
    </Modal>
  );
};

export default AssetConflictDialog;
