import { isBackendHttpError } from '@/common/adapter/httpBridge';
import type {
  AssetConfigurationField,
  AssetConfigurationSchema,
  AssetConfigurationValue,
  AssetDetail,
  AssetOverlay,
  AssetOverlayResponse,
  AssetSecretBinding,
  AssetSecretSlotStatus,
  AssetSecretUpdate,
  EngineAdapterDefinition,
  McpAssetTransport,
  McpDefinition,
} from '@/common/types/agent/assets';
import { uuid } from '@/common/utils';
import { Alert, Button, Input, InputNumber, Message, Modal, Select, Skeleton, Switch } from '@arco-design/web-react';
import { Delete, Plus } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeAssetError } from '../components/assetError';
import { assetApi } from './assetApi';

type AssetRuntimeDialogProps = {
  visible: boolean;
  asset: AssetDetail;
  onClose: () => void;
  onSaved: (overlay: AssetOverlayResponse) => Promise<void>;
};

type SecretInputs = Record<string, string>;

type RuntimeDefinitionMetadata = {
  configurationSchema?: AssetConfigurationSchema;
  mcpTransport?: McpAssetTransport;
};

const defaultOverlay = (asset: AssetDetail): AssetOverlay => {
  switch (asset.kind) {
    case 'assistant':
      return { kind: 'assistant', configuration: {} };
    case 'skill':
      return { kind: 'skill', configuration: {} };
    case 'engineAdapter':
      return {
        kind: 'engineAdapter',
        configuration: {
          arguments: [],
          environment: [],
          values: [],
          secrets: [],
        },
      };
    case 'mcp':
      return {
        kind: 'mcp',
        configuration: {
          transport: 'stdio',
          arguments: [],
          environment: [],
          headers: [],
          values: [],
          secrets: [],
        },
      };
  }
};

const linesToValues = (value: string): string[] =>
  value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

const createSecretSlot = (scope: string): string => `${scope}.${uuid(24)}`;

const Field: React.FC<{
  label: string;
  children: React.ReactElement<{ 'aria-label'?: string }>;
  description?: string;
  labelControl?: boolean;
}> = ({ label, children, description, labelControl = true }) => {
  const control = labelControl ? React.cloneElement(children, { 'aria-label': label }) : children;
  return (
    <div className='flex flex-col gap-6px'>
      <span className='text-12px font-600 text-t-primary'>{label}</span>
      {control}
      {description ? <span className='text-11px leading-18px text-t-tertiary'>{description}</span> : null}
    </div>
  );
};

type SecretFieldProps = {
  label: string;
  configured: boolean;
  value: string;
  required?: boolean;
  description?: string;
  onChange: (value: string) => void;
  onClear: () => void;
};

const SecretField: React.FC<SecretFieldProps> = ({
  label,
  configured,
  value,
  required,
  description,
  onChange,
  onClear,
}) => {
  const { t } = useTranslation();
  return (
    <Field label={label} description={description} labelControl={false}>
      <div className='flex items-center gap-8px'>
        <Input.Password
          aria-label={label}
          className='min-w-0 flex-1'
          autoComplete='new-password'
          value={value}
          placeholder={
            configured
              ? t('settings.assetRuntime.secretConfiguredPlaceholder')
              : t('settings.assetRuntime.secretInputPlaceholder')
          }
          status={required && !configured && !value ? 'error' : undefined}
          onChange={onChange}
        />
        {configured ? (
          <Button type='outline' status='danger' onClick={onClear}>
            {t('settings.assetRuntime.clearSecret')}
          </Button>
        ) : null}
      </div>
    </Field>
  );
};

type NamedSecretEditorProps = {
  label: string;
  scope: 'environment' | 'header';
  bindings: AssetSecretBinding[];
  configuredSlots: ReadonlySet<string>;
  secretInputs: SecretInputs;
  clearedSlots: ReadonlySet<string>;
  onBindingsChange: (bindings: AssetSecretBinding[]) => void;
  onSecretInputChange: (slot: string, value: string) => void;
  onRemoveSlot: (slot: string, configured: boolean) => void;
};

