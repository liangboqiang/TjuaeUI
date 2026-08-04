import type { AssetFile, AssetKind } from '@/common/types/agent/assets';
import MarkdownView from '@/renderer/components/Markdown';
import { Alert, Button, Empty, Skeleton, Tag } from '@arco-design/web-react';
import { FileText, FolderOpen } from '@icon-park/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type SemanticAssetFile = {
  path: string;
  size: number;
  mediaType: string;
};

type AssetSemanticDetailProps = {
  assetKey: string;
  kind: AssetKind;
  description?: string;
  runtimeId?: string;
  entryFile?: string;
  files: SemanticAssetFile[];
  dependencies?: string[];
  version?: string;
  runtimeState?: string;
  healthState?: string;
  loadFile: (path: string) => Promise<AssetFile>;
  onOpenFile: (path: string) => void;
};

type JsonRecord = Record<string, unknown>;

const ENTRY_FILES: Record<AssetKind, string> = {
  assistant: 'assistant.json',
  engineAdapter: 'engine-adapter.json',
  skill: 'SKILL.md',
  mcp: 'mcp.json',
};

const asRecord = (value: unknown): JsonRecord | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonRecord) : undefined;

const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const parseJson = (content?: string): JsonRecord | undefined => {
  if (!content) return undefined;
  try {
    return asRecord(JSON.parse(content));
  } catch {
    return undefined;
  }
};

const parseFrontmatter = (content?: string): { fields: [string, string][]; body: string } => {
  if (!content?.startsWith('---')) return { fields: [], body: content ?? '' };
  const end = content.indexOf('\n---', 3);
  if (end < 0) return { fields: [], body: content };
  const fields = content
    .slice(3, end)
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')] as [string, string]);
  return { fields, body: content.slice(end + 4).trimStart() };
};

