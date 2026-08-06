import { Button, Input, Typography } from '@arco-design/web-react';
import { Delete, Plus } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type KeyValueRow = { id: number; key: string; value: string };

type KeyValueEditorProps = {
  label?: React.ReactNode;
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  hint?: React.ReactNode;
};

/** 环境变量和请求头共用的键值编辑器。 */
const KeyValueEditor: React.FC<KeyValueEditorProps> = ({ label, rows, onChange, hint }) => {
  const { t } = useTranslation();
  const keyInputRefs = React.useRef(new Map<number, React.ComponentRef<typeof Input>>());
  const valueInputRefs = React.useRef(new Map<number, React.ComponentRef<typeof Input>>());
  const nextRowIdRef = React.useRef(Date.now());
  const [pendingFocusId, setPendingFocusId] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (pendingFocusId === null) return;
    keyInputRefs.current.get(pendingFocusId)?.focus();
    setPendingFocusId(null);
  }, [pendingFocusId, rows]);

  const update = (id: number, field: 'key' | 'value', value: string) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  const addRow = () => {
    const id = Math.max(Date.now(), nextRowIdRef.current + 1);
    nextRowIdRef.current = id;
    setPendingFocusId(id);
    onChange([...rows, { id, key: '', value: '' }]);
  };
  const focusAfterValue = (id: number) => {
    const index = rows.findIndex((row) => row.id === id);
    const nextRow = rows[index + 1];
    if (nextRow) {
      keyInputRefs.current.get(nextRow.id)?.focus();
      return;
    }
    addRow();
  };

  return (
    <div className='space-y-10px'>
      {rows.length > 0 ? (
        <div className='flex items-center justify-between gap-8px'>
          {label ? (
            <Typography.Text className='text-13px font-500 text-t-secondary'>{label}</Typography.Text>
          ) : (
            <span />
          )}
          <Button type='secondary' size='small' icon={<Plus size='14' />} data-testid='mcp-add-pair' onClick={addRow}>
            {t('settings.mcpAddPair', { defaultValue: '添加一项' })}
          </Button>
        </div>
      ) : (
        <div className='flex min-h-48px items-center justify-center rounded-8px border border-dashed border-[var(--color-border-2)] px-12px py-8px'>
          <Button type='secondary' size='small' icon={<Plus size='14' />} data-testid='mcp-add-pair' onClick={addRow}>
            {t('settings.mcpAddPair', { defaultValue: '添加一项' })}
          </Button>
        </div>
      )}
      {rows.map((row) => (
        <div key={row.id} className='grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_32px] gap-8px'>
          <Input
            ref={(input) => {
              if (input) keyInputRefs.current.set(row.id, input);
              else keyInputRefs.current.delete(row.id);
            }}
            value={row.key}
            placeholder={t('settings.mcpKey', { defaultValue: '键' })}
            onChange={(value) => update(row.id, 'key', value)}
            onPressEnter={() => valueInputRefs.current.get(row.id)?.focus()}
          />
          <Input
            ref={(input) => {
              if (input) valueInputRefs.current.set(row.id, input);
              else valueInputRefs.current.delete(row.id);
            }}
            value={row.value}
            placeholder={t('settings.mcpValue', { defaultValue: '值' })}
            onChange={(value) => update(row.id, 'value', value)}
            onPressEnter={() => focusAfterValue(row.id)}
          />
          <Button
            type='text'
            status='danger'
            icon={<Delete size='15' />}
            aria-label={t('common.delete', { defaultValue: '删除' })}
            onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
          />
        </div>
      ))}
      {hint ? <div className='text-11px leading-18px text-t-tertiary'>{hint}</div> : null}
    </div>
  );
};

export default KeyValueEditor;
