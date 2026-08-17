import React from 'react';
import { Avatar, Button, Switch, Tag, Tooltip, Typography } from '@arco-design/web-react';
import { Delete, EditTwo, Robot } from '@icon-park/react';
import { useTranslation } from 'react-i18next';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import { resolveAgentAvatar, useAgentLogos } from '@/renderer/utils/model/agentLogo';
import {
  type AgentManagementStatus,
  type ManagedAgent,
  formatManagedAgentDiagnosticMessage,
} from '@/renderer/utils/model/agentTypes';
import { BoundAssistantStack } from './BoundAssistants';
import { buildAgentRuntimeModelInfo } from '@/renderer/utils/model/agentRuntimeCatalog';
import SettingsStatus, { type SettingsStatusTone } from '../components/management/SettingsStatus';

type AgentCardProps =
  | {
      type: 'official';
      agent: ManagedAgent;
      boundAssistants: Assistant[];
      onTestConnection: () => void;
      onConfigure: () => void;
      isTesting?: boolean;
    }
  | {
      type: 'custom';
      agent: ManagedAgent;
      boundAssistants: Assistant[];
      onTestConnection: () => void;
      onConfigure: () => void;
      isTesting?: boolean;
      onEdit: () => void;
      onDelete: () => void;
      onToggle: (enabled: boolean) => void;
    };

// Card-facing status, finer-grained than the backend's management status:
// the probe reaches `session/new`, so an offline agent that returned
// `auth_required` is "reachable but not signed in" — distinct from a truly
// unreachable agent. We surface that as its own `needs_auth` chip so users
// see "one step away (log in)" vs "broken" vs "not installed".
type DisplayStatus =
  | 'online'
  | 'needs_auth'
  | 'connection_failed'
  | 'protocol_error'
  | 'not_detected'
  | 'disabled'
  | 'unknown';

const stopRowNavigation = (event: React.MouseEvent) => event.stopPropagation();

const resolveDisplayStatus = (status?: AgentManagementStatus, errorCode?: string, enabled = true): DisplayStatus => {
  if (!enabled) return 'disabled';
  switch (status) {
    case 'online':
      return 'online';
    case 'offline':
      if (errorCode === 'auth_required') return 'needs_auth';
      if (errorCode === 'acp_init_failed' || errorCode === 'protocol_error' || errorCode === 'rpc_error') {
        return 'protocol_error';
      }
      return 'connection_failed';
    case 'missing':
      return 'not_detected';
    case 'unchecked':
      return 'not_detected';
    default:
      return 'unknown';
  }
};

const statusTone = (display: DisplayStatus): SettingsStatusTone => {
  switch (display) {
    case 'online':
      return 'success';
    case 'needs_auth':
      return 'warning';
    case 'connection_failed':
      return 'danger';
    case 'protocol_error':
      return 'danger';
    case 'not_detected':
    case 'disabled':
      return 'neutral';
    default:
      return 'neutral';
  }
};

const statusLabelKey = (display: DisplayStatus) => {
  switch (display) {
    case 'online':
      return 'settings.agentManagement.statusOnline';
    case 'needs_auth':
      return 'settings.agentManagement.statusNeedsAuth';
    case 'connection_failed':
      return 'settings.agentManagement.statusConnectionFailed';
    case 'protocol_error':
      return 'settings.agentManagement.statusProtocolError';
    case 'not_detected':
      return 'settings.agentManagement.statusNotDetected';
    case 'disabled':
      return 'settings.agentManagement.statusDisabled';
    default:
      return 'settings.agentManagement.statusUnknown';
  }
};

/**
 * Single agent row. Clicking anywhere on the row opens the configuration /
 * editor page; inner controls call `stopPropagation` so they don't trigger
 * the row navigation. Official and custom agents share the same row layout;
 * custom agents add an enable switch and a delete action.
 */
