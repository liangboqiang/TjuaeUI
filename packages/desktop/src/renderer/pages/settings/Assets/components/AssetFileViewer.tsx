import { isBackendHttpError } from '@/common/adapter/httpBridge';
import type {
  AssetContentSource,
  AssetDetail,
  AssetDiff,
  AssetFile,
  AssetFileEntry,
} from '@/common/types/agent/assets';
import MarkdownView from '@/renderer/components/Markdown';
import { Alert, Button, Empty, Input, Message, Radio, Skeleton } from '@arco-design/web-react';
import { Save } from '@icon-park/react';
import { createTwoFilesPatch } from 'diff';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { assetApi } from '../LocalAssetPage/assetApi';
import { isMarkdownFile } from './assetUi';
import { marketApi } from '../MarketPage/marketApi';

export type AssetFileView = 'preview' | 'source' | 'local' | 'base' | 'remote' | 'diff';

type AssetFileViewerProps = {
  detail: AssetDetail;
  file?: AssetFileEntry;
  initialDiff?: AssetDiff;
  requestedView?: AssetFileView;
  viewRequestId?: number;
  onSaved: (detail: AssetDetail) => Promise<void>;
};

const CodeContent: React.FC<{ content?: string }> = ({ content }) => (
  <pre className='m-0 min-h-300px overflow-auto whitespace-pre-wrap break-words bg-fill-1 p-14px font-mono text-12px leading-20px text-t-primary'>
    {content ?? ''}
  </pre>
);