const NamedSecretEditor: React.FC<NamedSecretEditorProps> = ({
  label,
  scope,
  bindings,
  configuredSlots,
  secretInputs,
  clearedSlots,
  onBindingsChange,
  onSecretInputChange,
  onRemoveSlot,
}) => {
  const { t } = useTranslation();
  const add = () => {
    onBindingsChange([...bindings, { name: '', secretSlot: createSecretSlot(scope) }]);
  };
  const remove = (index: number) => {
    const binding = bindings[index];
    onRemoveSlot(binding.secretSlot, configuredSlots.has(binding.secretSlot));
    onBindingsChange(bindings.filter((_, rowIndex) => rowIndex !== index));
  };

  return (
    <div className='flex flex-col gap-8px'>
      <div className='flex items-center justify-between gap-8px'>
        <span className='text-12px font-600 text-t-primary'>{label}</span>
        <Button size='mini' type='text' icon={<Plus aria-hidden='true' />} onClick={add}>
          {t('common.add')}
        </Button>
      </div>
      {bindings.length === 0 ? (
        <span className='rounded-8px border border-dashed border-border-2 px-10px py-12px text-11px text-t-tertiary'>
          {t('settings.assetRuntime.noSecretEntries')}
        </span>
      ) : (
        <div className='flex flex-col gap-8px'>
          {bindings.map((binding, index) => {
            const configured = configuredSlots.has(binding.secretSlot) && !clearedSlots.has(binding.secretSlot);
            return (
              <div
                key={binding.secretSlot}
                className='grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_32px] items-start gap-8px'
              >
                <Input
                  value={binding.name}
                  placeholder={t('settings.assetRuntime.secretNamePlaceholder')}
                  aria-label={`${label} ${t('settings.assetRuntime.secretNamePlaceholder')} ${index + 1}`}
                  status={!binding.name.trim() ? 'error' : undefined}
                  onChange={(name) =>
                    onBindingsChange(bindings.map((item, rowIndex) => (rowIndex === index ? { ...item, name } : item)))
                  }
                />
                <Input.Password
                  autoComplete='new-password'
                  value={secretInputs[binding.secretSlot] ?? ''}
                  placeholder={
                    configured
                      ? t('settings.assetRuntime.secretConfiguredPlaceholder')
                      : t('settings.assetRuntime.secretInputPlaceholder')
                  }
                  aria-label={`${label} ${t('settings.assetRuntime.secretValueLabel')} ${index + 1}`}
                  status={!configured && !(secretInputs[binding.secretSlot] ?? '') ? 'error' : undefined}
                  onChange={(value) => onSecretInputChange(binding.secretSlot, value)}
                />
                <Button
                  type='text'
                  status='danger'
                  icon={<Delete aria-hidden='true' />}
                  aria-label={t('common.delete')}
                  onClick={() => remove(index)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const readRuntimeDefinition = (asset: AssetDetail, content: string): RuntimeDefinitionMetadata => {
  if (asset.kind !== 'engineAdapter' && asset.kind !== 'mcp') return {};
  const parsed = JSON.parse(content) as EngineAdapterDefinition | McpDefinition;
  if (parsed.kind !== asset.kind) throw new Error('ASSET_DEFINITION_KIND_MISMATCH');
  if (parsed.kind === 'mcp') {
    return {
      configurationSchema: parsed.configurationSchema,
      mcpTransport: parsed.transport.type,
    };
  }
  return { configurationSchema: parsed.configurationSchema };
};

const configurationFieldValue = (
  overlay: AssetOverlay,
  field: AssetConfigurationField
): AssetConfigurationValue | undefined => {
  if (overlay.kind !== 'engineAdapter' && overlay.kind !== 'mcp') return undefined;
  return overlay.configuration.values.find((item) => item.key === field.key)?.value;
};

const configurationSecretSlot = (overlay: AssetOverlay, field: AssetConfigurationField): string | undefined => {
  if (overlay.kind !== 'engineAdapter' && overlay.kind !== 'mcp') return undefined;
  return overlay.configuration.secrets.find((item) => item.key === field.key)?.secretSlot;
};

const setConfigurationSecretSlot = (
  overlay: AssetOverlay,
  field: AssetConfigurationField,
  secretSlot: string | undefined
): AssetOverlay => {
  if (overlay.kind !== 'engineAdapter' && overlay.kind !== 'mcp') return overlay;
  const secrets = overlay.configuration.secrets.filter((item) => item.key !== field.key);
  if (secretSlot) secrets.push({ key: field.key, secretSlot });
  if (overlay.kind === 'engineAdapter') {
    return { kind: 'engineAdapter', configuration: { ...overlay.configuration, secrets } };
  }
  return { kind: 'mcp', configuration: { ...overlay.configuration, secrets } };
};

const setConfigurationValue = (
  overlay: AssetOverlay,
  field: AssetConfigurationField,
  value: AssetConfigurationValue | undefined
): AssetOverlay => {
  if (overlay.kind !== 'engineAdapter' && overlay.kind !== 'mcp') return overlay;
  const values = overlay.configuration.values.filter((item) => item.key !== field.key);
  if (value !== undefined && value !== '') values.push({ key: field.key, value });
  if (overlay.kind === 'engineAdapter') {
    return { kind: 'engineAdapter', configuration: { ...overlay.configuration, values } };
  }
  return { kind: 'mcp', configuration: { ...overlay.configuration, values } };
};

const namedSecretBindingsAreValid = (
  bindings: AssetSecretBinding[],
  configuredSlots: ReadonlySet<string>,
  clearedSlots: ReadonlySet<string>,
  secretInputs: SecretInputs
): boolean => {
  const names = bindings.map((binding) => binding.name.trim()).filter(Boolean);
  const normalizedNames = names.map((name) => name.toLowerCase());
  if (names.length !== bindings.length || new Set(normalizedNames).size !== normalizedNames.length) return false;
  return bindings.every(
    (binding) =>
      (configuredSlots.has(binding.secretSlot) && !clearedSlots.has(binding.secretSlot)) ||
      Boolean(secretInputs[binding.secretSlot])
  );
};

const AssetRuntimeDialog: React.FC<AssetRuntimeDialogProps> = ({ visible, asset, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<AssetOverlay>(() => defaultOverlay(asset));
  const [schema, setSchema] = useState<AssetConfigurationSchema>();
  const [schemaSecretSlots, setSchemaSecretSlots] = useState<Record<string, string>>({});
  const [version, setVersion] = useState<number>();
  const [secretSlots, setSecretSlots] = useState<AssetSecretSlotStatus[]>([]);
  const [secretInputs, setSecretInputs] = useState<SecretInputs>({});
  const [clearedSlots, setClearedSlots] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<unknown>();

  const configuredSlots = useMemo(
    () => new Set(secretSlots.filter((item) => item.configured).map((item) => item.slot)),
    [secretSlots]
  );

  const loadOverlay = useCallback(async () => {
    setIsLoading(true);
    setLoadError(undefined);
    setSecretInputs({});
    setClearedSlots(new Set());
    setSchemaSecretSlots({});
    try {
      const overlayPromise = assetApi.overlay
        .invoke({ assetId: asset.id })
        .catch((error: unknown): AssetOverlayResponse | undefined => {
          if (isBackendHttpError(error) && error.code === 'ASSET_OVERLAY_NOT_CONFIGURED') return undefined;
          throw error;
        });
      const definitionPromise: Promise<RuntimeDefinitionMetadata | undefined> =
        (asset.kind === 'engineAdapter' || asset.kind === 'mcp') && asset.entryFile
          ? assetApi.readFile
              .invoke({
                assetId: asset.id,
                path: asset.entryFile,
                source: 'local',
              })
              .then((definition) => readRuntimeDefinition(asset, definition.content))
          : Promise.resolve(undefined);
      const [response, definition] = await Promise.all([overlayPromise, definitionPromise]);
      if (response && response.configuration.kind !== asset.kind) {
        throw new Error('ASSET_OVERLAY_KIND_MISMATCH');
      }
      let nextDraft = response?.configuration ?? defaultOverlay(asset);
      if (nextDraft.kind === 'mcp' && definition?.mcpTransport) {
        if (response && nextDraft.configuration.transport !== definition.mcpTransport) {
          throw new Error('ASSET_OVERLAY_TRANSPORT_MISMATCH');
        }
        nextDraft = {
          kind: 'mcp',
          configuration: {
            ...nextDraft.configuration,
            transport: definition.mcpTransport,
          },
        };
      }
      const nextSchema = definition?.configurationSchema;
      const responseConfiguredSlots = new Set(
        (response?.secretSlots ?? []).filter((item) => item.configured).map((item) => item.slot)
      );
      const nextSchemaSecretSlots: Record<string, string> = {};
      for (const field of nextSchema?.fields ?? []) {
        if (!field.secret) continue;
        const existingSlot = configurationSecretSlot(nextDraft, field);
        nextSchemaSecretSlots[field.key] = existingSlot ?? createSecretSlot(`configuration.${field.key}`);
        if (existingSlot && !field.required && !responseConfiguredSlots.has(existingSlot)) {
          nextDraft = setConfigurationSecretSlot(nextDraft, field, undefined);
        }
      }

      setDraft(nextDraft);
      setSchema(nextSchema);
      setSchemaSecretSlots(nextSchemaSecretSlots);
      setVersion(response?.version);
      setSecretSlots(response?.secretSlots ?? []);
    } catch (error) {
      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, [asset]);

  useEffect(() => {
    if (visible) void loadOverlay();
  }, [loadOverlay, visible]);

  const onSecretInputChange = useCallback((slot: string, value: string) => {
    setSecretInputs((current) => ({ ...current, [slot]: value }));
    if (value) {
      setClearedSlots((current) => {
        const next = new Set(current);
        next.delete(slot);
        return next;
      });
    }
  }, []);

  const onClearSlot = useCallback((slot: string) => {
    setClearedSlots((current) => new Set(current).add(slot));
    setSecretInputs((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
  }, []);

  const onRemoveSlot = useCallback((slot: string, configured: boolean) => {
    setClearedSlots((current) => {
      const next = new Set(current);
      if (configured) next.add(slot);
      else next.delete(slot);
      return next;
    });
    setSecretInputs((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
  }, []);

  const onConfigurationSecretInputChange = useCallback(
    (field: AssetConfigurationField, slot: string, value: string) => {
      onSecretInputChange(slot, value);
      if (value || !configuredSlots.has(slot)) {
        setDraft((current) => setConfigurationSecretSlot(current, field, value ? slot : undefined));
      }
    },
    [configuredSlots, onSecretInputChange]
  );

  const bindingsAreValid = useMemo(() => {
    if (draft.kind !== 'engineAdapter' && draft.kind !== 'mcp') return true;
    return (
      namedSecretBindingsAreValid(draft.configuration.environment, configuredSlots, clearedSlots, secretInputs) &&
      (draft.kind !== 'mcp' ||
        namedSecretBindingsAreValid(draft.configuration.headers, configuredSlots, clearedSlots, secretInputs))
    );
  }, [clearedSlots, configuredSlots, draft, secretInputs]);

  const schemaIsValid = useMemo(() => {
    for (const field of schema?.fields ?? []) {
      if (!field.required) continue;
      if (field.secret) {
        const slot = configurationSecretSlot(draft, field);
        if (!slot || !((configuredSlots.has(slot) && !clearedSlots.has(slot)) || Boolean(secretInputs[slot]))) {
          return false;
        }
      } else {
        const value = configurationFieldValue(draft, field);
        if (value === undefined || value === '') return false;
      }
    }
    return true;
  }, [clearedSlots, configuredSlots, draft, schema, secretInputs]);

  const runtimeFieldsAreValid =
    draft.kind !== 'mcp' ||
    draft.configuration.transport === 'stdio' ||
    Boolean(draft.configuration.instanceUrl?.trim());

  const save = useCallback(async () => {
    const secretUpdates: AssetSecretUpdate[] = [
      ...Object.entries(secretInputs)
        .filter(([, value]) => value.length > 0)
        .map(([slot, value]) => ({ slot, operation: 'set' as const, value })),
      ...[...clearedSlots].filter((slot) => !secretInputs[slot]).map((slot) => ({ slot, operation: 'clear' as const })),
    ];

    setIsSaving(true);
    try {
      const response = await assetApi.configure.invoke({
        assetId: asset.id,
        configuration: draft,
        secretUpdates,
        expectedVersion: version,
      });
      await onSaved(response);
      Message.success(t('settings.assetRuntime.configurationSaved'));
      onClose();
    } catch (error) {
      Message.error(localizeAssetError(t, error, 'settings.assetRuntime.configurationSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [asset.id, clearedSlots, draft, onClose, onSaved, secretInputs, t, version]);

  const renderConfigurationFields = () =>
    (schema?.fields ?? []).map((field) => {
      if (field.secret) {
        const slot = schemaSecretSlots[field.key] ?? configurationSecretSlot(draft, field);
        if (!slot) return null;
        return (
          <SecretField
            key={field.key}
            label={field.label}
            description={field.description}
            configured={configuredSlots.has(slot) && !clearedSlots.has(slot)}
            required={field.required}
            value={secretInputs[slot] ?? ''}
            onChange={(value) => onConfigurationSecretInputChange(field, slot, value)}
            onClear={() => {
              onClearSlot(slot);
              if (!field.required) {
                setDraft((current) => setConfigurationSecretSlot(current, field, undefined));
              }
            }}
          />
        );
      }

      const value = configurationFieldValue(draft, field);
      if (field.valueType === 'boolean') {
        return (
          <Field key={field.key} label={field.label} description={field.description}>
            <Switch
              checked={value === true}
              onChange={(checked) => setDraft((current) => setConfigurationValue(current, field, checked))}
            />
          </Field>
        );
      }
      if (field.valueType === 'number') {
        return (
          <Field key={field.key} label={field.label} description={field.description}>
            <InputNumber
              className='w-full'
              value={typeof value === 'number' ? value : undefined}
              error={field.required && typeof value !== 'number'}
              onChange={(nextValue) =>
                setDraft((current) =>
                  setConfigurationValue(current, field, typeof nextValue === 'number' ? nextValue : undefined)
                )
              }
            />
          </Field>
        );
      }
      return (
        <Field key={field.key} label={field.label} description={field.description}>
          <Input
            value={typeof value === 'string' ? value : ''}
            status={field.required && !value ? 'error' : undefined}
            onChange={(nextValue) =>
              setDraft((current) => setConfigurationValue(current, field, nextValue || undefined))
            }
          />
        </Field>
      );
    });

  return (
    <Modal
      visible={visible}
      alignCenter
      focusLock
      maskClosable={!isSaving}
      escToExit={!isSaving}
      title={t('settings.assetRuntime.title', { name: asset.displayName })}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      okButtonProps={{
        loading: isSaving,
        disabled: Boolean(loadError) || !bindingsAreValid || !schemaIsValid || !runtimeFieldsAreValid,
      }}
      onCancel={onClose}
      onOk={() => void save()}
    >
      <p className='mt-0 text-12px leading-20px text-t-secondary'>{t('settings.assetRuntime.description')}</p>
      {isLoading ? (
        <Skeleton animation text={{ rows: 8 }} />
      ) : loadError ? (
        <Alert
          type='error'
          showIcon
          title={t('settings.assetRuntime.loadFailed')}
          content={localizeAssetError(t, loadError, 'settings.assetRuntime.loadFailed')}
        />
      ) : (
        <div className='flex max-h-[58vh] flex-col gap-14px overflow-y-auto pr-4px'>
          {draft.kind === 'assistant' ? (
            <>
              <Field label={t('settings.assetRuntime.fields.defaultModelId')}>
                <Input
                  value={draft.configuration.defaultModelId ?? ''}
                  onChange={(defaultModelId) =>
                    setDraft({
                      ...draft,
                      configuration: { ...draft.configuration, defaultModelId: defaultModelId || undefined },
                    })
                  }
                />
              </Field>
              <Field label={t('settings.assetRuntime.fields.engineAssetId')}>
                <Input
                  value={draft.configuration.engineAssetId ?? ''}
                  onChange={(engineAssetId) =>
                    setDraft({
                      ...draft,
                      configuration: { ...draft.configuration, engineAssetId: engineAssetId || undefined },
                    })
                  }
                />
              </Field>
              <Field label={t('settings.assetRuntime.fields.sortOrder')}>
                <InputNumber
                  className='w-full'
                  value={draft.configuration.sortOrder}
                  onChange={(sortOrder) =>
                    setDraft({
                      ...draft,
                      configuration: {
                        ...draft.configuration,
                        sortOrder: typeof sortOrder === 'number' ? sortOrder : undefined,
                      },
                    })
                  }
                />
              </Field>
            </>
          ) : null}

          {draft.kind === 'engineAdapter' ? (
            <>
              <Field label={t('settings.assetRuntime.fields.executablePath')}>
                <Input
                  value={draft.configuration.executablePath ?? ''}
                  onChange={(executablePath) =>
                    setDraft({
                      ...draft,
                      configuration: { ...draft.configuration, executablePath: executablePath || undefined },
                    })
                  }
                />
              </Field>
              <Field label={t('settings.assetRuntime.fields.command')}>
                <Input
                  value={draft.configuration.command ?? ''}
                  onChange={(command) =>
                    setDraft({
                      ...draft,
                      configuration: { ...draft.configuration, command: command || undefined },
                    })
                  }
                />
              </Field>
              <Field
                label={t('settings.assetRuntime.fields.arguments')}
                description={t('settings.assetRuntime.onePerLine')}
              >
                <Input.TextArea
                  autoSize={{ minRows: 3, maxRows: 7 }}
                  value={draft.configuration.arguments.join('\n')}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      configuration: { ...draft.configuration, arguments: linesToValues(value) },
                    })
                  }
                />
              </Field>
              <Field label={t('settings.assetRuntime.fields.workingDirectory')}>
                <Input
                  value={draft.configuration.workingDirectory ?? ''}
                  onChange={(workingDirectory) =>
                    setDraft({
                      ...draft,
                      configuration: { ...draft.configuration, workingDirectory: workingDirectory || undefined },
                    })
                  }
                />
              </Field>
              <NamedSecretEditor
                label={t('settings.assetRuntime.fields.environment')}
                scope='environment'
                bindings={draft.configuration.environment}
                configuredSlots={configuredSlots}
                secretInputs={secretInputs}
                clearedSlots={clearedSlots}
                onBindingsChange={(environment) =>
                  setDraft({ ...draft, configuration: { ...draft.configuration, environment } })
                }
                onSecretInputChange={onSecretInputChange}
                onRemoveSlot={onRemoveSlot}
              />
              {renderConfigurationFields()}
            </>
          ) : null}

          {draft.kind === 'mcp' ? (
            <>
              <Field label={t('settings.assetRuntime.fields.transport')}>
                <Select value={draft.configuration.transport} disabled>
                  <Select.Option value='stdio'>{t('settings.assetRuntime.transports.stdio')}</Select.Option>
                  <Select.Option value='sse'>{t('settings.assetRuntime.transports.sse')}</Select.Option>
                  <Select.Option value='streamableHttp'>
                    {t('settings.assetRuntime.transports.streamableHttp')}
                  </Select.Option>
                </Select>
              </Field>
              {draft.configuration.transport === 'stdio' ? (
                <Field label={t('settings.assetRuntime.fields.executablePath')}>
                  <Input
                    value={draft.configuration.executablePath ?? ''}
                    onChange={(executablePath) =>
                      setDraft({
                        ...draft,
                        configuration: { ...draft.configuration, executablePath: executablePath || undefined },
                      })
                    }
                  />
                </Field>
              ) : (
                <Field label={t('settings.assetRuntime.fields.instanceUrl')}>
                  <Input
                    value={draft.configuration.instanceUrl ?? ''}
                    onChange={(instanceUrl) =>
                      setDraft({
                        ...draft,
                        configuration: { ...draft.configuration, instanceUrl: instanceUrl || undefined },
                      })
                    }
                  />
                </Field>
              )}
              {draft.configuration.transport === 'stdio' ? (
                <>
                  <Field
                    label={t('settings.assetRuntime.fields.arguments')}
                    description={t('settings.assetRuntime.onePerLine')}
                  >
                    <Input.TextArea
                      autoSize={{ minRows: 3, maxRows: 7 }}
                      value={draft.configuration.arguments.join('\n')}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          configuration: { ...draft.configuration, arguments: linesToValues(value) },
                        })
                      }
                    />
                  </Field>
                  <NamedSecretEditor
                    label={t('settings.assetRuntime.fields.environment')}
                    scope='environment'
                    bindings={draft.configuration.environment}
                    configuredSlots={configuredSlots}
                    secretInputs={secretInputs}
                    clearedSlots={clearedSlots}
                    onBindingsChange={(environment) =>
                      setDraft({ ...draft, configuration: { ...draft.configuration, environment } })
                    }
                    onSecretInputChange={onSecretInputChange}
                    onRemoveSlot={onRemoveSlot}
                  />
                </>
              ) : (
                <NamedSecretEditor
                  label={t('settings.assetRuntime.fields.headers')}
                  scope='header'
                  bindings={draft.configuration.headers}
                  configuredSlots={configuredSlots}
                  secretInputs={secretInputs}
                  clearedSlots={clearedSlots}
                  onBindingsChange={(headers) =>
                    setDraft({ ...draft, configuration: { ...draft.configuration, headers } })
                  }
                  onSecretInputChange={onSecretInputChange}
                  onRemoveSlot={onRemoveSlot}
                />
              )}
              {renderConfigurationFields()}
            </>
          ) : null}

          {!bindingsAreValid || !schemaIsValid || !runtimeFieldsAreValid ? (
            <Alert type='warning' showIcon content={t('settings.assetRuntime.invalidConfiguration')} />
          ) : null}
        </div>
      )}
    </Modal>
  );
};

export default AssetRuntimeDialog;
