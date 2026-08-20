import { ipcBridge } from '@/common';
import type {
  AssistantCatalogDetail,
  AssistantDefaultRef,
  UpdateAssistantCatalogSettingsRequest,
} from '@/common/types/platform/assistantCatalog';
import { skillIdentityKey, type SkillCatalogItem } from '@/common/types/platform/skill';
import { useManagedAgentRuntimeCatalog } from '@/renderer/hooks/agent/useManagedAgents';
import { useModelProviderList } from '@/renderer/hooks/agent/useModelProviderList';
import { ensureBackendMcpCatalog } from '@/renderer/hooks/mcp/catalog';
import MarkdownPreview from '@/renderer/pages/conversation/Preview/components/viewers/MarkdownViewer';
import { resolveBackendAssetUrl } from '@/renderer/utils/platform';
import { DndContext, PointerSensor, closestCenter, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Input, Radio, Select } from '@arco-design/web-react';
import { Brain, CloseSmall, Drag, IdCard, ListView, Robot, UploadPicture } from '@icon-park/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import styles from './AssistantSettingsWorkspace.module.css';

type SettingsDraft = Omit<UpdateAssistantCatalogSettingsRequest, 'source' | 'namespace' | 'slug'>;

type Props = {
  detail: AssistantCatalogDetail;
  busy: boolean;
  onSave: (draft: SettingsDraft) => void;
};

type Section = 'identity' | 'prompts' | 'defaults' | 'rules';

const skillValue = (identity: AssistantDefaultRef) => `${identity.source}:${identity.namespace}:${identity.slug}`;

const parseSkillValue = (value: string): AssistantDefaultRef => {
  const [source = 'mine', namespace = '', ...slugParts] = value.split(':');
  return { source, namespace, slug: slugParts.join(':') };
};

