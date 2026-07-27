import { Button, Message, Modal, Space, Typography } from '@arco-design/web-react';
import type { TFunction } from 'i18next';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const TJUAEUI_DOWNLOAD_URL = 'https://github.com/liangboqiang/TjuaeUI/';

type InstallationIntegrityDialogKind =
  | 'incomplete_installation'
  | 'data_migration'
  | 'local_data_repair'
  | 'recoverable_database_corruption'
  | 'transient_concurrent_startup'
  | 'startup_directory';

export function openDownloadLatest(): void {
  window.open(TJUAEUI_DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
}

export function getInstallationIntegrityTitle(
  t: TFunction,
  diagnosticsKind: InstallationIntegrityDialogKind = 'incomplete_installation'
): string {
  if (diagnosticsKind === 'recoverable_database_corruption') {
    return t('common.backendStartup.recoverableDatabaseCorruption.title');
  }
  if (diagnosticsKind === 'transient_concurrent_startup') {
    return t('common.backendStartup.transientConcurrentStartup.title');
  }
  if (diagnosticsKind === 'startup_directory') return t('common.backendStartup.startupDirectory.title');
  if (diagnosticsKind === 'local_data_repair') return t('common.backendStartup.localDataRepair.title');
  return diagnosticsKind === 'data_migration'
    ? t('common.backendStartup.dataMigration.title')
    : t('common.backendStartup.incompleteInstallation.title');
}

export function getBackendStartupInstallationDescription(t: TFunction): string {
  return t('common.backendStartup.incompleteInstallation.description');
}

export function getRuntimeComponentInstallationDescription(t: TFunction, resource: string): string {
  return t('common.backendStartup.incompleteInstallation.runtimeComponentDescription', { resource });
}

export function getInstallationIntegrityDownloadText(t: TFunction): string {
  return t('common.backendStartup.incompleteInstallation.downloadLatest');
}

export function getInstallationIntegrityModalActions(
  t: TFunction,
  options: {
    diagnosticsKind?: InstallationIntegrityDialogKind;
    onDownloadLatest?: () => void;
    onRecoverCorruptedDatabase?: () => Promise<unknown> | void;
  } = {}
): {
  downloadText?: string;
  onDownloadLatest: () => void;
  onRecoverCorruptedDatabase: () => Promise<unknown> | void;
  recoverText?: string;
} {
  const diagnosticsKind = options.diagnosticsKind ?? 'incomplete_installation';
  return {
    downloadText: diagnosticsKind === 'incomplete_installation' ? getInstallationIntegrityDownloadText(t) : undefined,
    onDownloadLatest: options.onDownloadLatest ?? openDownloadLatest,
    onRecoverCorruptedDatabase: options.onRecoverCorruptedDatabase ?? (() => Promise.resolve()),
    recoverText:
      diagnosticsKind === 'recoverable_database_corruption'
        ? t('common.backendStartup.recoverableDatabaseCorruption.confirmRebuild')
        : undefined,
  };
}

export function getDownloadLatestModalActionProps(t: TFunction): {
  cancelButtonProps: {
    style: {
      display: 'none';
    };
  };
  okText: string;
  onOk: () => void;
} {
  return {
    okText: getInstallationIntegrityDownloadText(t),
    onOk: openDownloadLatest,
    cancelButtonProps: {
      style: {
        display: 'none',
      },
    },
  };
}

export const InstallationIntegrityContent: React.FC<{ description: string }> = ({ description }) => (
  <div className='text-t-1' data-testid='installation-integrity-dialog'>
    <Typography.Paragraph className='mb-0 text-t-secondary' data-testid='installation-integrity-description'>
      {description}
    </Typography.Paragraph>
  </div>
);

const InstallationIntegrityFooter: React.FC<{
  diagnosticsKind?: InstallationIntegrityDialogKind;
}> = ({ diagnosticsKind = 'incomplete_installation' }) => {
  const { t } = useTranslation();
  const [recovering, setRecovering] = useState(false);
  const actions = getInstallationIntegrityModalActions(t, {
    diagnosticsKind,
    onRecoverCorruptedDatabase: () => window.electronAPI?.recoverCorruptedDatabase?.(),
  });

  const handleRecoverCorruptedDatabase = async () => {
    if (recovering) return;
    setRecovering(true);
    try {
      await actions.onRecoverCorruptedDatabase();
    } catch {
      Message.error(t('common.backendStartup.recoverableDatabaseCorruption.rebuildFailed'));
      setRecovering(false);
    }
  };

  return (
    <Space>
      {actions.downloadText ? (
        <Button data-testid='installation-integrity-download' type='primary' onClick={actions.onDownloadLatest}>
          {actions.downloadText}
        </Button>
      ) : null}
      {actions.recoverText ? (
        <Button
          data-testid='recoverable-database-corruption-rebuild'
          loading={recovering}
          type='primary'
          onClick={handleRecoverCorruptedDatabase}
        >
          {actions.recoverText}
        </Button>
      ) : null}
    </Space>
  );
};

type InstallationIntegrityModalController = ReturnType<typeof Modal.useModal>[0];

export function showInstallationIntegrityModal(
  modal: InstallationIntegrityModalController,
  t: TFunction,
  description: string,
  diagnosticsKind: InstallationIntegrityDialogKind = 'incomplete_installation'
): void {
  const hasLocalAction =
    diagnosticsKind === 'incomplete_installation' || diagnosticsKind === 'recoverable_database_corruption';
  modal.error({
    title: getInstallationIntegrityTitle(t, diagnosticsKind),
    content: <InstallationIntegrityContent description={description} />,
    ...(hasLocalAction ? { footer: <InstallationIntegrityFooter diagnosticsKind={diagnosticsKind} /> } : {}),
    closable: false,
    maskClosable: false,
  });
}

export const InstallationIntegrityModalHost: React.FC<{
  description: string;
  diagnosticsKind?: InstallationIntegrityDialogKind;
}> = ({ description, diagnosticsKind = 'incomplete_installation' }) => {
  const [modal, modalContextHolder] = Modal.useModal();
  const { t } = useTranslation();
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    showInstallationIntegrityModal(modal, t, description, diagnosticsKind);
  }, [description, diagnosticsKind, modal, t]);

  return <>{modalContextHolder}</>;
};
