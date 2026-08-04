/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import { TjuaeSearchInput } from '@/renderer/components/base';
import { useEngineDiagnostics } from '@/renderer/hooks/agent/useEngineDiagnostics';
import { useManagedEngines } from '@/renderer/hooks/agent/useManagedEngines';
import {
  formatManagedAgentDiagnosticMessage,
  type AgentManagementStatus,
  type ManagedEngine,
} from '@/renderer/utils/model/agentTypes';
import { Button, Empty, Message, Progress, Skeleton, Tag } from '@arco-design/web-react';
import { Attention, CheckOne, Left, Robot } from '@icon-park/react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import SettingsPageHeader from '../components/SettingsPageHeader';
import SettingsPageWrapper from '../components/SettingsPageWrapper';

type EngineCategory = 'builtin' | 'local' | 'remote';

const engineCategory = (engine: ManagedEngine): EngineCategory => {
  if (engine.agent_type === 'a2a') return 'remote';
  if (engine.agent_type === 'tjuaecli' || engine.agent_source === 'internal') return 'builtin';
  return 'local';
};

const engineProtocol = (engine: ManagedEngine): 'ACP' | 'A2A' | 'Tjuae CLI' => {
  if (engine.agent_type === 'a2a') return 'A2A';
  if (engine.agent_type === 'tjuaecli') return 'Tjuae CLI';
  return 'ACP';
};

const statusTranslationKey = (
  status: AgentManagementStatus
):
  | 'settings.engineManagement.statusOnline'
  | 'settings.engineManagement.statusOffline'
  | 'settings.engineManagement.statusMissing'
  | 'settings.engineManagement.statusUnchecked' => {
  switch (status) {
    case 'online':
      return 'settings.engineManagement.statusOnline';
    case 'offline':
      return 'settings.engineManagement.statusOffline';
    case 'missing':
      return 'settings.engineManagement.statusMissing';
    case 'unchecked':
      return 'settings.engineManagement.statusUnchecked';
  }
};

const statusColor = (status: AgentManagementStatus): 'green' | 'gold' | 'red' | 'gray' => {
  switch (status) {
    case 'online':
      return 'green';
    case 'offline':
      return 'gold';
    case 'missing':
      return 'red';
    case 'unchecked':
      return 'gray';
  }
};

const EngineDiagnosticsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { engines, isLoading, isRefreshing, error, revalidate } = useManagedEngines();
  const { run, isRunning, start } = useEngineDiagnostics();

  const visibleEngines = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return engines
      .filter((engine) => {
        if (!query) return true;
        return [
          engine.name,
          engine.name_i18n?.[i18n.language],
          engine.description,
          engine.description_i18n?.[i18n.language],
          engine.backend,
          engine.command,
          engine.agent_source_info?.binary_name,
          engineProtocol(engine),
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()
          .includes(query);
      })
      .toSorted((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name));
  }, [engines, i18n.language, searchQuery]);

  const diagnosticPercent = run && run.total > 0 ? Math.min(100, Math.round((run.completed / run.total) * 100)) : 0;

  const handleTestAll = useCallback(async () => {
    try {
      await start('manual');
    } catch (diagnosticError) {
      console.error('start engine diagnostics failed:', diagnosticError);
      Message.error(t('settings.engineManagement.testConnectionError'));
    }
  }, [start, t]);

  return (
    <SettingsPageWrapper>
      <div className='flex min-h-0 flex-col gap-18px' data-testid='engine-diagnostics-page'>
        <SettingsPageHeader
          title={t('settings.engineManagement.diagnostics')}
          description={t('settings.engineManagement.diagnosticsDescription')}
          actions={
            <>
              <Button
                type='text'
                icon={<Left aria-hidden='true' />}
                onClick={() => navigate('/settings/engine')}
                aria-label={t('common.goBack')}
              >
                {t('common.goBack')}
              </Button>
              <Button
                type='outline'
                loading={isRunning}
                disabled={isLoading || Boolean(error)}
                onClick={() => void handleTestAll()}
                data-testid='engine-diagnostics-test-all'
              >
                {isRunning && run
                  ? t('settings.engineManagement.testAllProgress', {
                      completed: run.completed,
                      total: run.total,
                    })
                  : t('settings.engineManagement.testAll')}
              </Button>
              <TjuaeSearchInput
                className='w-full sm:w-[220px]'
                data-testid='engine-diagnostics-search'
                inputProps={{ 'aria-label': t('settings.engineManagement.searchPlaceholder') }}
                placeholder={t('settings.engineManagement.searchPlaceholder')}
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </>
          }
        />

        {isRunning && run ? (
          <div className='border-y border-border-2 py-11px' role='status'>
            <div className='mb-7px flex items-center justify-between text-12px'>
              <span className='font-600 text-t-primary'>
                {t('settings.engineManagement.testAllProgress', {
                  completed: run.completed,
                  total: run.total,
                })}
              </span>
              <span className='tabular-nums text-t-secondary'>{diagnosticPercent}%</span>
            </div>
            <Progress percent={diagnosticPercent} showText={false} strokeWidth={4} />
          </div>
        ) : run?.state === 'completed' ? (
          <div className='flex items-center gap-8px border-y border-border-2 py-10px text-12px' role='status'>
            <CheckOne aria-hidden='true' theme='filled' size='16' className='text-success-6' />
            <span className='font-600 text-t-primary'>{t('settings.engineManagement.testAllCompletedTitle')}</span>
            <span className='text-t-secondary'>
              {t('settings.engineManagement.testAllSummary', {
                online: run.online,
                attention: run.needs_attention,
                missing: run.missing,
              })}
            </span>
          </div>
        ) : null}

        {isRefreshing && !isRunning ? (
          <div className='text-12px text-t-secondary' role='status'>
            {t('settings.engineManagement.refreshingStatuses')}
          </div>
        ) : null}

        {isLoading && engines.length === 0 ? (
          <div className='border-y border-border-2 py-16px'>
            <Skeleton animation text={{ rows: 7 }} />
          </div>
        ) : error && engines.length === 0 ? (
          <div className='flex flex-col items-center border-y border-danger-2 px-20px py-28px'>
            <Attention aria-hidden='true' size='28' className='text-danger-6' />
            <p className='mb-0 mt-10px text-14px font-600 text-t-primary'>{t('settings.engineManagement.loadError')}</p>
            <Button type='outline' size='small' className='mt-14px' onClick={() => void revalidate()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : visibleEngines.length === 0 ? (
          <div className='border-y border-dashed border-border-2 px-16px py-24px'>
            <Empty description={t('settings.engineManagement.noResults')} />
          </div>
        ) : (
          <div
            role='list'
            aria-label={t('settings.engineManagement.diagnostics')}
            className='divide-y divide-border-2 border-y border-border-2'
          >
            {visibleEngines.map((engine) => {
              const displayName = engine.name_i18n?.[i18n.language] || engine.name;
              const diagnosticMessage = engine.last_check_error_code
                ? formatManagedAgentDiagnosticMessage(t, engine)
                : engine.status === 'online'
                  ? t('settings.engineManagement.engineReadyDescription', { name: displayName })
                  : t(statusTranslationKey(engine.status));

              return (
                <div
                  key={engine.id}
                  role='listitem'
                  data-testid={`engine-diagnostics-row-${engine.id}`}
                  className='flex items-start gap-12px px-2px py-14px'
                >
                  <div className='flex size-36px shrink-0 items-center justify-center rounded-9px bg-fill-2'>
                    <Robot aria-hidden='true' theme='outline' size='18' className='text-t-secondary' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-7px'>
                      <span className='truncate text-14px font-600 text-t-primary'>{displayName}</span>
                      <Tag size='small' color='arcoblue'>
                        {engineProtocol(engine)}
                      </Tag>
                      <Tag size='small'>{t(`settings.engineManagement.categories.${engineCategory(engine)}`)}</Tag>
                      <Tag
                        size='small'
                        color={statusColor(engine.status)}
                        data-testid={`engine-diagnostics-status-${engine.id}`}
                      >
                        {t(statusTranslationKey(engine.status))}
                      </Tag>
                    </div>
                    <p className='mb-0 mt-4px text-12px leading-18px text-t-secondary'>{diagnosticMessage}</p>
                    <div className='mt-5px flex flex-wrap items-center gap-x-12px gap-y-3px text-11px text-t-tertiary'>
                      {engine.command ? (
                        <code className='max-w-full truncate font-mono' title={engine.command}>
                          {engine.command}
                        </code>
                      ) : null}
                      {engine.last_check_latency_ms !== undefined ? (
                        <span>
                          {t('settings.engineManagement.latency', {
                            latency: engine.last_check_latency_ms,
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SettingsPageWrapper>
  );
};

export default EngineDiagnosticsPage;
