import { hub, shell } from '@/common/adapter/ipcBridge';
import type { AssetKind, AssetSummary } from '@/common/types/agent/assets';
import type {
  HubAssetKind,
  HubPublishConnectionStatus,
  HubPublishPreparation,
  HubPublishRequest,
} from '@/common/types/agent/hub';
import { Alert, Button, Checkbox, Form, Input, Message, Modal, Space, Tag, Typography } from '@arco-design/web-react';
import { CheckOne, Copy, Link, Upload } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeAssetError } from '../components/assetError';

const { Text } = Typography;

const HUB_PACKAGE_NAME_PATTERN = /^tjuaeasset-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HUB_SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const toHubKind = (kind: AssetKind): HubAssetKind => kind;

const toPackageName = (asset: AssetSummary): string => {
  const raw = asset.id.includes(':') ? asset.id.slice(asset.id.indexOf(':') + 1) : asset.id;
  const slug = raw
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return `tjuaeasset-${slug || 'asset'}`;
};

const newIdempotencyKey = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `publish-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const warningI18nKey = (code: string) =>
  code === 'SENSITIVE_FIELDS_REMOVED'
    ? 'settings.assetPublish.warningSensitiveFieldsRemoved'
    : 'settings.assetPublish.warningUnknown';

type PublishForm = {
  packageName: string;
  version: string;
  author: string;
  license: string;
  sourceRepository: string;
  metadataConfirmed: boolean;
  title?: string;
  body?: string;
};

type AssetPublishDialogProps = {
  asset?: AssetSummary;
};

const AssetPublishDialog: React.FC<AssetPublishDialogProps> = ({ asset }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<PublishForm>();
  const [visible, setVisible] = useState(false);
  const [connection, setConnection] = useState<HubPublishConnectionStatus>();
  const [preview, setPreview] = useState<HubPublishPreparation>();
  const [loadingConnection, setLoadingConnection] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preparingManualPr, setPreparingManualPr] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<unknown>();
  const requestGeneration = useRef(0);
  const idempotencyKey = useRef(newIdempotencyKey());

  const canPublish = Boolean(asset?.allowedActions.includes('publish'));

  const loadConnection = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoadingConnection(true);
    setError(undefined);
    try {
      const next = await hub.getPublishConnection.invoke();
      if (generation === requestGeneration.current) setConnection(next);
    } catch (nextError) {
      if (generation === requestGeneration.current) setError(nextError);
    } finally {
      if (generation === requestGeneration.current) setLoadingConnection(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || connection?.state !== 'authorizationPending') return;
    const delay = Math.max(1_000, connection.pollAfterMs ?? 5_000);
    const timer = window.setTimeout(async () => {
      try {
        const next = await hub.pollPublishAuthorization.invoke();
        setConnection(next);
      } catch (nextError) {
        setError(nextError);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [connection, visible]);

  useEffect(
    () => () => {
      requestGeneration.current += 1;
    },
    []
  );

  const open = useCallback(() => {
    if (!asset) return;
    form.setFieldsValue({
      packageName: asset.upstream?.packageName ?? toPackageName(asset),
      version: asset.upstream?.version ?? '1.0.0',
      author: '',
      license: '',
      sourceRepository: '',
      metadataConfirmed: false,
      title: undefined,
      body: undefined,
    });
    setPreview(undefined);
    setError(undefined);
    idempotencyKey.current = newIdempotencyKey();
    setVisible(true);
    void loadConnection();
  }, [asset, form, loadConnection]);

  const request = useCallback(
    (values: PublishForm): HubPublishRequest => ({
      assetKind: toHubKind(asset!.kind),
      assetId: asset!.id,
      packageName: values.packageName.trim(),
      version: values.version.trim(),
      author: values.author.trim(),
      license: values.license.trim(),
      sourceRepository: values.sourceRepository.trim(),
      metadataConfirmed: values.metadataConfirmed,
      idempotencyKey: idempotencyKey.current,
      title: values.title?.trim() || undefined,
      body: values.body?.trim() || undefined,
    }),
    [asset]
  );

  const generatePreview = useCallback(async () => {
    if (!asset) return;
    let values: PublishForm;
    try {
      values = await form.validate();
    } catch {
      return;
    }
    setPreviewing(true);
    setError(undefined);
    try {
      const next = await hub.preparePublish.invoke(request(values));
      setPreview(next);
    } catch (nextError) {
      setPreview(undefined);
      setError(nextError);
    } finally {
      setPreviewing(false);
    }
  }, [asset, form, request]);

  const startAuthorization = useCallback(async () => {
    setAuthorizing(true);
    setError(undefined);
    try {
      setConnection(await hub.startPublishAuthorization.invoke());
    } catch (nextError) {
      setError(nextError);
    } finally {
      setAuthorizing(false);
    }
  }, []);

  const pollAuthorization = useCallback(async () => {
    setAuthorizing(true);
    setError(undefined);
    try {
      setConnection(await hub.pollPublishAuthorization.invoke());
    } catch (nextError) {
      setError(nextError);
    } finally {
      setAuthorizing(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setAuthorizing(true);
    setError(undefined);
    try {
      setConnection(await hub.disconnectPublishAccount.invoke());
    } catch (nextError) {
      setError(nextError);
    } finally {
      setAuthorizing(false);
    }
  }, []);

  const copyCode = useCallback(async () => {
    if (!connection?.userCode) return;
    await navigator.clipboard.writeText(connection.userCode);
    Message.success(t('settings.assetPublish.codeCopied'));
  }, [connection?.userCode, t]);

  const openVerification = useCallback(async () => {
    if (!connection?.verificationUri) return;
    await shell.openExternal.invoke(connection.verificationUri);
  }, [connection?.verificationUri]);

  const publish = useCallback(async () => {
    if (!asset || !preview || connection?.state !== 'connected') return;
    let values: PublishForm;
    try {
      values = await form.validate();
    } catch {
      return;
    }
    setPublishing(true);
    setError(undefined);
    try {
      const result = await hub.publish.invoke(request(values));
      Message.success(t('settings.assetPublish.publishSuccess'));
      setVisible(false);
      await shell.openExternal.invoke(result.pullRequestUrl);
    } catch (nextError) {
      setError(nextError);
      void loadConnection();
    } finally {
      setPublishing(false);
    }
  }, [asset, connection?.state, form, loadConnection, preview, request, t]);

  const openManualPr = useCallback(async () => {
    if (!asset || !preview) return;
    setPreparingManualPr(true);
    setError(undefined);
    try {
      await shell.openExternal.invoke(preview.manualContributionUrl);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setPreparingManualPr(false);
    }
  }, [asset, preview]);

  const connectionContent = useMemo(() => {
    if (!connection || loadingConnection) {
      return <Alert type='info' showIcon content={t('settings.assetPublish.connectionChecking')} />;
    }
    switch (connection.state) {
      case 'notConfigured':
        return (
          <Alert
            type='warning'
            showIcon
            title={t('settings.assetPublish.notConfiguredTitle')}
            content={t('settings.assetPublish.notConfiguredDescription')}
          />
        );
      case 'disconnected':
        return (
          <div className='flex items-center justify-between gap-12px rounded-8px border border-border-2 px-12px py-10px'>
            <div>
              <div className='text-13px font-600'>{t('settings.assetPublish.disconnected')}</div>
              <div className='mt-2px text-11px text-t-tertiary'>{t('settings.assetPublish.connectDescription')}</div>
            </div>
            <Button type='primary' loading={authorizing} onClick={() => void startAuthorization()}>
              {t('settings.assetPublish.connect')}
            </Button>
          </div>
        );
      case 'authorizationPending':
        return (
          <div className='rounded-8px border border-border-2 px-12px py-10px'>
            <div className='text-12px text-t-secondary'>{t('settings.assetPublish.authorizationInstructions')}</div>
            <div className='mt-10px flex flex-wrap items-center gap-8px'>
              <Text code copyable={false} className='!text-18px !font-700 !tracking-wider'>
                {connection.userCode}
              </Text>
              <Button
                size='small'
                icon={<Copy aria-hidden='true' />}
                aria-label={t('settings.assetPublish.copyCode')}
                onClick={() => void copyCode()}
              >
                {t('settings.assetPublish.copyCode')}
              </Button>
              <Button
                size='small'
                type='outline'
                icon={<Link aria-hidden='true' />}
                onClick={() => void openVerification()}
              >
                {t('settings.assetPublish.openGitHub')}
              </Button>
              <Button size='small' type='text' loading={authorizing} onClick={() => void pollAuthorization()}>
                {t('settings.assetPublish.checkAuthorization')}
              </Button>
            </div>
          </div>
        );
      case 'connected':
        return (
          <div className='flex items-center justify-between gap-12px rounded-8px border border-success-6/40 bg-success-1 px-12px py-10px'>
            <span className='inline-flex items-center gap-7px text-13px text-success-6'>
              <CheckOne aria-hidden='true' />
              {t('settings.assetPublish.connectedAs', { account: connection.account })}
            </span>
            <Button size='mini' type='text' loading={authorizing} onClick={() => void disconnect()}>
              {t('settings.assetPublish.disconnect')}
            </Button>
          </div>
        );
      case 'insufficientPermissions':
        return (
          <Alert
            type='warning'
            showIcon
            title={t('settings.assetPublish.insufficientPermissions')}
            content={
              <Button size='small' type='outline' loading={authorizing} onClick={() => void startAuthorization()}>
                {t('settings.assetPublish.reauthorize')}
              </Button>
            }
          />
        );
    }
  }, [
    authorizing,
    connection,
    copyCode,
    disconnect,
    loadingConnection,
    openVerification,
    pollAuthorization,
    startAuthorization,
    t,
  ]);

  if (!asset || !canPublish) return null;

  return (
    <>
      <Button size='small' type='primary' icon={<Upload aria-hidden='true' />} onClick={open}>
        {t('settings.assetPublish.action')}
      </Button>
      <Modal
        visible={visible}
        title={t('settings.assetPublish.title')}
        onCancel={() => setVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setVisible(false)}>{t('common.cancel')}</Button>
            <Button type='text' loading={preparingManualPr} disabled={!preview} onClick={() => void openManualPr()}>
              {t('settings.assetPublish.manualPr')}
            </Button>
            <Button type='outline' loading={previewing} onClick={() => void generatePreview()}>
              {t('settings.assetPublish.preview')}
            </Button>
            <Button
              type='primary'
              loading={publishing}
              disabled={!preview || connection?.state !== 'connected'}
              onClick={() => void publish()}
            >
              {publishing ? t('settings.assetPublish.publishing') : t('settings.assetPublish.publish')}
            </Button>
          </Space>
        }
        unmountOnExit
        style={{ width: 720, maxWidth: 'calc(100vw - 32px)' }}
      >
        <div className='flex flex-col gap-14px'>
          {connectionContent}
          {error ? (
            <Alert
              type='error'
              showIcon
              content={localizeAssetError(t, error, 'settings.assetWorkbench.operationFailed')}
            />
          ) : null}
          <Form<PublishForm>
            form={form}
            layout='vertical'
            onValuesChange={() => setPreview(undefined)}
            aria-label={t('settings.assetPublish.formLabel')}
          >
            <div className='grid grid-cols-1 gap-x-12px md:grid-cols-[minmax(0,1fr)_160px]'>
              <Form.Item
                field='packageName'
                label={t('settings.assetPublish.packageName')}
                rules={[
                  {
                    match: HUB_PACKAGE_NAME_PATTERN,
                    maxLength: 96,
                    message: t('settings.assetPublish.invalidPackageName'),
                  },
                ]}
              >
                <Input maxLength={96} />
              </Form.Item>
              <Form.Item
                field='version'
                label={t('settings.assetPublish.version')}
                rules={[
                  {
                    match: HUB_SEMVER_PATTERN,
                    message: t('settings.assetPublish.invalidVersion'),
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </div>
            <div className='grid grid-cols-1 gap-x-12px md:grid-cols-2'>
              <Form.Item
                field='author'
                label={t('settings.assetPublish.author')}
                rules={[
                  { required: true, message: t('settings.assetPublish.authorRequired') },
                  { maxLength: 128, message: t('settings.assetPublish.invalidAuthor') },
                ]}
              >
                <Input maxLength={128} />
              </Form.Item>
              <Form.Item
                field='license'
                label={t('settings.assetPublish.license')}
                rules={[
                  { required: true, message: t('settings.assetPublish.licenseRequired') },
                  { maxLength: 128, message: t('settings.assetPublish.invalidLicense') },
                ]}
              >
                <Input maxLength={128} placeholder={t('settings.assetPublish.licensePlaceholder')} />
              </Form.Item>
            </div>
            <Form.Item
              field='sourceRepository'
              label={t('settings.assetPublish.sourceRepository')}
              rules={[
                { required: true, message: t('settings.assetPublish.sourceRepositoryRequired') },
                {
                  match: /^https:\/\/[^\s/]+\/[^\s]+$/u,
                  message: t('settings.assetPublish.invalidSourceRepository'),
                },
              ]}
            >
              <Input placeholder='https://github.com/owner/repository' />
            </Form.Item>
            <Alert type='info' showIcon className='mb-14px' content={t('settings.assetPublish.legalMetadataNotice')} />
            <Form.Item
              field='metadataConfirmed'
              triggerPropName='checked'
              rules={[
                {
                  validator: (value, callback) =>
                    callback(value === true ? undefined : t('settings.assetPublish.metadataConfirmationRequired')),
                },
              ]}
            >
              <Checkbox>{t('settings.assetPublish.metadataConfirmation')}</Checkbox>
            </Form.Item>
            <Form.Item field='title' label={t('settings.assetPublish.prTitle')}>
              <Input maxLength={200} showWordLimit />
            </Form.Item>
            <Form.Item field='body' label={t('settings.assetPublish.prDescription')}>
              <Input.TextArea maxLength={16_000} showWordLimit autoSize={{ minRows: 2, maxRows: 5 }} />
            </Form.Item>
          </Form>

          {preview ? (
            <section aria-label={t('settings.assetPublish.previewResult')}>
              <div className='mb-8px flex items-center justify-between gap-8px'>
                <div className='text-13px font-600'>{t('settings.assetPublish.previewResult')}</div>
                <Tag>{t('settings.assetPublish.fileCount', { count: preview.package.files.length })}</Tag>
              </div>
              {preview.warningCodes.map((code) => (
                <Alert key={code} type='warning' className='mb-8px' content={t(warningI18nKey(code), { code })} />
              ))}
              <dl className='mb-8px grid grid-cols-[auto_minmax(0,1fr)] gap-x-10px gap-y-4px rounded-8px bg-fill-1 px-12px py-8px text-12px'>
                <dt className='text-t-tertiary'>{t('settings.assetPublish.version')}</dt>
                <dd>{String(preview.package.manifest.version ?? '')}</dd>
                <dt className='text-t-tertiary'>{t('settings.assetPublish.author')}</dt>
                <dd>{String(preview.package.manifest.author ?? '')}</dd>
                <dt className='text-t-tertiary'>{t('settings.assetPublish.license')}</dt>
                <dd>{String(preview.package.manifest.license ?? '')}</dd>
              </dl>
              <div className='max-h-150px overflow-y-auto rounded-8px border border-border-2 px-12px py-8px'>
                <div className='text-12px font-500'>asset-package.json</div>
                {preview.package.files.map((file) => (
                  <div key={file.path} className='mt-5px flex items-center justify-between gap-8px text-12px'>
                    <span className='truncate'>{file.path}</span>
                    <span className='shrink-0 text-t-tertiary'>{file.size} B</span>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <Alert type='info' showIcon content={t('settings.assetPublish.previewRequired')} />
          )}
        </div>
      </Modal>
    </>
  );
};

export default AssetPublishDialog;