const SortableSkillRow: React.FC<{
  id: string;
  skill?: SkillCatalogItem;
  disabled: boolean;
  onRemove: () => void;
}> = ({ id, skill, disabled, onRemove }) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const identity = parseSkillValue(id);
  return (
    <div
      ref={setNodeRef}
      className={`${styles.skillRow} ${isDragging ? styles.skillRowDragging : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type='button'
        className={styles.skillDragHandle}
        aria-label={t('settings.assistantReorderHintShort')}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <Drag theme='outline' size='16' />
      </button>
      <div className={styles.skillSummary}>
        <div>
          <strong>{skill?.name ?? identity.slug}</strong>
          <span>{skill ? `v${skill.latestVersion}` : identity.source}</span>
        </div>
        <p>{skill?.description || t('settings.skillsHub.noDescription')}</p>
      </div>
      <Button
        type='text'
        shape='circle'
        aria-label={t('common.remove')}
        icon={<CloseSmall theme='outline' size='16' />}
        disabled={disabled}
        onClick={onRemove}
      />
    </div>
  );
};

const AssistantSettingsWorkspace: React.FC<Props> = ({ detail, busy, onSave }) => {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('identity');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState<string>();
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>();
  const [promptsText, setPromptsText] = useState('');
  const [agent, setAgent] = useState<string>();
  const [modelMode, setModelMode] = useState('auto');
  const [model, setModel] = useState<string>();
  const [permissionMode, setPermissionMode] = useState('auto');
  const [permission, setPermission] = useState<string>();
  const [thoughtMode, setThoughtMode] = useState('auto');
  const [thought, setThought] = useState<string>();
  const [skills, setSkills] = useState<string[]>([]);
  const [skillToAdd, setSkillToAdd] = useState<string>();
  const [mcps, setMcps] = useState<string[]>([]);
  const [rules, setRules] = useState('');
  const [rulesMode, setRulesMode] = useState<'edit' | 'render'>('edit');
  const editable = detail.item.editable && detail.manifest.version === detail.item.latestVersion;
  const avatarPreviewUrl = avatarDataUrl || resolveBackendAssetUrl(detail.item.avatarUrl);

  const managedAgents = useManagedAgentRuntimeCatalog();
  const { providers, getAvailableModels } = useModelProviderList();
  const { data: skillPage } = useSWR('assistant-settings-skill-catalog', () =>
    ipcBridge.fs.listSkillCatalog.invoke({ limit: 200 })
  );
  const { data: mcpCatalog } = useSWR('assistant-settings-mcp-catalog', ensureBackendMcpCatalog);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    setName(detail.manifest.name);
    setDescription(detail.manifest.description);
    setAvatar(detail.manifest.avatar);
    setAvatarDataUrl(undefined);
    setPromptsText(detail.manifest.recommendedPrompts.join('\n'));
    setAgent(detail.manifest.defaults.agent);
    setModelMode(detail.manifest.defaults.model.mode);
    setModel(detail.manifest.defaults.model.value);
    setPermissionMode(detail.manifest.defaults.permission.mode);
    setPermission(detail.manifest.defaults.permission.value);
    setThoughtMode(detail.manifest.defaults.thoughtLevel.mode);
    setThought(detail.manifest.defaults.thoughtLevel.value);
    setSkills(detail.manifest.defaults.skills.map(skillValue));
    setMcps(detail.manifest.defaults.mcps);
    setRules(detail.readme);
  }, [detail]);

  const agentOptions = useMemo(
    () =>
      managedAgents
        .filter((item) => item.enabled && item.installed)
        .map((item) => ({ value: item.id, label: item.name })),
    [managedAgents]
  );
  const modelOptions = useMemo(
    () =>
      providers.flatMap((provider) =>
        getAvailableModels(provider).map((value) => ({ value, label: `${provider.name || provider.id} · ${value}` }))
      ),
    [getAvailableModels, providers]
  );
  const skillOptions = useMemo(
    () =>
      (skillPage?.items ?? []).map((item) => ({
        value: skillIdentityKey(item.identity),
        label: item.name,
      })),
    [skillPage]
  );
  const skillById = useMemo(
    () => new Map((skillPage?.items ?? []).map((item) => [skillIdentityKey(item.identity), item])),
    [skillPage]
  );
  const availableSkillOptions = useMemo(
    () => skillOptions.filter((option) => !skills.includes(option.value)),
    [skillOptions, skills]
  );
  const mcpOptions = useMemo(
    () => (mcpCatalog?.allServers ?? []).map((item) => ({ value: item.id, label: item.name })),
    [mcpCatalog]
  );

  const pickAvatar = async () => {
    const files = await ipcBridge.dialog.showOpen.invoke({
      properties: ['openFile'],
      filters: [
        { name: t('settings.assistantAvatarImageFiles'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] },
      ],
    });
    if (!files?.[0]) return;
    const dataUrl = await ipcBridge.fs.getImageBase64.invoke({ path: files[0] });
    if (dataUrl) setAvatarDataUrl(dataUrl);
  };

  const save = () =>
    onSave({
      name: name.trim(),
      description: description.trim(),
      avatar,
      avatarDataUrl,
      defaults: {
        agent,
        model: { mode: modelMode, value: modelMode === 'fixed' ? model : undefined },
        permission: { mode: permissionMode, value: permissionMode === 'fixed' ? permission : undefined },
        thoughtLevel: { mode: thoughtMode, value: thoughtMode === 'fixed' ? thought : undefined },
        skills: skills.map(parseSkillValue),
        mcps,
      },
      recommendedPrompts: promptsText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      rules,
    });

  const reorderSkills = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setSkills((current) => {
      const from = current.indexOf(String(active.id));
      const to = current.indexOf(String(over.id));
      return from < 0 || to < 0 ? current : arrayMove(current, from, to);
    });
  };

  const scalarField = (
    label: string,
    mode: string,
    setMode: (value: string) => void,
    value: string | undefined,
    setValue: (value?: string) => void,
    options: Array<{ value: string; label: string }>,
    placeholder: string
  ) => (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.fieldControl}>
        <Radio.Group
          type='button'
          value={mode}
          disabled={!editable}
          onChange={setMode}
          options={[
            { value: 'auto', label: t('settings.assistantSelectAutoRememberLastUsed') },
            { value: 'fixed', label: t('settings.assistantUseFixedValue') },
          ]}
        />
        {mode === 'fixed' ? (
          <Select
            style={{ marginTop: 10, width: '100%' }}
            value={value}
            options={options}
            allowCreate
            showSearch
            disabled={!editable}
            placeholder={placeholder}
            onChange={setValue}
          />
        ) : null}
      </div>
    </label>
  );

  const sections = [
    { key: 'identity' as const, icon: <IdCard />, label: t('settings.assistantIdentitySection') },
    { key: 'prompts' as const, icon: <ListView />, label: t('settings.assistantRecommendedPromptsLabel') },
    { key: 'defaults' as const, icon: <Robot />, label: t('settings.assistantDefaultConfigSection') },
    { key: 'rules' as const, icon: <Brain />, label: t('settings.assistantRules') },
  ];

  return (
    <div className={styles.workspace} data-testid='assistant-settings-workspace'>
      <aside className={styles.rail}>
        {sections.map((item) => (
          <Button
            key={item.key}
            type='text'
            icon={item.icon}
            className={section === item.key ? styles.active : undefined}
            onClick={() => setSection(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </aside>
      <section className={styles.content}>
        <header className={styles.sectionHeader}>
          <h3>{sections.find((item) => item.key === section)?.label}</h3>
          <p>{t(`settings.assistantCatalog.settingsHints.${section}`)}</p>
        </header>
        {section === 'identity' ? (
          <div className={styles.fields}>
            <label className={styles.field}>
              <span>{t('settings.assistantName')}</span>
              <Input value={name} disabled={!editable} onChange={setName} />
            </label>
            <label className={styles.field}>
              <span>{t('settings.assistantDescription')}</span>
              <Input.TextArea
                value={description}
                disabled={!editable}
                autoSize={{ minRows: 3, maxRows: 8 }}
                onChange={setDescription}
              />
            </label>
            <div className={styles.field}>
              <span>{t('settings.assistantNameAvatar')}</span>
              <div className={styles.avatarRow}>
                <div className={styles.avatarPreview}>
                  {avatarPreviewUrl ? <img src={avatarPreviewUrl} alt='' /> : name.slice(0, 1)}
                </div>
                <Button icon={<UploadPicture />} disabled={!editable} onClick={() => void pickAvatar()}>
                  {t('settings.assistantAvatarUploadImage')}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {section === 'prompts' ? (
          <Input.TextArea
            value={promptsText}
            disabled={!editable}
            autoSize={{ minRows: 12, maxRows: 24 }}
            placeholder={t('settings.assistantRecommendedPromptsPlaceholder')}
            onChange={setPromptsText}
          />
        ) : null}
        {section === 'defaults' ? (
          <div className={styles.fields}>
            <label className={styles.field}>
              <span>{t('settings.assistantMainAgent')}</span>
              <Select
                value={agent}
                options={agentOptions}
                allowCreate
                showSearch
                disabled={!editable}
                onChange={setAgent}
              />
            </label>
            {scalarField(
              t('settings.assistantDefaultModelLabel'),
              modelMode,
              setModelMode,
              model,
              setModel,
              modelOptions,
              t('settings.assistantSelectDefaultModel')
            )}
            {scalarField(
              t('settings.assistantDefaultPermissionLabel'),
              permissionMode,
              setPermissionMode,
              permission,
              setPermission,
              [],
              t('settings.assistantSelectDefaultPermission')
            )}
            {scalarField(
              t('settings.assistantDefaultThoughtLevelLabel'),
              thoughtMode,
              setThoughtMode,
              thought,
              setThought,
              [],
              t('settings.assistantSelectDefaultThoughtLevel')
            )}
            <label className={styles.field}>
              <span>{t('settings.assistantDefaultSkillsLabel')}</span>
              <div className={styles.skillField}>
                <Select
                  value={skillToAdd}
                  options={availableSkillOptions}
                  showSearch
                  allowClear
                  disabled={!editable || availableSkillOptions.length === 0}
                  placeholder={t('settings.addSkills')}
                  onChange={(value) => {
                    if (!value) return;
                    setSkills((current) => (current.includes(value) ? current : [...current, value]));
                    setSkillToAdd(undefined);
                  }}
                />
                <small>{t('settings.assistantSkillsHint')}</small>
                {skills.length ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderSkills}>
                    <SortableContext items={skills} strategy={verticalListSortingStrategy}>
                      <div className={styles.skillList}>
                        {skills.map((id) => (
                          <SortableSkillRow
                            key={id}
                            id={id}
                            skill={skillById.get(id)}
                            disabled={!editable}
                            onRemove={() => setSkills((current) => current.filter((item) => item !== id))}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className={styles.skillEmpty}>{t('settings.assistantNoDefaultSkillsSelected')}</div>
                )}
              </div>
            </label>
            <label className={styles.field}>
              <span>{t('settings.assistantDefaultMcpLabel')}</span>
              <Select
                mode='multiple'
                value={mcps}
                options={mcpOptions}
                allowClear
                showSearch
                disabled={!editable}
                onChange={setMcps}
              />
            </label>
          </div>
        ) : null}
        {section === 'rules' ? (
          <>
            <div className={styles.rulesToolbar}>
              <Radio.Group
                type='button'
                value={rulesMode}
                onChange={setRulesMode}
                options={[
                  { value: 'edit', label: t('settings.promptEdit') },
                  { value: 'render', label: t('settings.assistantCatalog.render') },
                ]}
              />
            </div>
            {rulesMode === 'edit' ? (
              <Input.TextArea className={styles.rulesEditor} value={rules} disabled={!editable} onChange={setRules} />
            ) : (
              <article className={styles.rulesPreview}>
                <MarkdownPreview content={rules} />
              </article>
            )}
          </>
        ) : null}
        {editable ? (
          <footer className={styles.footer}>
            <Button type='primary' loading={busy} disabled={!name.trim() || !rules.trim()} onClick={save}>
              {t('settings.saveAssistant')}
            </Button>
          </footer>
        ) : null}
      </section>
    </div>
  );
};

export default AssistantSettingsWorkspace;
