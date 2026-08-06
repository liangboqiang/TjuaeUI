import type { IMcpServer, IMcpServerTransport } from '@/common/config/storage';
import { mcpService } from '@/common/adapter/ipcBridge';
import { parseError } from '@/common/utils';
import { Alert, Collapse, Input, InputTag, Radio, Select, Switch, Typography } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { KeyValueEditor, type KeyValueRow, SettingsFormField, TjuaeTaskModal } from './management';

type EditableTransportType = Exclude<IMcpServerTransport['type'], 'http'>;
type RemoteAuthType =
  | 'auto'
  | 'oauth_pkce'
  | 'bearer'
  | 'api_key'
  | 'basic'
  | 'custom_headers'
  | 'client_credentials'
  | 'none';
type ImportableMcpServer = Omit<IMcpServer, 'id' | 'created_at' | 'updated_at'>;
type DraftTestTone = 'success' | 'warning' | 'danger';

interface ManualMcpServerModalProps {
  visible: boolean;
  server?: IMcpServer;
  existingServerNames: string[];
  onCancel: () => void;
  onSubmit: (server: ImportableMcpServer) => Promise<void> | void;
}

const recordToRows = (record?: Record<string, string>): KeyValueRow[] =>
  Object.entries(record ?? {}).map(([key, value], index) => ({ id: index + 1, key, value }));

const rowsToRecord = (rows: KeyValueRow[]): Record<string, string> | undefined => {
  const entries = rows.map((row) => [row.key.trim(), row.value] as const).filter(([key]) => Boolean(key));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const hasPlaintextSensitiveHeader = (rows: KeyValueRow[]): boolean =>
  rows.some(
    (row) =>
      /authorization|api[-_]?key|token|secret/i.test(row.key.trim()) &&
      row.value.trim().length > 0 &&
      !/^\$\{env:[A-Za-z_][A-Za-z0-9_]*\}$/.test(row.value.trim())
  );

const readRemoteAuthMetadata = (server?: IMcpServer): Record<string, string> | undefined => {
  if (!server?.original_json) return undefined;
  try {
    const parsed = JSON.parse(server.original_json) as {
      mcpServers?: Record<string, { auth?: Record<string, unknown> }>;
    };
    const auth = parsed.mcpServers?.[server.name]?.auth;
    if (!auth || typeof auth !== 'object') return undefined;
    return Object.fromEntries(
      Object.entries(auth).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
  } catch {
    return undefined;
  }
};

const inferRemoteAuth = (server?: IMcpServer): { type: RemoteAuthType; secretRef: string; headerName: string } => {
  if (!server || server.transport.type === 'stdio') {
    return { type: 'auto', secretRef: '', headerName: 'X-API-Key' };
  }
  const metadata = readRemoteAuthMetadata(server);
  const metadataType = metadata?.type as RemoteAuthType | undefined;
  if (
    metadataType &&
    ['auto', 'oauth_pkce', 'bearer', 'api_key', 'basic', 'custom_headers', 'client_credentials', 'none'].includes(
      metadataType
    )
  ) {
    return {
      type: metadataType,
      secretRef: metadata?.secret_ref ?? '',
      headerName: metadata?.header ?? 'X-API-Key',
    };
  }
  const entries = Object.entries(server.transport.headers ?? {});
  const authorization = entries.find(([key]) => key.toLowerCase() === 'authorization')?.[1] ?? '';
  if (authorization.startsWith('Bearer ')) {
    return { type: 'bearer', secretRef: authorization.slice(7), headerName: 'Authorization' };
  }
  if (authorization.startsWith('Basic ')) {
    return { type: 'basic', secretRef: authorization.slice(6), headerName: 'Authorization' };
  }
  if (entries.length === 1 && /api[-_]?key/i.test(entries[0][0])) {
    return { type: 'api_key', secretRef: entries[0][1], headerName: entries[0][0] };
  }
  return { type: entries.length > 0 ? 'custom_headers' : 'auto', secretRef: '', headerName: 'X-API-Key' };
};

const asEnvironmentReference = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\$\{env:[A-Za-z_][A-Za-z0-9_]*\}$/.test(trimmed)) return trimmed;
  return `\${env:${trimmed.replace(/[^A-Za-z0-9_]/g, '_')}}`;
};

