import { Alert, Input, InputNumber, InputTag, Switch } from '@arco-design/web-react';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './TjuaeManifestRenderer.module.css';

type JsonObject = Record<string, unknown>;
type JsonPath = Array<string | number>;

type TjuaeManifestRendererProps = {
  content: string;
  fileName?: string;
  readOnly?: boolean;
  onContentChange?: (content: string) => void;
};

type TjuaeManifestDiffRendererProps = {
  originalContent: string;
  modifiedContent: string;
  sideBySide?: boolean;
};

const MANIFEST_FILE_PATTERN = /^\.tjuae-([a-z0-9-]+)\.json$/iu;
const ROOT_FIELD_ORDER = ['$schema', 'schemaVersion', 'id', 'version', 'categories', 'enabled', 'autoInject', 'source'];
const SKILL_HIDDEN_ROOT_FIELDS = new Set(['$schema', 'schemaVersion', 'id']);
const SKILL_READ_ONLY_ROOT_FIELDS = new Set(['source']);
const SOURCE_KIND_TRANSLATION_KEYS = {
  local: 'preview.tjuaeManifest.sourceKinds.local',
  market: 'preview.tjuaeManifest.sourceKinds.market',
} as const;

const FIELD_TRANSLATION_KEYS = {
  $schema: 'preview.tjuaeManifest.fields.schema',
  schemaVersion: 'preview.tjuaeManifest.fields.schemaVersion',
  id: 'preview.tjuaeManifest.fields.id',
  version: 'preview.tjuaeManifest.fields.version',
  categories: 'preview.tjuaeManifest.fields.categories',
  enabled: 'preview.tjuaeManifest.fields.enabled',
  autoInject: 'preview.tjuaeManifest.fields.autoInject',
  source: 'preview.tjuaeManifest.fields.source',
  kind: 'preview.tjuaeManifest.fields.sourceKind',
  marketId: 'preview.tjuaeManifest.fields.marketId',
  repository: 'preview.tjuaeManifest.fields.repository',
  path: 'preview.tjuaeManifest.fields.path',
  revision: 'preview.tjuaeManifest.fields.revision',
  name: 'preview.tjuaeManifest.fields.name',
  description: 'preview.tjuaeManifest.fields.description',
  tags: 'preview.tjuaeManifest.fields.tags',
  releaseNotes: 'preview.tjuaeManifest.fields.releaseNotes',
} as const;

type Translator = ReturnType<typeof useTranslation>['t'];

const translatedLabel = (label: string, t: Translator): string => {
  const key = FIELD_TRANSLATION_KEYS[label as keyof typeof FIELD_TRANSLATION_KEYS];
  if (key) return t(key);
  return label
    .replace(/[_-]+/gu, ' ')
    .replace(/([a-z\d])([A-Z])/gu, '$1 $2')
    .replace(/^./u, (value) => value.toLocaleUpperCase());
};

export const isTjuaeManifestFileName = (fileName?: string): boolean =>
  Boolean(fileName && MANIFEST_FILE_PATTERN.test(fileName));

const isJsonObject = (value: unknown): value is JsonObject =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const orderedEntries = (value: JsonObject, path: JsonPath): Array<[string, unknown]> => {
  const entries = Object.entries(value);
  if (path.length > 0) return entries;
  const index = new Map(ROOT_FIELD_ORDER.map((key, position) => [key, position]));
  return entries.sort(([left], [right]) => {
    const leftIndex = index.get(left) ?? ROOT_FIELD_ORDER.length;
    const rightIndex = index.get(right) ?? ROOT_FIELD_ORDER.length;
    return leftIndex === rightIndex ? left.localeCompare(right) : leftIndex - rightIndex;
  });
};

const updateJsonValue = (source: JsonObject, path: JsonPath, nextValue: unknown): JsonObject => {
  const clone = JSON.parse(JSON.stringify(source)) as JsonObject;
  let cursor: JsonObject | unknown[] = clone;
  path.forEach((segment, index) => {
    if (index === path.length - 1) {
      if (Array.isArray(cursor) && typeof segment === 'number') cursor[segment] = nextValue;
      else if (!Array.isArray(cursor) && typeof segment === 'string') cursor[segment] = nextValue;
      return;
    }
    const nextCursor = Array.isArray(cursor) ? cursor[segment as number] : cursor[segment as string];
    if (isJsonObject(nextCursor) || Array.isArray(nextCursor)) cursor = nextCursor;
  });
  return clone;
};