const parseHeadings = (content: string): string[] =>
  content
    .split(/\r?\n/)
    .map((line) =>
      line
        .match(/^#{1,3}\s+(.+)$/)?.[1]
        ?.replace(/\s+#+$/, '')
        .trim()
    )
    .filter((heading): heading is string => Boolean(heading));

const listFolderFiles = (files: SemanticAssetFile[], folder: string): SemanticAssetFile[] =>
  files.filter((file) => file.path.startsWith(`${folder}/`));

const SemanticSection: React.FC<{ title: string; children: React.ReactNode; testId?: string }> = ({
  title,
  children,
  testId,
}) => (
  <section className='border-t border-border-2 py-16px first:border-t-0 first:pt-0' data-testid={testId}>
    <h3 className='m-0 mb-10px text-12px font-700 uppercase tracking-[0.08em] text-t-tertiary'>{title}</h3>
    {children}
  </section>
);

const DefinitionList: React.FC<{ rows: Array<[string, React.ReactNode]> }> = ({ rows }) => (
  <dl className='m-0 grid grid-cols-[minmax(104px,auto)_minmax(0,1fr)] gap-x-16px gap-y-8px text-12px'>
    {rows.map(([label, value]) => (
      <React.Fragment key={label}>
        <dt className='text-t-tertiary'>{label}</dt>
        <dd className='m-0 min-w-0 break-words text-t-primary'>{value}</dd>
      </React.Fragment>
    ))}
  </dl>
);

const StringList: React.FC<{ values: string[]; emptyLabel: string; onOpenFile?: (path: string) => void }> = ({
  values,
  emptyLabel,
  onOpenFile,
}) =>
  values.length > 0 ? (
    <ul className='m-0 flex list-none flex-col gap-7px p-0 text-12px text-t-primary'>
      {values.map((value) => (
        <li key={value} className='flex min-w-0 items-start gap-7px'>
          <span aria-hidden='true' className='mt-7px h-4px w-4px shrink-0 rounded-full bg-primary-6' />
          {onOpenFile ? (
            <Button
              type='text'
              size='mini'
              className='!h-auto !min-w-0 !p-0 !text-left'
              onClick={() => onOpenFile(value)}
            >
              <span className='break-all'>{value}</span>
            </Button>
          ) : (
            <span className='break-words'>{value}</span>
          )}
        </li>
      ))}
    </ul>
  ) : (
    <span className='text-12px text-t-tertiary'>{emptyLabel}</span>
  );

const AssetSemanticDetail: React.FC<AssetSemanticDetailProps> = ({
  assetKey,
  kind,
  description,
  runtimeId,
  entryFile,
  files,
  dependencies = [],
  version,
  runtimeState,
  healthState,
  loadFile,
  onOpenFile,
}) => {
  const { t } = useTranslation();
  const [definitionFile, setDefinitionFile] = useState<AssetFile>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestRef = useRef(0);
  const canonicalEntry = ENTRY_FILES[kind];
  const resolvedEntryFile =
    files.find((file) => file.path === canonicalEntry || file.path.endsWith(`/${canonicalEntry}`))?.path ?? entryFile;

  useEffect(() => {
    const requestId = ++requestRef.current;
    setDefinitionFile(undefined);
    setError(false);
    if (!resolvedEntryFile) return;
    setIsLoading(true);
    void loadFile(resolvedEntryFile)
      .then((file) => {
        if (requestRef.current === requestId) setDefinitionFile(file);
      })
      .catch(() => {
        if (requestRef.current === requestId) setError(true);
      })
      .finally(() => {
        if (requestRef.current === requestId) setIsLoading(false);
      });
    return () => {
      requestRef.current += 1;
    };
  }, [assetKey, loadFile, resolvedEntryFile]);

  const definition = useMemo(() => parseJson(definitionFile?.content), [definitionFile?.content]);
  const skill = useMemo(() => parseFrontmatter(definitionFile?.content), [definitionFile?.content]);
  const headings = useMemo(() => parseHeadings(skill.body), [skill.body]);
  const noData = t('settings.assetWorkbench.semantic.noData');

  if (isLoading && !definitionFile) {
    return (
      <div className='p-18px'>
        <Skeleton animation text={{ rows: 10 }} />
      </div>
    );
  }

  const assistantRules = Object.values(asRecord(definition?.rules) ?? {}).filter(
    (value): value is string => typeof value === 'string'
  );
  const assistantPrompts = asStringArray(definition?.recommendedPrompts);
  const allDependencies = [...new Set([...dependencies, ...asStringArray(definition?.skillDependencies)])];
  const protocol = asRecord(definition?.protocol);
  const runtime = asRecord(definition?.runtime);
  const transportValue = asRecord(definition?.transport);
  const transportPackage = asRecord(transportValue?.package);
  const configurationSchema = asRecord(definition?.configurationSchema);
  const capabilities = Object.entries(asRecord(definition?.capabilities) ?? {})
    .filter(([, value]) => value === true || (Array.isArray(value) && value.length > 0))
    .map(([key, value]) => (Array.isArray(value) ? `${key}: ${value.join(', ')}` : key));
  const configurationFields = Array.isArray(configurationSchema?.fields)
    ? configurationSchema.fields.map(asRecord).filter((field): field is JsonRecord => Boolean(field))
    : [];
  const skillFolders = ['scripts', 'references', 'templates', 'resources'] as const;

  return (
    <div
      className='grid min-h-0 grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_260px]'
      data-testid='asset-semantic-detail'
    >
      <main className='min-w-0 p-18px xl:pr-22px'>
        {error ? (
          <Alert
            className='mb-14px'
            type='warning'
            showIcon
            title={t('settings.assetWorkbench.semantic.loadError')}
            content={t('settings.assetWorkbench.semantic.loadErrorDescription')}
          />
        ) : null}

        <SemanticSection title={t('settings.assetWorkbench.semantic.overview')} testId='asset-semantic-overview'>
          <p className='m-0 max-w-760px text-13px leading-22px text-t-secondary'>{description || noData}</p>
          <div className='mt-12px flex flex-wrap gap-6px'>
            <Tag bordered>{t(`settings.assetWorkbench.kinds.${kind}`)}</Tag>
            {runtimeId ? <Tag bordered>{runtimeId}</Tag> : null}
            {resolvedEntryFile ? <Tag bordered>{resolvedEntryFile}</Tag> : null}
          </div>
        </SemanticSection>

        {kind === 'skill' ? (
          <>
            <SemanticSection title={t('settings.assetWorkbench.semantic.content')} testId='asset-semantic-content'>
              {skill.body ? <MarkdownView>{skill.body}</MarkdownView> : <Empty description={noData} />}
            </SemanticSection>
            <SemanticSection title={t('settings.assetWorkbench.semantic.structure')}>
              <div className='grid grid-cols-1 gap-18px lg:grid-cols-2'>
                <div>
                  <h4 className='m-0 mb-8px text-12px font-600 text-t-secondary'>
                    {t('settings.assetWorkbench.semantic.frontmatter')}
                  </h4>
                  {skill.fields.length > 0 ? <DefinitionList rows={skill.fields} /> : <span>{noData}</span>}
                </div>
                <div>
                  <h4 className='m-0 mb-8px text-12px font-600 text-t-secondary'>
                    {t('settings.assetWorkbench.semantic.tableOfContents')}
                  </h4>
                  <StringList values={headings} emptyLabel={noData} />
                </div>
              </div>
              <div className='mt-18px grid grid-cols-1 gap-x-20px gap-y-14px sm:grid-cols-2'>
                {skillFolders.map((folder) => (
                  <div key={folder}>
                    <h4 className='m-0 mb-7px text-12px font-600 text-t-secondary'>
                      {t(`settings.assetWorkbench.semantic.${folder}`)}
                    </h4>
                    <StringList
                      values={listFolderFiles(files, folder).map((file) => file.path)}
                      emptyLabel={noData}
                      onOpenFile={onOpenFile}
                    />
                  </div>
                ))}
              </div>
            </SemanticSection>
          </>
        ) : null}

        {kind === 'assistant' ? (
          <SemanticSection title={t('settings.assetWorkbench.semantic.content')} testId='asset-semantic-content'>
            <div className='grid grid-cols-1 gap-20px lg:grid-cols-2'>
              <div>
                <h4 className='m-0 mb-8px text-12px font-600 text-t-secondary'>
                  {t('settings.assetWorkbench.semantic.rules')}
                </h4>
                <StringList values={assistantRules} emptyLabel={noData} onOpenFile={onOpenFile} />
              </div>
              <div>
                <h4 className='m-0 mb-8px text-12px font-600 text-t-secondary'>
                  {t('settings.assetWorkbench.semantic.prompts')}
                </h4>
                <StringList values={assistantPrompts} emptyLabel={noData} />
              </div>
            </div>
          </SemanticSection>
        ) : null}

        {kind === 'engineAdapter' ? (
          <SemanticSection title={t('settings.assetWorkbench.semantic.content')} testId='asset-semantic-content'>
            <DefinitionList
              rows={[
                [
                  t('settings.assetWorkbench.semantic.protocol'),
                  `${asString(protocol?.type) ?? noData} · ${asString(protocol?.transport) ?? noData}`,
                ],
                [t('settings.assetWorkbench.semantic.command'), asString(runtime?.commandName) ?? noData],
              ]}
            />
          </SemanticSection>
        ) : null}

        {kind === 'mcp' ? (
          <SemanticSection title={t('settings.assetWorkbench.semantic.content')} testId='asset-semantic-content'>
            <DefinitionList
              rows={[
                [t('settings.assetWorkbench.semantic.transport'), asString(transportValue?.type) ?? noData],
                [
                  t('settings.assetWorkbench.semantic.package'),
                  transportPackage
                    ? `${asString(transportPackage.name) ?? ''}@${asString(transportPackage.version) ?? ''} · ${asString(transportPackage.runner) ?? ''}`
                    : noData,
                ],
                [
                  t('settings.assetWorkbench.semantic.tools'),
                  asRecord(definition?.capabilities)?.tools === true
                    ? t('settings.assetWorkbench.semantic.supported')
                    : t('settings.assetWorkbench.semantic.notDeclared'),
                ],
              ]}
            />
          </SemanticSection>
        ) : null}

        {kind !== 'skill' ? (
          <SemanticSection title={t('settings.assetWorkbench.semantic.capabilities')}>
            <StringList values={capabilities} emptyLabel={noData} />
          </SemanticSection>
        ) : null}

        <SemanticSection title={t('settings.assetWorkbench.semantic.dependencies')}>
          <StringList values={allDependencies} emptyLabel={noData} />
        </SemanticSection>

        {(kind === 'engineAdapter' || kind === 'mcp') && (
          <SemanticSection title={t('settings.assetWorkbench.semantic.configuration')}>
            {configurationFields.length > 0 ? (
              <div className='divide-y divide-border-1 border-y border-border-1'>
                {configurationFields.map((field) => {
                  const binding = asRecord(field.binding);
                  return (
                    <div
                      key={asString(field.key)}
                      className='grid grid-cols-[minmax(100px,1fr)_minmax(0,2fr)] gap-12px py-9px text-12px'
                    >
                      <div className='min-w-0'>
                        <div className='truncate font-600 text-t-primary'>
                          {asString(field.label) ?? asString(field.key)}
                        </div>
                        <div className='mt-2px text-10px text-t-tertiary'>
                          {field.required === true
                            ? t('settings.assetWorkbench.semantic.required')
                            : t('settings.assetWorkbench.semantic.optional')}
                          {' · '}
                          {field.secret === true
                            ? t('settings.assetWorkbench.semantic.secret')
                            : t('settings.assetWorkbench.semantic.publicValue')}
                        </div>
                      </div>
                      <div className='min-w-0 break-all font-mono text-11px text-t-secondary'>
                        {asString(binding?.target) ?? noData}:{asString(binding?.name) ?? noData}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className='text-12px text-t-tertiary'>{noData}</span>
            )}
          </SemanticSection>
        )}
      </main>

      <aside className='border-t border-border-2 bg-fill-1/30 p-18px xl:border-l xl:border-t-0'>
        <SemanticSection title={t('settings.assetWorkbench.semantic.runtime')}>
          <DefinitionList
            rows={[
              [t('settings.assetWorkbench.semantic.state'), runtimeState ?? noData],
              [t('settings.assetWorkbench.semantic.health'), healthState ?? noData],
              [t('settings.assetWorkbench.semantic.runtimeId'), runtimeId ?? noData],
            ]}
          />
        </SemanticSection>
        <SemanticSection title={t('settings.assetWorkbench.semantic.version')}>
          <DefinitionList
            rows={[
              [t('settings.assetWorkbench.semantic.version'), version ?? noData],
              [t('settings.assetWorkbench.semantic.entryFile'), resolvedEntryFile ?? noData],
              [t('settings.assetWorkbench.semantic.fileCount'), String(files.length)],
            ]}
          />
        </SemanticSection>
        <SemanticSection title={t('settings.assetWorkbench.semantic.files')}>
          <Button
            type='text'
            size='small'
            icon={<FolderOpen aria-hidden='true' />}
            className='!px-0'
            onClick={() => resolvedEntryFile && onOpenFile(resolvedEntryFile)}
          >
            {t('settings.assetWorkbench.semantic.openSource')}
          </Button>
          <div className='mt-8px flex items-center gap-6px text-11px text-t-tertiary'>
            <FileText aria-hidden='true' size='13' />
            {t('settings.assetWorkbench.semantic.fileCountValue', { count: files.length })}
          </div>
        </SemanticSection>
      </aside>
    </div>
  );
};

export default AssetSemanticDetail;