const buildOriginalJson = (
  name: string,
  description: string,
  transport: IMcpServerTransport,
  auth?: Record<string, string>
) => {
  const config =
    transport.type === 'stdio'
      ? {
          command: transport.command,
          ...(transport.args?.length ? { args: transport.args } : {}),
          ...(transport.env && Object.keys(transport.env).length ? { env: transport.env } : {}),
        }
      : {
          type: transport.type,
          url: transport.url,
          ...(transport.headers && Object.keys(transport.headers).length ? { headers: transport.headers } : {}),
        };
  return JSON.stringify(
    {
      mcpServers: {
        [name]: {
          ...(description ? { description } : {}),
          ...config,
          ...(auth && Object.keys(auth).length > 0 ? { auth } : {}),
        },
      },
    },
    null,
    2
  );
};

const ManualMcpServerModal: React.FC<ManualMcpServerModalProps> = ({
  visible,
  server,
  existingServerNames,
  onCancel,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [enabled, setEnabled] = React.useState(true);
  const [transportType, setTransportType] = React.useState<EditableTransportType>('stdio');
  const [command, setCommand] = React.useState('');
  const [args, setArgs] = React.useState<string[]>([]);
  const [url, setUrl] = React.useState('');
  const [envRows, setEnvRows] = React.useState<KeyValueRow[]>([]);
  const [headerRows, setHeaderRows] = React.useState<KeyValueRow[]>([]);
  const [authType, setAuthType] = React.useState<RemoteAuthType>('auto');
  const [secretRef, setSecretRef] = React.useState('');
  const [authHeaderName, setAuthHeaderName] = React.useState('X-API-Key');
  const [clientId, setClientId] = React.useState('');
  const [tokenUrl, setTokenUrl] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ tone: DraftTestTone; text: string } | null>(null);
  const [advancedKeys, setAdvancedKeys] = React.useState<string[]>([]);
  const advancedSectionRef = React.useRef<HTMLElement>(null);
  const advancedScrollTimerRef = React.useRef<number | undefined>(undefined);

  React.useEffect(
    () => () => {
      if (advancedScrollTimerRef.current !== undefined) {
        window.clearTimeout(advancedScrollTimerRef.current);
      }
    },
    []
  );

  React.useEffect(() => {
    if (!visible) return;
    const inferredAuth = inferRemoteAuth(server);
    const authMetadata = readRemoteAuthMetadata(server);
    setName(server?.name ?? '');
    setDescription(server?.description ?? '');
    setEnabled(server?.enabled ?? true);
    setTransportType(server?.transport.type === 'http' ? 'streamable_http' : (server?.transport.type ?? 'stdio'));
    setCommand(server?.transport.type === 'stdio' ? server.transport.command : '');
    setArgs(server?.transport.type === 'stdio' ? (server.transport.args ?? []) : []);
    setUrl(server?.transport.type !== 'stdio' ? (server?.transport.url ?? '') : '');
    setEnvRows(server?.transport.type === 'stdio' ? recordToRows(server.transport.env) : []);
    setHeaderRows(server?.transport.type !== 'stdio' ? recordToRows(server?.transport.headers) : []);
    setAuthType(inferredAuth.type);
    setSecretRef(inferredAuth.secretRef);
    setAuthHeaderName(inferredAuth.headerName);
    setClientId(authMetadata?.client_id ?? '');
    setTokenUrl(authMetadata?.token_url ?? '');
    setError('');
    setSubmitting(false);
    setTesting(false);
    setTestResult(null);
    setAdvancedKeys([]);
  }, [server, visible]);

  const normalizedName = name.trim();
  const environmentReference = asEnvironmentReference(secretRef);
  const authHeaders: Record<string, string> | undefined = (() => {
    if (!environmentReference) return undefined;
    if (authType === 'bearer' || authType === 'client_credentials') {
      return { Authorization: `Bearer ${environmentReference}` };
    }
    if (authType === 'basic') return { Authorization: `Basic ${environmentReference}` };
    if (authType === 'api_key') return { [authHeaderName.trim() || 'X-API-Key']: environmentReference };
    return undefined;
  })();
  const customHeaders = authType === 'custom_headers' ? rowsToRecord(headerRows) : undefined;
  const remoteAuthMetadata: Record<string, string> | undefined =
    transportType === 'stdio'
      ? undefined
      : {
          type: authType,
          ...(environmentReference ? { secret_ref: environmentReference } : {}),
          ...(authType === 'api_key' ? { header: authHeaderName.trim() || 'X-API-Key' } : {}),
          ...(authType === 'client_credentials' && clientId.trim() ? { client_id: clientId.trim() } : {}),
          ...(authType === 'client_credentials' && tokenUrl.trim() ? { token_url: tokenUrl.trim() } : {}),
        };
  const transport: IMcpServerTransport =
    transportType === 'stdio'
      ? {
          type: 'stdio',
          command: command.trim(),
          args: args.map((arg) => arg.trim()).filter(Boolean),
          env: rowsToRecord(envRows),
        }
      : {
          type: transportType,
          url: url.trim(),
          headers: authHeaders ?? customHeaders,
        };
  const jsonPreview = normalizedName
    ? buildOriginalJson(normalizedName, description.trim(), transport, remoteAuthMetadata)
    : '';
  const transportHint: Record<EditableTransportType, string> = {
    stdio: t('settings.mcpTransportStdioHint', { defaultValue: '本机进程：通过命令启动 MCP 服务器。' }),
    streamable_http: t('settings.mcpTransportHttpHint', {
      defaultValue: '远程服务：使用推荐的 Streamable HTTP 协议。',
    }),
    sse: t('settings.mcpTransportSseHint', { defaultValue: '兼容入口：连接仅支持旧版 SSE 的服务。' }),
  };

  const invalidateDraftFeedback = () => {
    setError('');
    setTestResult(null);
  };

  const changeTransport = (nextTransport: EditableTransportType) => {
    setTransportType(nextTransport);
    invalidateDraftFeedback();
  };

  const changeAdvancedKeys = (key: string, keys: string[]) => {
    setAdvancedKeys(keys);
    if (!keys.includes(key)) return;
    if (advancedScrollTimerRef.current !== undefined) {
      window.clearTimeout(advancedScrollTimerRef.current);
    }
    advancedScrollTimerRef.current = window.setTimeout(() => {
      const selector = key === 'connection' ? '.mcp-advanced-connection-item' : '.mcp-advanced-preview-item';
      const item = advancedSectionRef.current?.querySelector<HTMLElement>(selector);
      item?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      advancedScrollTimerRef.current = undefined;
    }, 220);
  };

  const validateDraft = (): string | null => {
    if (!normalizedName) {
      return t('settings.mcpNameRequired', { defaultValue: '请输入服务器名称。' });
    }
    if (!server && existingServerNames.some((item) => item.toLowerCase() === normalizedName.toLowerCase())) {
      return t('settings.mcpNameDuplicate', { defaultValue: '已存在同名 MCP 服务器。' });
    }
    if (transport.type === 'stdio' && !transport.command) {
      return t('settings.mcpCommandRequired', { defaultValue: '请输入启动命令。' });
    }
    if (transport.type !== 'stdio' && !transport.url) {
      return t('settings.mcpUrlRequired', { defaultValue: '请输入服务器 URL。' });
    }
    if (
      transport.type !== 'stdio' &&
      ['bearer', 'api_key', 'basic', 'client_credentials'].includes(authType) &&
      !environmentReference
    ) {
      return t('settings.mcpSecretRefRequired', { defaultValue: '请输入安全凭据的环境变量引用。' });
    }
    if (transport.type !== 'stdio' && authType === 'custom_headers' && hasPlaintextSensitiveHeader(headerRows)) {
      return t('settings.mcpPlaintextSecretRejected', {
        defaultValue: '敏感请求头必须使用 ${env:变量名} 引用，不能保存明文密钥。',
      });
    }
    return null;
  };

  const buildDraft = (): ImportableMcpServer => ({
    name: normalizedName,
    description: description.trim() || undefined,
    enabled,
    transport,
    tools: server?.tools ?? [],
    last_test_status: 'disconnected',
    original_json: buildOriginalJson(normalizedName, description.trim(), transport, remoteAuthMetadata),
  });

  const handleSubmit = async () => {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSubmit(buildDraft());
      onCancel();
    } catch (submitError) {
      setError(
        t('settings.mcpSaveFailed', {
          defaultValue: '保存 MCP 配置失败：{{error}}',
          error: parseError(submitError),
        })
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      setTestResult(null);
      return;
    }
    const now = Date.now();
    setTesting(true);
    setError('');
    setTestResult(null);
    try {
      const draft = buildDraft();
      const draftId = server?.id ?? `draft-mcp-${now}`;
      const result = await mcpService.testMcpConnection.invoke({
        ...draft,
        id: draftId,
        runtime_scope_id: draftId,
        created_at: server?.created_at ?? now,
        updated_at: now,
      });
      if (result.needsAuth || result.needs_auth) {
        setTestResult({
          tone: 'warning',
          text: t('settings.mcpDraftTestNeedsAuth', { defaultValue: '端点可达，但需要先完成授权。' }),
        });
      } else if (result.success) {
        setTestResult({
          tone: 'success',
          text: t('settings.mcpDraftTestSuccess', {
            defaultValue: '连接、协议协商与工具发现通过，共 {{count}} 个工具。',
            count: result.tools?.length ?? 0,
          }),
        });
      } else {
        setTestResult({
          tone: 'danger',
          text: t('settings.mcpDraftTestFailed', {
            defaultValue: '连接测试失败：{{error}}',
            error: result.error || result.code || t('common.unknownError', { defaultValue: '未知错误' }),
          }),
        });
      }
    } catch (testError) {
      setTestResult({
        tone: 'danger',
        text: t('settings.mcpDraftTestFailed', {
          defaultValue: '连接测试失败：{{error}}',
          error: parseError(testError),
        }),
      });
    } finally {
      setTesting(false);
    }
  };

  if (!visible) return null;

  return (
    <TjuaeTaskModal
      visible={visible}
      onCancel={onCancel}
      testLabel={t('settings.mcpTestDraft', { defaultValue: '测试连接' })}
      onTest={() => void handleTest()}
      testLoading={testing}
      cancelLabel={t('common.cancel', { defaultValue: '取消' })}
      confirmLabel={
        server ? t('common.save', { defaultValue: '保存' }) : t('settings.mcpAddServer', { defaultValue: '添加服务器' })
      }
      onConfirm={() => void handleSubmit()}
      confirmLoading={submitting}
      header={{
        title: server
          ? t('settings.mcpEditServer')
          : t('settings.mcpManualAdd', { defaultValue: '手动添加 MCP 服务器' }),
        subtitle: t('settings.mcpManualAddDescription', {
          defaultValue: '选择连接方式，只填写当前协议真正需要的配置。',
        }),
        showClose: true,
      }}
      style={{ width: 680 }}
      contentStyle={{ maxHeight: 'min(70vh, 680px)', overflow: 'auto' }}
    >
      <div className='space-y-18px' data-testid='manual-mcp-server-form'>
        <section className='space-y-10px' aria-labelledby='mcp-transport-heading'>
          <div className='flex items-end justify-between gap-16px'>
            <div>
              <Typography.Text id='mcp-transport-heading' className='block text-13px font-600 text-t-primary'>
                {t('settings.mcpConnectionMode', { defaultValue: '连接方式' })}
              </Typography.Text>
              <Typography.Text className='mt-2px block text-11px leading-18px text-t-tertiary'>
                {t('settings.mcpConnectionModeHint', { defaultValue: '选择服务器实际提供的 MCP 传输方式。' })}
              </Typography.Text>
            </div>
            <div className='flex shrink-0 items-center gap-8px'>
              <Typography.Text className='text-12px text-t-secondary'>
                {t('settings.mcpEnabledByDefault', { defaultValue: '添加后启用' })}
              </Typography.Text>
              <Switch checked={enabled} onChange={setEnabled} />
            </div>
          </div>
          <Radio.Group
            type='button'
            value={transportType}
            onChange={(value) => changeTransport(value as EditableTransportType)}
            className='w-full [&_.arco-radio-button]:flex-1 [&_.arco-radio-button]:text-center'
            data-testid='mcp-transport-group'
          >
            <Radio value='stdio' data-testid='mcp-transport-stdio'>
              STDIO
            </Radio>
            <Radio value='streamable_http' data-testid='mcp-transport-streamable_http'>
              Streamable HTTP
            </Radio>
            <Radio value='sse' data-testid='mcp-transport-sse'>
              SSE · {t('settings.mcpCompatibility', { defaultValue: '兼容' })}
            </Radio>
          </Radio.Group>
          <Typography.Text type='secondary' className='block text-11px leading-18px'>
            {transportHint[transportType]}
          </Typography.Text>
        </section>

        <section className='space-y-12px' aria-labelledby='mcp-basic-heading'>
          <Typography.Text id='mcp-basic-heading' className='block text-13px font-600 text-t-primary'>
            {t('settings.mcpBasicInformation', { defaultValue: '基本信息' })}
          </Typography.Text>
          <div className='grid gap-12px sm:grid-cols-2'>
            <SettingsFormField
              controlId='mcp-manual-name'
              label={t('settings.mcpServerName', { defaultValue: '服务器名称' })}
              required
            >
              <Input
                id='mcp-manual-name'
                value={name}
                disabled={Boolean(server)}
                onChange={(value) => {
                  setName(value);
                  invalidateDraftFeedback();
                }}
                data-testid='mcp-manual-name'
              />
            </SettingsFormField>
            <SettingsFormField
              controlId='mcp-manual-description'
              label={t('settings.mcpServerDescription', { defaultValue: '说明（可选）' })}
            >
              <Input id='mcp-manual-description' value={description} onChange={setDescription} />
            </SettingsFormField>
          </div>
        </section>

        <section className='space-y-12px border-t border-border-2 pt-16px' aria-labelledby='mcp-connection-heading'>
          <Typography.Text id='mcp-connection-heading' className='block text-13px font-600 text-t-primary'>
            {t('settings.mcpConnectionConfiguration', { defaultValue: '连接配置' })}
          </Typography.Text>
          {transportType === 'stdio' ? (
            <div className='space-y-12px'>
              <SettingsFormField
                controlId='mcp-manual-command'
                label={t('settings.mcpCommand', { defaultValue: '启动命令' })}
                hint={t('settings.mcpCommandHint', { defaultValue: '填写可执行文件或包运行器，例如 npx、uvx。' })}
                required
              >
                <Input
                  id='mcp-manual-command'
                  value={command}
                  onChange={(value) => {
                    setCommand(value);
                    invalidateDraftFeedback();
                  }}
                  placeholder='npx'
                  data-testid='mcp-manual-command'
                />
              </SettingsFormField>
              <SettingsFormField
                label={t('settings.mcpArguments', { defaultValue: '启动参数' })}
                hint={t('settings.mcpArgumentsHint', { defaultValue: '输入一个参数后按回车，可添加多个参数。' })}
              >
                <InputTag
                  value={args}
                  onChange={(value) => {
                    setArgs(value);
                    invalidateDraftFeedback();
                  }}
                  placeholder={t('settings.mcpArgumentsPlaceholder', { defaultValue: '例如：-y' })}
                  data-testid='mcp-manual-args'
                />
              </SettingsFormField>
            </div>
          ) : (
            <div className='space-y-12px'>
              <SettingsFormField controlId='mcp-manual-url' label='URL' required>
                <Input
                  id='mcp-manual-url'
                  value={url}
                  onChange={(value) => {
                    setUrl(value);
                    invalidateDraftFeedback();
                  }}
                  placeholder='https://example.com/mcp'
                  data-testid='mcp-manual-url'
                />
              </SettingsFormField>
              <SettingsFormField
                controlId='mcp-manual-auth'
                label={t('settings.mcpAuthentication', { defaultValue: '认证方式' })}
                required
              >
                <Select
                  id='mcp-manual-auth'
                  data-testid='mcp-auth-select'
                  value={authType}
                  onChange={(value) => {
                    const nextAuthType = value as RemoteAuthType;
                    setAuthType(nextAuthType);
                    invalidateDraftFeedback();
                    if (nextAuthType === 'custom_headers') changeAdvancedKeys('connection', ['connection']);
                  }}
                >
                  <Select.Option value='auto'>{t('settings.mcpAuthAuto', { defaultValue: '自动检测' })}</Select.Option>
                  <Select.Option value='oauth_pkce'>OAuth 2.1 + PKCE</Select.Option>
                  <Select.Option value='bearer'>Bearer Token</Select.Option>
                  <Select.Option value='api_key'>API Key</Select.Option>
                  <Select.Option value='basic'>Basic Auth</Select.Option>
                  <Select.Option value='custom_headers'>
                    {t('settings.mcpAuthCustomHeaders', { defaultValue: '自定义请求头' })}
                  </Select.Option>
                  <Select.Option value='client_credentials'>
                    {t('settings.mcpAuthClientCredentials', { defaultValue: '客户端凭据（扩展）' })}
                  </Select.Option>
                  <Select.Option value='none'>{t('settings.mcpAuthNone', { defaultValue: '无认证' })}</Select.Option>
                </Select>
              </SettingsFormField>
              {['bearer', 'api_key', 'basic', 'client_credentials'].includes(authType) ? (
                <div className='grid gap-10px sm:grid-cols-2'>
                  {authType === 'api_key' ? (
                    <SettingsFormField
                      controlId='mcp-manual-auth-header'
                      label={t('settings.mcpAuthHeaderName', { defaultValue: '请求头名称' })}
                    >
                      <Input
                        id='mcp-manual-auth-header'
                        value={authHeaderName}
                        onChange={(value) => {
                          setAuthHeaderName(value);
                          invalidateDraftFeedback();
                        }}
                        placeholder='X-API-Key'
                      />
                    </SettingsFormField>
                  ) : null}
                  {authType === 'client_credentials' ? (
                    <>
                      <SettingsFormField controlId='mcp-manual-client-id' label='Client ID'>
                        <Input
                          id='mcp-manual-client-id'
                          value={clientId}
                          onChange={(value) => {
                            setClientId(value);
                            invalidateDraftFeedback();
                          }}
                        />
                      </SettingsFormField>
                      <SettingsFormField controlId='mcp-manual-token-url' label='Token URL' className='sm:col-span-2'>
                        <Input
                          id='mcp-manual-token-url'
                          value={tokenUrl}
                          onChange={(value) => {
                            setTokenUrl(value);
                            invalidateDraftFeedback();
                          }}
                          placeholder='https://example.com/oauth/token'
                        />
                      </SettingsFormField>
                    </>
                  ) : null}
                  <SettingsFormField
                    controlId='mcp-secret-reference'
                    label={t('settings.mcpSecretReference', { defaultValue: '安全凭据引用' })}
                    required
                    className={authType === 'api_key' ? '' : 'sm:col-span-2'}
                  >
                    <Input
                      id='mcp-secret-reference'
                      value={secretRef}
                      onChange={(value) => {
                        setSecretRef(value);
                        invalidateDraftFeedback();
                      }}
                      placeholder='MCP_ACCESS_TOKEN'
                      data-testid='mcp-secret-reference'
                    />
                  </SettingsFormField>
                  <Typography.Text className='sm:col-span-2 text-11px leading-5 text-t-tertiary'>
                    {authType === 'basic'
                      ? t('settings.mcpBasicSecretHint', {
                          defaultValue: '引用值应为 Base64 编码后的“用户名:密码”。配置中只保存引用，不保存明文。',
                        })
                      : t('settings.mcpSecretReferenceHint', {
                          defaultValue: '填写环境变量名；配置中只保存 ${env:变量名} 引用，不保存明文密钥。',
                        })}
                  </Typography.Text>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section
          ref={advancedSectionRef}
          className='space-y-10px border-t border-border-2 pt-16px'
          aria-labelledby='mcp-advanced-heading'
        >
          <Typography.Text id='mcp-advanced-heading' className='block text-13px font-600 text-t-primary'>
            {t('settings.mcpAdvancedSettings', { defaultValue: '高级配置' })}
          </Typography.Text>
          <div className='overflow-hidden rounded-10px border border-solid border-[var(--color-border-2)] bg-[var(--color-fill-1)]'>
            <Collapse
              bordered={false}
              expandIconPosition='right'
              activeKey={advancedKeys}
              onChange={changeAdvancedKeys}
              className='[&_.arco-collapse-item:last-child]:!border-b-0 [&_.arco-collapse-item-content-box]:!px-14px [&_.arco-collapse-item-content-box]:!pb-14px [&_.arco-collapse-item-content-expanded]:!h-auto [&_.arco-collapse-item-content]:!transition-none [&_.arco-collapse-item-header]:!min-h-44px [&_.arco-collapse-item-header]:!bg-transparent [&_.arco-collapse-item-header]:!px-14px'
            >
              {transportType === 'stdio' || authType === 'custom_headers' ? (
                <Collapse.Item
                  name='connection'
                  className='mcp-advanced-connection-item'
                  header={
                    <span className='text-13px font-500 text-t-secondary'>
                      {transportType === 'stdio'
                        ? t('settings.mcpEnvironment', { defaultValue: '环境变量' })
                        : t('settings.mcpHeaders', { defaultValue: '请求头' })}
                    </span>
                  }
                >
                  {transportType === 'stdio' ? (
                    <KeyValueEditor
                      rows={envRows}
                      onChange={(rows) => {
                        setEnvRows(rows);
                        invalidateDraftFeedback();
                      }}
                    />
                  ) : (
                    <KeyValueEditor
                      rows={headerRows}
                      onChange={(rows) => {
                        setHeaderRows(rows);
                        invalidateDraftFeedback();
                      }}
                      hint={t('settings.mcpCustomHeadersHint', {
                        defaultValue: 'Authorization、Token、API Key 等敏感值必须填写 ${env:变量名} 引用。',
                      })}
                    />
                  )}
                </Collapse.Item>
              ) : null}
              <Collapse.Item
                name='preview'
                className='mcp-advanced-preview-item'
                header={
                  <span className='text-13px font-500 text-t-secondary'>
                    {t('settings.mcpGeneratedJson', { defaultValue: 'JSON 预览' })}
                  </span>
                }
              >
                {jsonPreview ? (
                  <pre
                    data-testid='mcp-json-preview'
                    className='m-0 max-h-220px overflow-auto whitespace-pre-wrap break-words rounded-8px border border-solid border-[var(--color-border-2)] bg-fill-2 p-12px text-11px leading-5 text-t-secondary'
                  >
                    {jsonPreview}
                  </pre>
                ) : (
                  <div
                    data-testid='mcp-json-preview-empty'
                    className='rounded-8px border border-dashed border-[var(--color-border-2)] px-12px py-14px text-center text-12px leading-5 text-t-tertiary'
                  >
                    {t('settings.mcpNameRequired', { defaultValue: '请输入服务器名称。' })}
                  </div>
                )}
              </Collapse.Item>
            </Collapse>
          </div>
        </section>

        {testResult ? (
          <Alert
            data-testid='mcp-draft-test-result'
            showIcon
            type={testResult.tone === 'danger' ? 'error' : testResult.tone}
            content={testResult.text}
          />
        ) : null}
        {error ? <Alert showIcon type='error' content={error} /> : null}
      </div>
    </TjuaeTaskModal>
  );
};

export default ManualMcpServerModal;