const manifestKind = (fileName?: string): string => fileName?.match(MANIFEST_FILE_PATTERN)?.[1] ?? 'manifest';

const translatedKind = (kind: string, t: Translator): string => {
  if (kind === 'skill') return t('preview.tjuaeManifest.kinds.skill');
  if (kind === 'assistant') return t('preview.tjuaeManifest.kinds.assistant');
  if (kind === 'agent') return t('preview.tjuaeManifest.kinds.agent');
  if (kind === 'model') return t('preview.tjuaeManifest.kinds.model');
  if (kind === 'tool') return t('preview.tjuaeManifest.kinds.tool');
  if (kind === 'team') return t('preview.tjuaeManifest.kinds.team');
  if (kind === 'project') return t('preview.tjuaeManifest.kinds.project');
  return t('preview.tjuaeManifest.kinds.manifest');
};

const flattenJson = (value: unknown, prefix = '', target = new Map<string, unknown>()): Map<string, unknown> => {
  if (isJsonObject(value)) {
    Object.entries(value).forEach(([key, child]) => flattenJson(child, prefix ? `${prefix}.${key}` : key, target));
  } else {
    target.set(prefix || '$', value);
  }
  return target;
};

const formatDiffValue = (value: unknown): string =>
  value === undefined ? '—' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);

