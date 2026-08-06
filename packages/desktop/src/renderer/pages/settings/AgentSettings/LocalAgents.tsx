import { ipcBridge } from '@/common';
import { parseError } from '@/common/utils';
import { formatManagedAgentDiagnosticMessage, type ManagedAgent } from '@/renderer/utils/model/agentTypes';
import TjuaeModal from '@/renderer/components/base/TjuaeModal';
import { TjuaeSearchInput } from '@/renderer/components/base';
import { useManagedAgents } from '@/renderer/hooks/agent/useManagedAgents';
import { openExternalUrl } from '@/renderer/utils/platform';
import { Button, Message, Select } from '@arco-design/web-react';
import TalkToButlerButton from '@/renderer/components/base/TalkToButlerButton';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AgentCard from './AgentCard';
import { isDeprecatedRuntimeAgentType } from '@/renderer/utils/model/agentTypeSupportPolicy';
import InlineAgentEditor, { type CustomAgentDraft } from './InlineAgentEditor';
import { getBoundAssistants, useAssistantsForAgents } from './BoundAssistants';
import SettingsPageHeader from '../components/SettingsPageHeader';
import { SettingsFilterBar, SettingsManagementList } from '../components/management';
import { useNavigate } from 'react-router-dom';
import {
  filterAgentsByAvailability,
  getAgentAvailabilityFilterStats,
  type AgentAvailabilityFilter,
} from './agentFilters';

const LOCAL_AGENT_SETUP_GUIDE_URL = 'https://github.com/liangboqiang/TjuaeUI/tree/main/docs/prds/conversations/acp';

type AgentScopeFilter = 'all' | 'builtin' | 'local' | 'remote' | 'disabled';

const getAgentScope = (agent: ManagedAgent): Exclude<AgentScopeFilter, 'all'> => {
  if (agent.enabled === false) return 'disabled';
  if (agent.agent_type === 'a2a') return 'remote';
  if (agent.agent_type === 'tjuaecli') return 'builtin';
  return 'local';
};