const AssetFileViewer: React.FC<AssetFileViewerProps> = ({
  detail,
  file,
  initialDiff,
  requestedView,
  viewRequestId,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [view, setView] = useState<AssetFileView>('preview');
  const [localFile, setLocalFile] = useState<AssetFile>();
  const [baseFile, setBaseFile] = useState<AssetFile>();
  const [remoteFile, setRemoteFile] = useState<AssetFile>();
  const [assetDiff, setAssetDiff] = useState<AssetDiff | undefined>(initialDiff);
  const [comparisonLoaded, setComparisonLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const requestIdRef = useRef(0);

  const readFile = useCallback(
    async (source: AssetContentSource): Promise<AssetFile> => {
      if (!file) throw new Error('asset file is required');
      if (source === 'remote') {
        if (!detail.upstream?.remoteAssetId) throw new Error('remote asset is required');
        return marketApi.readFile.invoke({
          remoteAssetId: detail.upstream.remoteAssetId,
          path: file.path,
        });
      }
      return assetApi.readFile.invoke({
        assetId: detail.id,
        path: file.path,
        source,
      });
    },
    [detail.id, detail.upstream?.remoteAssetId, file]
  );

  const loadLocal = useCallback(async () => {
    if (!file?.text || !detail.files.some((entry) => entry.path === file.path)) return;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(undefined);
    try {
      const nextFile = await readFile('local');
      if (requestId !== requestIdRef.current) return;
      setLocalFile(nextFile);
      setDraft(nextFile.content);
    } catch (loadError) {
      if (requestId === requestIdRef.current) setError(loadError);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [detail.files, file, readFile]);

  useEffect(() => {
    setLocalFile(undefined);
    setBaseFile(undefined);
    setRemoteFile(undefined);
    setAssetDiff(initialDiff);
    setComparisonLoaded(false);
    setDraft('');
    setView('preview');
    void loadLocal();
    return () => {
      requestIdRef.current += 1;
    };
  }, [initialDiff, loadLocal]);

  useEffect(() => {
    if (requestedView) setView(requestedView);
  }, [requestedView, viewRequestId]);

  useEffect(() => {
    const existsLocally = Boolean(file && detail.files.some((entry) => entry.path === file.path));
    const needsRemotePreview = !existsLocally && (view === 'preview' || view === 'source' || view === 'local');
    if (
      !file?.text ||
      comparisonLoaded ||
      (!needsRemotePreview && view !== 'base' && view !== 'remote' && view !== 'diff')
    )
      return;
    let cancelled = false;
    const loadComparison = async () => {
      setIsLoading(true);
      setError(undefined);
      try {
        const nextDiff = assetDiff ?? (await assetApi.diff.invoke({ assetId: detail.id }));
        const selected = nextDiff.files.find((entry) => entry.path === file.path);
        const [nextBase, nextRemote] = await Promise.all([
          selected?.base ? readFile('base') : Promise.resolve(undefined),
          selected?.remote && detail.upstream?.remoteAssetId ? readFile('remote') : Promise.resolve(undefined),
        ]);
        if (cancelled) return;
        setBaseFile(nextBase);
        setRemoteFile(nextRemote);
        setAssetDiff(nextDiff);
      } catch (loadError) {
        if (!cancelled) setError(loadError);
      } finally {
        if (!cancelled) {
          setComparisonLoaded(true);
          setIsLoading(false);
        }
      }
    };
    void loadComparison();
    return () => {
      cancelled = true;
    };
  }, [assetDiff, comparisonLoaded, detail.files, detail.id, detail.upstream?.remoteAssetId, file, readFile, view]);

  const canEdit =
    detail.editability === 'full' && detail.allowedActions.includes('edit') && Boolean(file?.text && localFile);
  const isDirty = canEdit && draft !== localFile?.content;

  const save = useCallback(async () => {
    if (!file || !localFile || !canEdit || !isDirty) return;
    setIsSaving(true);
    setError(undefined);
    try {
      const nextDetail = await assetApi.writeFile.invoke({
        assetId: detail.id,
        path: file.path,
        content: draft,
        expectedDigest: localFile.digest,
      });
      const nextFile = await readFile('local');
      setLocalFile(nextFile);
      setDraft(nextFile.content);
      setBaseFile(undefined);
      setRemoteFile(undefined);
      setAssetDiff(undefined);
      setComparisonLoaded(false);
      await onSaved(nextDetail);
      Message.success(t('settings.assetWorkbench.saveSuccess'));
    } catch (saveError) {
      setError(saveError);
      Message.error(
        isBackendHttpError(saveError) && saveError.code === 'ASSET_CONCURRENT_MODIFICATION'
          ? t('settings.assetWorkbench.concurrentModification')
          : t('settings.assetWorkbench.saveError')
      );
    } finally {
      setIsSaving(false);
    }
  }, [canEdit, detail.id, draft, file, isDirty, localFile, onSaved, readFile, t]);

  const diffText = useMemo(() => {
    if (!file || !assetDiff) return '';
    const selectedDiff = assetDiff.files.find((item) => item.path === file.path);
    if (!selectedDiff || (selectedDiff.base && !baseFile)) return '';
    const patches: string[] = [];
    if (selectedDiff.localDigest !== selectedDiff.baseDigest) {
      patches.push(
        createTwoFilesPatch(
          file.path,
          file.path,
          baseFile?.content ?? '',
          localFile?.content ?? '',
          t('settings.assetWorkbench.baseline'),
          t('settings.assetWorkbench.local')
        )
      );
    }
    if (selectedDiff.remoteDigest !== selectedDiff.baseDigest) {
      patches.push(
        createTwoFilesPatch(
          file.path,
          file.path,
          baseFile?.content ?? '',
          remoteFile?.content ?? '',
          t('settings.assetWorkbench.baseline'),
          t('settings.assetWorkbench.remote')
        )
      );
    }
    return patches.join('\n');
  }, [assetDiff, baseFile, file, localFile, remoteFile, t]);

  if (!file) {
    return (
      <div className='flex min-h-360px items-center justify-center p-20px'>
        <Empty description={t('settings.assetWorkbench.selectFile')} />
      </div>
    );
  }

  const sourceUnavailable = isBackendHttpError(error) && error.code === 'ASSET_SOURCE_UNAVAILABLE';
  const concurrentModification = isBackendHttpError(error) && error.code === 'ASSET_CONCURRENT_MODIFICATION';
  const selectedDiff = assetDiff?.files.find((item) => item.path === file.path);
  const effectiveContent = localFile?.content ?? remoteFile?.content ?? baseFile?.content;
  const retryLoad = () => {
    setError(undefined);
    if (view === 'base' || view === 'diff') {
      setComparisonLoaded(false);
      return;
    }
    void loadLocal();
  };

  const renderContent = () => {
    if (!file.text) {
      return <Empty description={t('settings.assetWorkbench.binaryFile')} />;
    }
    if (isLoading && !localFile) {
      return (
        <div className='p-16px'>
          <Skeleton animation text={{ rows: 12 }} />
        </div>
      );
    }
    if (error && !concurrentModification) {
      return (
        <div className='p-16px'>
          <Alert
            type={sourceUnavailable ? 'info' : 'error'}
            showIcon
            title={
              sourceUnavailable
                ? t('settings.assetWorkbench.sourceUnavailable')
                : t('settings.assetWorkbench.fileLoadError')
            }
            content={
              <div className='flex flex-col items-start gap-8px'>
                <span>
                  {sourceUnavailable
                    ? t('settings.assetWorkbench.sourceUnavailableDescription')
                    : t('settings.assetWorkbench.fileLoadError')}
                </span>
                <Button size='mini' onClick={retryLoad}>
                  {t('common.retry')}
                </Button>
              </div>
            }
          />
        </div>
      );
    }
    if (view === 'preview') {
      return isMarkdownFile(file) ? (
        <div className='p-16px'>
          <MarkdownView>{effectiveContent ?? ''}</MarkdownView>
        </div>
      ) : (
        <CodeContent content={effectiveContent} />
      );
    }
    if (view === 'source') {
      return canEdit ? (
        <div className='flex min-h-0 flex-1 flex-col gap-10px p-12px'>
          {concurrentModification ? (
            <Alert
              type='warning'
              showIcon
              title={t('settings.assetWorkbench.concurrentModification')}
              content={t('settings.assetWorkbench.concurrentModificationDescription')}
            />
          ) : null}
          <Input.TextArea
            className='min-h-300px flex-1 font-mono'
            value={draft}
            onChange={setDraft}
            aria-label={t('settings.assetWorkbench.sourceEditor')}
            autoSize={false}
          />
          <div className='flex items-center justify-between gap-12px'>
            <span className='text-11px text-t-tertiary'>
              {isDirty ? t('settings.assetWorkbench.unsaved') : t('settings.assetWorkbench.saved')}
            </span>
            <Button
              type='primary'
              icon={<Save aria-hidden='true' />}
              loading={isSaving}
              disabled={!isDirty}
              onClick={() => void save()}
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      ) : (
        <CodeContent content={effectiveContent} />
      );
    }
    if (view === 'local') {
      return selectedDiff?.local || localFile ? (
        <CodeContent content={localFile?.content} />
      ) : (
        <Empty description={t('settings.assetWorkbench.fileMissingFromLocal')} />
      );
    }
    if (view === 'base') {
      return selectedDiff?.base ? (
        <CodeContent content={baseFile?.content} />
      ) : (
        <Empty description={t('settings.assetWorkbench.fileMissingFromBaseline')} />
      );
    }
    if (view === 'remote') {
      return selectedDiff?.remote ? (
        <CodeContent content={remoteFile?.content} />
      ) : (
        <Empty description={t('settings.assetWorkbench.fileMissingFromRemote')} />
      );
    }
    if (view === 'diff') {
      if (!selectedDiff || !diffText.trim()) {
        return <Empty description={t('settings.assetWorkbench.noFileChanges')} />;
      }
      return (
        <div className='p-16px'>
          <MarkdownView>{`\`\`\`diff\n${diffText}\n\`\`\``}</MarkdownView>
        </div>
      );
    }
    return <CodeContent content={effectiveContent} />;
  };

  return (
    <div className='flex min-h-0 flex-col'>
      <div className='flex flex-col gap-9px border-b border-border-2 px-12px py-10px md:flex-row md:items-center md:justify-between'>
        <div className='min-w-0'>
          <div className='truncate font-mono text-12px font-600 text-t-primary'>{file.path}</div>
          <div className='mt-2px truncate text-10px text-t-tertiary'>{file.mediaType}</div>
        </div>
        <Radio.Group
          type='button'
          size='small'
          value={view}
          onChange={(value) => setView(value as AssetFileView)}
          aria-label={t('settings.assetWorkbench.viewMode')}
        >
          {(['preview', 'source', 'local', 'base', 'remote', 'diff'] as const).map((mode) => (
            <Radio key={mode} value={mode}>
              {t(`settings.assetWorkbench.views.${mode}`)}
            </Radio>
          ))}
        </Radio.Group>
      </div>
      <div className='min-h-0 flex-1 overflow-auto' data-testid='asset-file-content'>
        {renderContent()}
      </div>
    </div>
  );
};

export default AssetFileViewer;