const ManifestField: React.FC<{
  label: string;
  value: unknown;
  path: JsonPath;
  readOnly: boolean;
  onChange: (path: JsonPath, value: unknown) => void;
}> = ({ label, value, path, readOnly, onChange }) => {
  const { t } = useTranslation();
  const displayLabel = translatedLabel(label, t);
  if (label === 'kind' && (value === 'local' || value === 'market')) {
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{displayLabel}</span>
        <Input value={t(SOURCE_KIND_TRANSLATION_KEYS[value])} readOnly />
      </div>
    );
  }
  if (isJsonObject(value)) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionTitle}>{displayLabel}</div>
        <div className={styles.sectionBody}>
          {orderedEntries(value, path).map(([key, child]) => (
            <ManifestField
              key={key}
              label={key}
              value={child}
              path={[...path, key]}
              readOnly={readOnly}
              onChange={onChange}
            />
          ))}
        </div>
      </section>
    );
  }

  if (Array.isArray(value)) {
    const primitiveValues = value.every((item) => ['string', 'number'].includes(typeof item));
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{displayLabel}</span>
        {primitiveValues ? (
          <InputTag
            value={value.map(String)}
            readOnly={readOnly}
            allowClear={!readOnly}
            onChange={(items) => onChange(path, items)}
          />
        ) : (
          <div className={styles.collection}>
            {value.map((item, index) => (
              <ManifestField
                key={`${label}-${index}`}
                label={`${index + 1}`}
                value={item}
                path={[...path, index]}
                readOnly={readOnly}
                onChange={onChange}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{displayLabel}</span>
        <Switch size='small' checked={value} disabled={readOnly} onChange={(checked) => onChange(path, checked)} />
      </div>
    );
  }

  if (typeof value === 'number') {
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{displayLabel}</span>
        <InputNumber value={value} readOnly={readOnly} onChange={(next) => onChange(path, next)} />
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{displayLabel}</span>
      <Input value={value == null ? '' : String(value)} readOnly={readOnly} onChange={(next) => onChange(path, next)} />
    </div>
  );
};

const TjuaeManifestRenderer: React.FC<TjuaeManifestRendererProps> = ({
  content,
  fileName,
  readOnly = false,
  onContentChange,
}) => {
  const { t } = useTranslation();
  const parsed = useMemo(() => {
    try {
      const value = JSON.parse(content) as unknown;
      return isJsonObject(value) ? value : null;
    } catch {
      return null;
    }
  }, [content]);

  const handleChange = useCallback(
    (path: JsonPath, value: unknown) => {
      if (!parsed || readOnly || !onContentChange) return;
      let next = updateJsonValue(parsed, path, value);
      if (fileName === '.tjuae-skill.json' && path.length === 1) {
        if (path[0] === 'enabled' && value === false) next = updateJsonValue(next, ['autoInject'], false);
        if (path[0] === 'autoInject' && value === true) next = updateJsonValue(next, ['enabled'], true);
      }
      onContentChange(`${JSON.stringify(next, null, 2)}\n`);
    },
    [fileName, onContentChange, parsed, readOnly]
  );

  if (!parsed) {
    return (
      <div className={styles.invalid}>
        <Alert type='error' content={t('preview.tjuaeManifest.invalidJson')} />
      </div>
    );
  }

  const kind = manifestKind(fileName);
  const visibleEntries = orderedEntries(parsed, []).filter(
    ([key]) => kind !== 'skill' || !SKILL_HIDDEN_ROOT_FIELDS.has(key)
  );
  return (
    <div className={styles.root} data-testid='tjuae-manifest-preview'>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Tjuae · {translatedKind(kind, t)}</div>
          <h2 className={styles.title}>{String(parsed.id ?? fileName ?? kind)}</h2>
          <p className={styles.subtitle}>{t('preview.tjuaeManifest.description')}</p>
        </div>
        <span className={styles.mode}>
          {readOnly ? t('preview.tjuaeManifest.readOnly') : t('preview.tjuaeManifest.editable')}
        </span>
      </header>
      <div className={styles.content}>
        {visibleEntries.map(([key, value]) => (
          <ManifestField
            key={key}
            label={key}
            value={value}
            path={[key]}
            readOnly={readOnly || (kind === 'skill' && SKILL_READ_ONLY_ROOT_FIELDS.has(key))}
            onChange={handleChange}
          />
        ))}
      </div>
    </div>
  );
};

export const TjuaeManifestDiffRenderer: React.FC<TjuaeManifestDiffRendererProps> = ({
  originalContent,
  modifiedContent,
  sideBySide = false,
}) => {
  const { t } = useTranslation();
  const comparison = useMemo(() => {
    try {
      const before = JSON.parse(originalContent) as unknown;
      const after = JSON.parse(modifiedContent) as unknown;
      const beforeFields = flattenJson(before);
      const afterFields = flattenJson(after);
      const paths = new Set([...beforeFields.keys(), ...afterFields.keys()]);
      return Array.from(paths)
        .map((path) => ({ path, before: beforeFields.get(path), after: afterFields.get(path) }))
        .filter(({ before, after }) => JSON.stringify(before) !== JSON.stringify(after));
    } catch {
      return null;
    }
  }, [modifiedContent, originalContent]);

  if (!comparison) {
    return (
      <div className={styles.invalid}>
        <Alert type='error' content={t('preview.tjuaeManifest.invalidJson')} />
      </div>
    );
  }

  return (
    <div className={styles.diffRoot} data-testid='tjuae-manifest-diff-preview'>
      <header className={styles.diffHeader}>
        <div>
          <h2 className={styles.title}>{t('preview.tjuaeManifest.changes')}</h2>
          <p className={styles.subtitle}>{t('preview.tjuaeManifest.diffDescription')}</p>
        </div>
        <span className={styles.mode}>{comparison.length}</span>
      </header>
      {comparison.length === 0 ? (
        <div className={styles.empty}>{t('preview.tjuaeManifest.noChanges')}</div>
      ) : (
        <div className={styles.diffList}>
          {comparison.map((change) => (
            <article key={change.path} className={styles.diffItem}>
              <span className={styles.diffPath}>
                {change.path
                  .split('.')
                  .map((segment) => translatedLabel(segment, t))
                  .join(' / ')}
              </span>
              <div className={sideBySide ? styles.diffColumns : styles.diffStack}>
                <div className={styles.before}>
                  <span>{t('preview.tjuaeManifest.before')}</span>
                  <pre>{formatDiffValue(change.before)}</pre>
                </div>
                <div className={styles.after}>
                  <span>{t('preview.tjuaeManifest.after')}</span>
                  <pre>{formatDiffValue(change.after)}</pre>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default TjuaeManifestRenderer;
