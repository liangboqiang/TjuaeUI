import TjuaeModal, { type TjuaeModalProps } from '@/renderer/components/base/TjuaeModal';
import { Button } from '@arco-design/web-react';
import React from 'react';

type TjuaeTaskModalProps = Omit<TjuaeModalProps, 'variant' | 'footer' | 'onOk'> & {
  testLabel?: React.ReactNode;
  onTest?: () => void;
  testLoading?: boolean;
  cancelLabel: React.ReactNode;
  confirmLabel: React.ReactNode;
  onConfirm: () => void;
  confirmLoading?: boolean;
};

/** 统一“测试 / 取消 / 确认”三段式任务弹窗。 */
const TjuaeTaskModal: React.FC<TjuaeTaskModalProps> = ({
  testLabel,
  onTest,
  testLoading,
  cancelLabel,
  confirmLabel,
  onConfirm,
  confirmLoading,
  onCancel,
  style,
  ...props
}) => (
  <TjuaeModal
    {...props}
    variant='standard'
    onCancel={onCancel}
    style={{ width: 640, maxWidth: '94vw', ...style }}
    footer={{
      render: () => (
        <div className='flex items-center justify-between gap-12px'>
          <div>
            {onTest ? (
              <Button loading={testLoading} onClick={onTest} className='min-w-96px !rounded-8px'>
                {testLabel}
              </Button>
            ) : null}
          </div>
          <div className='flex items-center gap-10px'>
            <Button onClick={onCancel} className='min-w-80px !rounded-8px'>
              {cancelLabel}
            </Button>
            <Button type='primary' loading={confirmLoading} onClick={onConfirm} className='min-w-104px !rounded-8px'>
              {confirmLabel}
            </Button>
          </div>
        </div>
      ),
    }}
  />
);

export default TjuaeTaskModal;
