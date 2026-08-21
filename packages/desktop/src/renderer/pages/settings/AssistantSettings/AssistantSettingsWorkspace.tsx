import { ipcBridge } from '@/common';
import type {
  AssistantCatalogDetail,
  AssistantDefaultRef,
  UpdateAssistantCatalogSettingsRequest,
} from '@/common/types/platform/assistantCatalog';
import { skillIdentityKey, type SkillCatalogItem } from '@/common/types/platform/skill';
import { useManagedAgentRuntimeCatalog } from '@/renderer/hooks/agent/useManagedAgents';
import { useModelProviderList } from '@/renderer/hooks/agent/useModelProviderList';
import { useMcpServers } from '@/renderer/hooks/mcp';
import MarkdownPreview from '@/renderer/pages/conversation/Preview/components/viewers/MarkdownViewer';
import {
  buildAgentRuntimeModeState,
  buildAgentRuntimeModelInfo,
  buildAgentRuntimeThoughtLevelOption,
} from '@/renderer/utils/model/agentRuntimeCatalog';
import { DndContext, PointerSensor, closestCenter, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Input, Radio, Select } from '@arco-design/web-react';
import { Brain, CloseSmall, Drag, ListView, Robot } from '@icon-park/react';
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

type Section = 'prompts' | 'defaults' | 'rules';

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
      <Button
        type='text'
        shape='circle'
        className={styles.skillDragHandle}
        aria-label={t('settings.assistantReorderHintShort')}
        disabled={disabled}
        icon={<Drag theme='outline' size='16' />}
        {...attributes}
        {...listeners}
      />
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
  const { t, i18n } = useTranslation();
  const [section, setSection] = useState<Section>('prompts');
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

  const managedAgents = useManagedAgentRuntimeCatalog();
  const { providers, getAvailableModels } = useModelProviderList();
  const { allMcpServers, isMcpServersLoading } = useMcpServers();
  const { data: skillPage } = useSWR('assistant-settings-skill-catalog', () =>
    ipcBridge.fs.listSkillCatalog.invoke({ enabled: true, limit: 200 })
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    setPromptsText(detail.manifest.recommendedPrompts.join('\n'));
    setAgent(detail.manifest.defaults.agent);
    setModelMode(detail.manifest.defaults.model.mode === 'fixed' ? 'fixed' : 'auto');
    setModel(detail.manifest.defaults.model.value);
    setPermissionMode(detail.manifest.defaults.permission.mode === 'fixed' ? 'fixed' : 'auto');
    setPermission(detail.manifest.defaults.permission.value);
    setThoughtMode(detail.manifest.defaults.thoughtLevel.mode === 'fixed' ? 'fixed' : 'auto');
    setThought(detail.manifest.defaults.thoughtLevel.value);
    setSkills(detail.manifest.defaults.skills.map(skillValue));
    setMcps(detail.manifest.defaults.mcps);
    setRules(detail.readme);
  }, [detail]);

  const agentOptions = useMemo(() => {
    const options = managedAgents
      .filter((item) => item.enabled && item.installed)
      .map((item) => ({ value: item.id, label: item.name_i18n?.[i18n.language] || item.name }));
    if (agent && !options.some((item) => item.value === agent)) {
      options.unshift({ value: agent, label: agent });
    }
    return options;
  }, [agent, i18n.language, managedAgents]);
  const selectedAgent = useMemo(
    () => managedAgents.find((item) => item.id === agent || item.backend === agent),
    [agent, managedAgents]
  );
  const selectedAgentModelInfo = useMemo(() => buildAgentRuntimeModelInfo(selectedAgent), [selectedAgent]);
  const selectedAgentModeState = useMemo(() => buildAgentRuntimeModeState(selectedAgent), [selectedAgent]);
  const selectedAgentThoughtOption = useMemo(() => buildAgentRuntimeThoughtLevelOption(selectedAgent), [selectedAgent]);
  const modelOptions = useMemo(() => {
    const options = selectedAgentModelInfo?.available_models.length
      ? selectedAgentModelInfo.available_models.map((item) => ({
          value: item.id,
          label: item.label || item.id,
        }))
      : providers.flatMap((provider) =>
          getAvailableModels(provider).map((value) => ({ value, label: `${provider.name || provider.id} · ${value}` }))
        );
    if (model && !options.some((item) => item.value === model)) options.unshift({ value: model, label: model });
    return options;
  }, [getAvailableModels, model, providers, selectedAgentModelInfo]);
  const permissionOptions = useMemo(() => {
    const options = selectedAgentModeState.options.map((item) => ({
      value: item.value,
      label: t(`agentMode.${item.value}`, { defaultValue: item.label }),
    }));
    [
      { value: 'read-only', label: t('agentMode.read-only') },
      { value: 'auto', label: t('agentMode.auto') },
      { value: 'full-access', label: t('agentMode.full-access') },
    ].forEach((candidate) => {
      if (!options.some((item) => item.value === candidate.value)) options.push(candidate);
    });
    if (permission && !options.some((item) => item.value === permission)) {
      options.unshift({ value: permission, label: permission });
    }
    return options;
  }, [permission, selectedAgentModeState.options, t]);
  const thoughtOptions = useMemo(() => {
    const options = (selectedAgentThoughtOption?.options ?? []).map((item) => ({
      value: item.value,
      label: item.label,
    }));
    [
      { value: 'low', label: t('settings.assistantThoughtLevelLow') },
      { value: 'medium', label: t('settings.assistantThoughtLevelMedium') },
      { value: 'high', label: t('settings.assistantThoughtLevelHigh') },
      { value: 'xhigh', label: t('settings.assistantThoughtLevelExtraHigh') },
    ].forEach((candidate) => {
      if (!options.some((item) => item.value === candidate.value)) options.push(candidate);
    });
    if (thought && !options.some((item) => item.value === thought)) {
      options.unshift({ value: thought, label: thought });
    }
    return options;
  }, [selectedAgentThoughtOption, t, thought]);
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
  const mcpOptions = useMemo(() => {
    const options = allMcpServers.map((item) => ({ value: item.id, label: item.name }));
    mcps.forEach((id) => {
      if (!options.some((item) => item.value === id)) options.push({ value: id, label: id });
    });
    return options;
  }, [allMcpServers, mcps]);

  useEffect(() => {
    if (modelMode === 'fixed' && model && modelOptions.length && !modelOptions.some((item) => item.value === model)) {
      setModelMode('auto');
      setModel(undefined);
    }
    if (
      permissionMode === 'fixed' &&
      permission &&
      permissionOptions.length &&
      !permissionOptions.some((item) => item.value === permission)
    ) {
      setPermissionMode('auto');
      setPermission(undefined);
    }
    if (
      thoughtMode === 'fixed' &&
      thought &&
      thoughtOptions.length &&
      !thoughtOptions.some((item) => item.value === thought)
    ) {
      setThoughtMode('auto');
      setThought(undefined);
    }
  }, [
    model,
    modelMode,
    modelOptions,
    permission,
    permissionMode,
    permissionOptions,
    thought,
    thoughtMode,
    thoughtOptions,
  ]);

  const save = () =>
    onSave({
      name: detail.manifest.name,
      description: detail.manifest.description,
      avatar: detail.manifest.avatar,
      categories: detail.manifest.categories,
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
            showSearch
            disabled={!editable}
            placeholder={placeholder}
            onChange={(nextValue) => setValue(nextValue || undefined)}
          />
        ) : null}
      </div>
    </label>
  );

  const sections = [
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
              <Select value={agent} options={agentOptions} showSearch disabled={!editable} onChange={setAgent} />
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
              permissionOptions,
              t('settings.assistantSelectDefaultPermission')
            )}
            {scalarField(
              t('settings.assistantDefaultThoughtLevelLabel'),
              thoughtMode,
              setThoughtMode,
              thought,
              setThought,
              thoughtOptions,
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
                loading={isMcpServersLoading}
                disabled={!editable || isMcpServersLoading}
                placeholder={t('settings.assistantSelectDefaultMcp')}
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
            <Button type='primary' loading={busy} disabled={!rules.trim()} onClick={save}>
              {t('settings.saveAssistant')}
            </Button>
          </footer>
        ) : null}
      </section>
    </div>
  );
};

export default AssistantSettingsWorkspace;