const AgentCard: React.FC<AgentCardProps> = (props) => {
  const { t } = useTranslation();
  const logos = useAgentLogos();
  const { agent, boundAssistants, onTestConnection, onConfigure, isTesting } = props;

  const isCustom = props.type === 'custom';
  const isDisabled = isCustom && agent.enabled === false;
  const diagnostics = formatManagedAgentDiagnosticMessage(t, agent);
  const displayStatus = resolveDisplayStatus(agent.status, agent.last_check_error_code, agent.enabled);
  const protocolLabel = agent.agent_type === 'tjuaecli' ? 'Core' : agent.agent_type.toUpperCase();
  const runtimeModelInfo = buildAgentRuntimeModelInfo(agent);
  const modelCount = runtimeModelInfo?.available_models.length ?? 0;
  const capabilityCount = [agent.team_capable, agent.behavior_policy?.supports_side_question].filter(Boolean).length;
  const lastChecked = agent.last_check_at ? new Date(agent.last_check_at).toLocaleString() : null;

  const avatar = resolveAgentAvatar(logos, {
    icon: agent.avatar || agent.icon,
    backend: agent.backend || agent.agent_type,
    custom_agent_id: agent.custom_agent_id,
    isExtension: agent.isExtension,
  });

  return (
    <div
      data-testid={`agent-row-${agent.id}`}
      className='group flex cursor-pointer items-center justify-between gap-12px rounded-12px border border-solid border-transparent bg-base px-14px py-10px transition-all duration-180 hover:border-border-1 hover:bg-fill-1'
      onClick={onConfigure}
    >
      <div className={`flex min-w-0 flex-1 items-center gap-12px ${isDisabled ? 'opacity-50' : ''}`}>
        <Avatar
          size={32}
          shape='square'
          style={{ flexShrink: 0, backgroundColor: avatar.kind === 'image' ? 'transparent' : 'var(--color-fill-2)' }}
        >
          {avatar.kind === 'image' ? (
            <img src={avatar.value} alt={agent.name} className='h-full w-full object-contain' />
          ) : avatar.kind === 'emoji' ? (
            <span className='text-18px leading-none'>{avatar.value}</span>
          ) : (
            <Robot theme='outline' size='18' />
          )}
        </Avatar>
        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 items-center gap-8px'>
            <Typography.Text className='truncate text-14px font-medium text-t-primary'>{agent.name}</Typography.Text>
            <SettingsStatus
              data-testid={`agent-row-status-${agent.id}`}
              tone={statusTone(displayStatus)}
              label={t(statusLabelKey(displayStatus))}
            />
            <Tag size='small' color='arcoblue' className='flex-shrink-0'>
              {protocolLabel}
            </Tag>
            {modelCount > 0 ? (
              <Tag size='small' color='purple' className='flex-shrink-0'>
                {t('settings.agentManagement.modelCount', {
                  count: modelCount,
                  defaultValue: '{{count}} 个模型',
                })}
              </Tag>
            ) : null}
            {diagnostics && (
              <Tooltip content={diagnostics}>
                <Typography.Text className='flex-shrink-0 text-11px text-t-secondary'>ⓘ</Typography.Text>
              </Tooltip>
            )}
          </div>
          <div className='mt-3px flex min-w-0 flex-wrap items-center gap-x-10px gap-y-2px text-11px text-t-tertiary'>
            <span>
              {modelCount > 0
                ? runtimeModelInfo?.current_model_label || runtimeModelInfo?.current_model_id
                : t('settings.agentManagement.modelsPending', { defaultValue: '模型待检测' })}
            </span>
            <span>
              {t('settings.agentManagement.capabilityCount', {
                count: capabilityCount,
                defaultValue: '{{count}} 项能力',
              })}
            </span>
            <span>
              {lastChecked
                ? t('settings.agentManagement.lastCheckedAt', {
                    time: lastChecked,
                    defaultValue: '最近测试：{{time}}',
                  })
                : t('settings.agentManagement.neverChecked', { defaultValue: '尚未测试' })}
            </span>
            {typeof agent.last_check_latency_ms === 'number' ? <span>{agent.last_check_latency_ms} ms</span> : null}
          </div>
        </div>
      </div>

      <div className='ml-12px flex flex-shrink-0 items-center gap-8px' onClick={stopRowNavigation}>
        <BoundAssistantStack assistants={boundAssistants} />
        <Button
          data-testid={`agent-row-test-${agent.id}`}
          size='small'
          type='outline'
          loading={isTesting}
          disabled={!agent.installed}
          onClick={onTestConnection}
          className='!h-30px !rounded-8px !border-border-2 !bg-base !px-10px !text-12px !font-500 !text-t-primary hover:!border-border-1 hover:!bg-fill-1'
        >
          {t('settings.agentManagement.testConnection')}
        </Button>
        {/* Both agent kinds get an explicit Edit button that opens the same
            configuration page the whole row links to (status, path/env
            overrides, bound assistants). */}
        <Button
          data-testid={`agent-row-edit-${agent.id}`}
          size='small'
          type='outline'
          onClick={onConfigure}
          className='!h-30px !rounded-8px !border-border-2 !bg-base !px-10px !text-12px !font-500 !text-t-primary hover:!border-border-1 hover:!bg-fill-1'
        >
          {t('common.edit', { defaultValue: 'Edit' })}
        </Button>
        {props.type === 'custom' ? (
          <>
            {/* Custom agents add the definition editor (command/args/env) plus
                enable/delete — controls that have no meaning for built-ins. */}
            <Switch size='small' checked={agent.enabled !== false} onChange={props.onToggle} />
            <Button
              size='small'
              type='outline'
              icon={<EditTwo theme='outline' size='14' />}
              onClick={props.onEdit}
              className='!h-30px !rounded-8px !border-border-2 !bg-base !text-t-primary hover:!border-border-1 hover:!bg-fill-1'
            />
            <Button
              size='small'
              type='outline'
              status='danger'
              icon={<Delete theme='outline' size='14' />}
              onClick={props.onDelete}
              className='!h-30px !rounded-8px !border-danger-2 !bg-base'
            />
          </>
        ) : null}
      </div>
    </div>
  );
};

export default AgentCard;
