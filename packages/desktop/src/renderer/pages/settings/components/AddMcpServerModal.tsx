import type { IMcpServer } from '@/common/config/storage';
import React, { useEffect, useState } from 'react';
import ManualMcpServerModal from './ManualMcpServerModal';
import OneClickImportModal from './OneClickImportModal';

interface AddMcpServerModalProps {
  visible: boolean;
  server?: IMcpServer;
  existingServerNames?: string[];
  onCancel: () => void;
  onSubmit: (server: Omit<IMcpServer, 'id' | 'created_at' | 'updated_at'>) => Promise<void> | void;
  onBatchImport?: (
    servers: Omit<IMcpServer, 'id' | 'created_at' | 'updated_at'>[]
  ) => Promise<IMcpServer[] | void> | IMcpServer[] | void;
  importMode?: 'manual' | 'oneclick';
}

const AddMcpServerModal: React.FC<AddMcpServerModalProps> = ({
  visible,
  server,
  existingServerNames = [],
  onCancel,
  onSubmit,
  onBatchImport,
  importMode = 'manual',
}) => {
  const [showManualModal, setShowManualModal] = useState(false);
  const [showOneClickModal, setShowOneClickModal] = useState(false);

  useEffect(() => {
    if (visible && !server) {
      if (importMode === 'manual') {
        setShowManualModal(true);
      } else if (importMode === 'oneclick') {
        setShowOneClickModal(true);
      }
    } else if (visible && server) {
      setShowManualModal(true);
    } else if (!visible) {
      setShowManualModal(false);
      setShowOneClickModal(false);
    }
  }, [visible, server, importMode]);

  const handleModalCancel = () => {
    setShowManualModal(false);
    setShowOneClickModal(false);
    onCancel();
  };

  if (!visible) return null;

  return (
    <>
      <ManualMcpServerModal
        visible={showManualModal}
        server={server}
        existingServerNames={existingServerNames}
        onCancel={handleModalCancel}
        onSubmit={onSubmit}
      />
      <OneClickImportModal
        visible={showOneClickModal}
        existingServerNames={existingServerNames}
        onCancel={handleModalCancel}
        onBatchImport={onBatchImport}
      />
    </>
  );
};

export default AddMcpServerModal;
