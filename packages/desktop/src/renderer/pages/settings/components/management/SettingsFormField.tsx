import classNames from 'classnames';
import React from 'react';

type SettingsFormFieldProps = {
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  controlId?: string;
};

/** 设置任务弹窗统一表单字段。 */
const SettingsFormField: React.FC<SettingsFormFieldProps> = ({
  label,
  children,
  hint,
  error,
  required,
  className,
  controlId,
}) => (
  <div className={classNames('block space-y-6px', className)}>
    <label htmlFor={controlId} className='block text-13px font-medium leading-20px text-t-primary'>
      {label}
      {required ? <span className='ml-3px text-danger-6'>*</span> : null}
    </label>
    {children}
    {error ? (
      <div className='text-11px leading-18px text-danger-6'>{error}</div>
    ) : hint ? (
      <div className='text-11px leading-18px text-t-tertiary'>{hint}</div>
    ) : null}
  </div>
);

export default SettingsFormField;