const LocalAgents: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [testingAgentId, setTestingAgentId] = useState<string | null>(null);
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [agentFilter, setAgentFilter] = useState<AgentAvailabilityFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<AgentScopeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { assistants } = useAssistantsForAgents();

  // Management view: includes user-disabled custom agents so they stay
  // listed (greyed) with a working re-enable toggle. `refreshCatalog`
  // also refreshes assistant list caches because generated-assistant availability
  // can change after health checks or custom-agent mutations.
  const { agents: allAgents, isRefreshing, refreshCatalog } = useManagedAgents();

  // Hide deprecated runtime backends (nanobot / openclaw-gateway / remote / gemini)
  // — they are no longer offered as agents and shouldn't appear on the detection page.
  const officialAgents = allAgents.filter(
    (a) => a.agent_source !== 'custom' && !isDeprecatedRuntimeAgentType(a.agent_type)
  );

  const customAgents: ManagedAgent[] = allAgents.filter((a) => a.agent_source === 'custom');

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState<ManagedAgent | null>(null);

  const handleSaveCustomAgent = useCallback(
    async (draft: CustomAgentDraft) => {
      const body = {
        name: draft.name,
        protocol: draft.protocol,
        command: draft.command,
        endpoint: draft.endpoint,
        auth_type: draft.auth_type,
        auth_token: draft.auth_token,
        allow_insecure: draft.allow_insecure,
        icon: draft.icon,
        args: draft.args,
        env: draft.env,
        advanced: draft.advanced,
      };
      try {
        if (editingAgent) {
          await ipcBridge.acpConversation.updateCustomAgent.invoke({ id: editingAgent.id, ...body });
        } else {
          await ipcBridge.acpConversation.createCustomAgent.invoke(body);
        }
        await refreshCatalog();
        setEditorVisible(false);
        setEditingAgent(null);
      } catch (err) {
        console.error('save custom agent failed:', err);
        Message.error(parseError(err));
      }
    },
    [editingAgent, refreshCatalog]
  );

  const handleDeleteCustomAgent = useCallback(
    async (agentId: string) => {
      try {
        await ipcBridge.acpConversation.deleteCustomAgent.invoke({ id: agentId });
        await refreshCatalog();
      } catch (err) {
        console.error('delete custom agent failed:', err);
        Message.error(parseError(err));
      }
    },
    [refreshCatalog]
  );

  const handleToggleCustomAgent = useCallback(
    async (agentId: string, enabled: boolean) => {
      try {
        await ipcBridge.acpConversation.setAgentEnabled.invoke({ id: agentId, enabled });
        await refreshCatalog();
      } catch (err) {
        console.error('toggle custom agent failed:', err);
        Message.error(parseError(err));
      }
    },
    [refreshCatalog]
  );

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const matchesAgentSearch = useCallback(
    (agent: ManagedAgent) => {
      if (!normalizedSearchQuery) return true;
      const searchableText = [
        agent.name,
        agent.name_i18n?.[i18n.language],
        agent.description,
        agent.description_i18n?.[i18n.language],
        agent.backend,
        agent.command,
        agent.agent_source_info?.binary_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchableText.includes(normalizedSearchQuery);
    },
    [i18n.language, normalizedSearchQuery]
  );

  const sortedOfficialAgents = useMemo(
    () =>
      officialAgents.toSorted((left, right) => {
        const leftIsTjuaeCli = left.agent_type === 'tjuaecli' || left.backend === 'tjuaecli';
        const rightIsTjuaeCli = right.agent_type === 'tjuaecli' || right.backend === 'tjuaecli';
        if (leftIsTjuaeCli !== rightIsTjuaeCli) {
          return leftIsTjuaeCli ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      }),
    [officialAgents]
  );
  const sortedCustomAgents = useMemo(
    () => customAgents.toSorted((left, right) => left.name.localeCompare(right.name)),
    [customAgents]
  );
  const supportedAgents = useMemo(
    () =>
      [...sortedOfficialAgents, ...sortedCustomAgents].filter(
        (agent) => agent.agent_type === 'tjuaecli' || agent.agent_source === 'custom' || agent.installed
      ),
    [sortedCustomAgents, sortedOfficialAgents]
  );
  const filterStats = getAgentAvailabilityFilterStats(supportedAgents);
  const scopeStats = useMemo(
    () => ({
      all: supportedAgents.length,
      builtin: supportedAgents.filter((agent) => getAgentScope(agent) === 'builtin').length,
      local: supportedAgents.filter((agent) => getAgentScope(agent) === 'local').length,
      remote: supportedAgents.filter((agent) => getAgentScope(agent) === 'remote').length,
      disabled: supportedAgents.filter((agent) => getAgentScope(agent) === 'disabled').length,
    }),
    [supportedAgents]
  );
  const visibleAgents = useMemo(
    () =>
      filterAgentsByAvailability(supportedAgents.filter(matchesAgentSearch), agentFilter).filter(
        (agent) => scopeFilter === 'all' || getAgentScope(agent) === scopeFilter
      ),
    [agentFilter, matchesAgentSearch, scopeFilter, supportedAgents]
  );

  const openCustomAgentEditor = useCallback(() => {
    setEditingAgent(null);
    setEditorVisible(true);
  }, []);

  const openAgentConfig = useCallback(
    (agentId: string) => {
      navigate(`/settings/agent/${agentId}/repair`);
    },
    [navigate]
  );

  // Manual "test connection": runs the live ACP probe (initialize +
  // session/new) and refreshes the catalog so the card reflects the new
  // status immediately (F2-02: three states stay clickable, in-progress
  // feedback, recover-on-success).
  const handleTestConnection = useCallback(
    async (agentId: string) => {
      try {
        setTestingAgentId(agentId);
        const result = await ipcBridge.acpConversation.checkManagedAgentHealthById.invoke({ id: agentId });
        await refreshCatalog();
        switch (result.status) {
          case 'online':
            Message.success(t('settings.agentManagement.testConnectionOnline', { name: result.name }));
            break;
          case 'missing':
            Message.warning(t('settings.agentManagement.testConnectionMissing', { name: result.name }));
            break;
          case 'offline':
            // auth_required is offline-with-a-reason: surface the diagnostic
            // (which carries the "needs sign-in" guidance) when present.
            Message.warning(
              formatManagedAgentDiagnosticMessage(t, result) ||
                (result.last_check_error_code === 'auth_required'
                  ? t('settings.agentManagement.testConnectionAuth', { name: result.name })
                  : t('settings.agentManagement.testConnectionOffline', { name: result.name }))
            );
            break;
          default:
            break;
        }
      } catch (error) {
        console.error('test managed agent failed:', error);
        Message.error(t('settings.agentManagement.testConnectionError'));
      } finally {
        setTestingAgentId(null);
      }
    },
    [refreshCatalog, t]
  );

  const handleTestAll = useCallback(async () => {
    try {
      setIsTestingAll(true);
      const agents = await ipcBridge.acpConversation.checkAllManagedAgentHealth.invoke();
      await refreshCatalog();
      const online = agents.filter((agent) => agent.status === 'online').length;
      const needsAuth = agents.filter(
        (agent) => agent.status === 'offline' && agent.last_check_error_code === 'auth_required'
      ).length;
      Message.success(
        t('settings.agentManagement.testAllComplete', {
          defaultValue: '扫描和模型预加载完成：{{online}} 个就绪，{{needsAuth}} 个需授权',
          online,
          needsAuth,
        })
      );
    } catch (error) {
      console.error('test all managed agents failed:', error);
      Message.error(t('settings.agentManagement.testConnectionError'));
    } finally {
      setIsTestingAll(false);
    }
  }, [refreshCatalog, t]);

  return (
    <div data-testid='agent-management-page' className='flex flex-col gap-16px'>
      <SettingsPageHeader
        data-testid='agent-management-header'
        title={t('settings.agents', { defaultValue: 'Agents' })}
        description={t('settings.agentManagement.pageDescription', {
          defaultValue: '管理可用于会话的内置、本机和远程智能体连接。',
        })}
        actions={
          <>
            <TjuaeSearchInput
              className='hidden w-[200px] shrink-0 md:flex'
              data-testid='input-search-agents'
              placeholder={t('settings.agentManagement.searchPlaceholder', { defaultValue: '搜索智能体' })}
              value={searchQuery}
              onChange={setSearchQuery}
            />
            <TalkToButlerButton
              className='shrink-0'
              label={t('settings.agentManagement.addCustomAgent', { defaultValue: '添加智能体' })}
              chatLabel={t('settings.talkToButler.addViaChat', { defaultValue: '通过对话添加' })}
              onManual={openCustomAgentEditor}
              manualLabel={t('settings.talkToButler.addManually', { defaultValue: '手动添加' })}
              prompt={t('settings.talkToButler.prompt.addCustomAgent', {
                defaultValue: '帮我添加一个自定义智能体，并先询问使用 ACP 还是 A2A 协议。',
              })}
              data-testid='btn-add-custom-agent'
            />
          </>
        }
        tabs={[
          {
            key: 'all',
            label: t('settings.agentManagement.scopeAll', { defaultValue: '全部' }),
            count: scopeStats.all,
          },
          {
            key: 'builtin',
            label: t('settings.agentManagement.scopeBuiltin', { defaultValue: '内置' }),
            count: scopeStats.builtin,
          },
          {
            key: 'local',
            label: t('settings.agentManagement.scopeLocal', { defaultValue: '本机' }),
            count: scopeStats.local,
          },
          {
            key: 'remote',
            label: t('settings.agentManagement.scopeRemote', { defaultValue: '远程' }),
            count: scopeStats.remote,
          },
          {
            key: 'disabled',
            label: t('settings.agentManagement.scopeDisabled', { defaultValue: '已停用' }),
            count: scopeStats.disabled,
          },
        ]}
        activeTab={scopeFilter}
        onTabChange={(key) => setScopeFilter(key as AgentScopeFilter)}
      />

      <SettingsFilterBar
        data-testid='agent-scan-panel'
        summary={
          isRefreshing
            ? t('settings.agentManagement.refreshingStatuses')
            : t('settings.agentManagement.scanSummary', {
                defaultValue: '已扫描 {{count}} 个连接：{{online}} 个就绪，{{needsAuth}} 个需授权',
                count: supportedAgents.length,
                online: filterStats.online,
                needsAuth: filterStats.needs_auth,
              })
        }
        mobileContent={
          <TjuaeSearchInput
            className='w-full'
            data-testid='input-search-agents-mobile'
            placeholder={t('settings.agentManagement.searchPlaceholder', { defaultValue: '搜索智能体' })}
            value={searchQuery}
            onChange={setSearchQuery}
          />
        }
      >
        <Button
          type='text'
          size='small'
          className='!text-t-secondary'
          onClick={() => void openExternalUrl(LOCAL_AGENT_SETUP_GUIDE_URL).catch(console.error)}
        >
          {t('settings.agentManagement.localAgentsSetupLink')}
        </Button>
        <Select
          size='small'
          value={agentFilter}
          onChange={(value) => setAgentFilter(value as AgentAvailabilityFilter)}
          aria-label={t('settings.agentManagement.statusFilter', { defaultValue: '状态筛选' })}
          className='w-150px'
        >
          <Select.Option value='all'>
            {t('settings.agentManagement.filterAll')} · {filterStats.all}
          </Select.Option>
          <Select.Option value='online'>{t('settings.agentManagement.statusOnline')}</Select.Option>
          <Select.Option value='needs_auth'>{t('settings.agentManagement.statusNeedsAuth')}</Select.Option>
          <Select.Option value='connection_failed'>
            {t('settings.agentManagement.statusConnectionFailed', { defaultValue: '连接失败' })}
          </Select.Option>
          <Select.Option value='protocol_error'>
            {t('settings.agentManagement.statusProtocolError', { defaultValue: '协议异常' })}
          </Select.Option>
          <Select.Option value='not_detected'>
            {t('settings.agentManagement.statusNotDetected', { defaultValue: '未检测' })}
          </Select.Option>
          <Select.Option value='disabled'>
            {t('settings.agentManagement.statusDisabled', { defaultValue: '已停用' })}
          </Select.Option>
        </Select>
        <Button
          type='primary'
          size='small'
          loading={isTestingAll}
          onClick={() => void handleTestAll()}
          className='!rounded-8px'
          data-testid='btn-test-all-agents'
        >
          {t('settings.agentManagement.testAll', { defaultValue: '一键测试' })}
        </Button>
      </SettingsFilterBar>

      <TjuaeModal
        visible={editorVisible}
        onCancel={() => {
          setEditorVisible(false);
          setEditingAgent(null);
        }}
        header={{
          title: editingAgent
            ? t('settings.agentManagement.editCustomAgent')
            : t('settings.agentManagement.detectCustomAgent'),
          showClose: true,
        }}
        footer={null}
        style={{ maxWidth: '92vw', borderRadius: 16 }}
        contentStyle={{
          background: 'var(--dialog-fill-0)',
          borderRadius: 16,
          padding: '20px 24px 16px',
          overflow: 'auto',
        }}
      >
        {/* Conditional mount + key unmounts the editor on close so the
            next `创建自定义 Agent` click always starts from a blank form.
            The inner useEffect([agent]) only resets when the `agent`
            reference changes; two consecutive `null` values would not
            retrigger it. */}
        {editorVisible && (
          <InlineAgentEditor
            key={editingAgent?.id ?? 'new'}
            agent={editingAgent}
            onSave={(agent) => void handleSaveCustomAgent(agent)}
            onCancel={() => {
              setEditorVisible(false);
              setEditingAgent(null);
            }}
          />
        )}
      </TjuaeModal>

      <SettingsManagementList
        data-testid='agent-management-list'
        loading={isRefreshing && supportedAgents.length === 0}
        empty={visibleAgents.length === 0}
        emptyText={
          normalizedSearchQuery || agentFilter !== 'all'
            ? t('settings.agentManagement.noSearchResults', { defaultValue: '没有匹配的智能体。' })
            : t('settings.agentManagement.groupEmpty', { defaultValue: '此分类暂无智能体。' })
        }
      >
        {visibleAgents.map((agent) => {
          const sharedProps = {
            agent,
            boundAssistants: getBoundAssistants(agent, assistants),
            onTestConnection: (): void => {
              void handleTestConnection(agent.id);
            },
            onConfigure: () => openAgentConfig(agent.id),
            isTesting: testingAgentId === agent.id,
          };
          return agent.agent_source === 'custom' ? (
            <AgentCard
              key={agent.id}
              type='custom'
              {...sharedProps}
              onEdit={() => {
                setEditingAgent(agent);
                setEditorVisible(true);
              }}
              onDelete={() => void handleDeleteCustomAgent(agent.id)}
              onToggle={(enabled) => void handleToggleCustomAgent(agent.id, enabled)}
            />
          ) : (
            <AgentCard key={agent.id} type='official' {...sharedProps} />
          );
        })}
      </SettingsManagementList>
    </div>
  );
};

export default LocalAgents;
