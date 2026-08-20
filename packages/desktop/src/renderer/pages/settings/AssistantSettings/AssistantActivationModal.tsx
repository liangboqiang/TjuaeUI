import type {
  AssistantActivationAction,
  AssistantActivationChoice,
  AssistantActivationGroup,
  AssistantActivationPlan,
  AssistantRequirementKind,
} from '@/common/types/platform/assistantCatalog';
import { Alert, Button, Modal, Select, Spin, Steps, Tag } from '@arco-design/web-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './AssistantActivationModal.module.css';

type ChoiceDraft = { action?: AssistantActivationAction; resourceId?: string };

const kinds: AssistantRequirementKind[] = ['skill', 'mcp', 'model', 'agent'];

const needsResource = (action?: AssistantActivationAction): boolean => action === 'select' || action === 'configure';

const unresolvedItems = (group: AssistantActivationGroup) => group.items.filter((item) => item.status !== 'ready');

const AssistantActivationModal: React.FC<{
  plan?: AssistantActivationPlan;
  error?: string;
  visible: boolean;
  submitting: boolean;
  retrying?: boolean;
  onCancel: () => void;
  onRetry: () => void;
  onCommit: (confirmedGroups: AssistantRequirementKind[], choices: AssistantActivationChoice[]) => void;
  onOpenSettings: (kind: AssistantRequirementKind) => void;
}> = ({ plan, error, visible, submitting, retrying = false, onCancel, onRetry, onCommit, onOpenSettings }) => {
  const { t } = useTranslation();
  const [choices, setChoices] = useState<Record<string, ChoiceDraft>>({});
  const [confirmed, setConfirmed] = useState<AssistantRequirementKind[]>([]);
  const [step, setStep] = useState(0);

  const actionableGroups = useMemo(
    () =>
      kinds
        .map((kind) => plan?.groups.find((group) => group.kind === kind))
        .filter((group): group is AssistantActivationGroup => Boolean(group?.requiresConfirmation)),
    [plan]
  );

  useEffect(() => {
    const defaults: Record<string, ChoiceDraft> = {};
    plan?.groups.forEach((group) => {
      unresolvedItems(group).forEach((item) => {
        const action = item.allowedActions.length === 1 ? item.allowedActions[0] : undefined;
        const candidate = item.candidates.filter((entry) => entry.available);
        defaults[item.requirementKey] = {
          action,
          resourceId: action && needsResource(action) && candidate.length === 1 ? candidate[0].id : undefined,
        };
      });
    });
    setChoices(defaults);
    setConfirmed([]);
    setStep(0);
  }, [plan?.planId]);

  const currentGroup = actionableGroups[step];
  const reviewing = Boolean(plan) && step >= actionableGroups.length;
  const groupValid = Boolean(
    currentGroup &&
    unresolvedItems(currentGroup).every((item) => {
      const choice = choices[item.requirementKey];
      return (
        choice?.action &&
        item.allowedActions.includes(choice.action) &&
        (!needsResource(choice.action) || Boolean(choice.resourceId))
      );
    })
  );
  const readyToCommit = Boolean(plan) && reviewing && confirmed.length === actionableGroups.length;

  const confirmCurrentGroup = () => {
    if (!currentGroup || !groupValid) return;
    setConfirmed((current) => [...current.filter((kind) => kind !== currentGroup.kind), currentGroup.kind]);
    setStep((current) => current + 1);
  };

  const commit = () => {
    if (!plan || !readyToCommit) return;
    const decisions = plan.groups.flatMap((group) =>
      unresolvedItems(group).map((item) => ({
        requirementKey: item.requirementKey,
        action: choices[item.requirementKey].action!,
        resourceId: choices[item.requirementKey].resourceId,
      }))
    );
    onCommit(confirmed, decisions);
  };

  const footer = error ? (
    <>
      <span className={styles.footerHint}>{t('settings.assistantCatalog.activation.noChangesOnFailure')}</span>
      <Button disabled={retrying} onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button type='primary' loading={retrying} onClick={onRetry}>
        {t('settings.assistantCatalog.activation.retry')}
      </Button>
    </>
  ) : reviewing ? (
    <>
      <span className={styles.footerHint}>{t('settings.assistantCatalog.activation.footerHint')}</span>
      <Button disabled={submitting} onClick={() => setStep(Math.max(0, actionableGroups.length - 1))}>
        {t('settings.assistantCatalog.activation.previous')}
      </Button>
      <Button
        data-testid='assistant-activation-commit'
        type='primary'
        disabled={!readyToCommit}
        loading={submitting}
        onClick={commit}
      >
        {t('settings.assistantCatalog.activation.confirmEnable')}
      </Button>
    </>
  ) : currentGroup ? (
    <>
      <span className={styles.footerHint}>{t('settings.assistantCatalog.activation.typeConfirmationHint')}</span>
      {step > 0 ? (
        <Button disabled={submitting} onClick={() => setStep((current) => current - 1)}>
          {t('settings.assistantCatalog.activation.previous')}
        </Button>
      ) : (
        <Button disabled={submitting} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      )}
      <Button
        data-testid={`assistant-activation-confirm-${currentGroup.kind}`}
        type='primary'
        disabled={!groupValid}
        onClick={confirmCurrentGroup}
      >
        {t('settings.assistantCatalog.activation.confirmTypeAndContinue', {
          type: t(`settings.assistantCatalog.activation.groups.${currentGroup.kind}`),
        })}
      </Button>
    </>
  ) : (
    <Button onClick={onCancel}>{t('common.cancel')}</Button>
  );

  return (
    <Modal
      visible={visible}
      title={t('settings.assistantCatalog.activation.title')}
      style={{ width: 820 }}
      maskClosable={false}
      escToExit={!submitting && !retrying}
      unmountOnExit
      footer={footer}
      onCancel={onCancel}
    >
      {error ? (
        <div className={styles.errorState} data-testid='assistant-activation-error'>
          <Alert
            type='error'
            showIcon
            title={t('settings.assistantCatalog.activation.checkFailedTitle')}
            content={t('settings.assistantCatalog.activation.checkFailedDescription')}
          />
          <pre>{error}</pre>
        </div>
      ) : !plan ? (
        <div className={styles.loadingState}>
          <Spin />
          <span>{t('settings.assistantCatalog.activation.checking')}</span>
        </div>
      ) : (
        <>
          <p className={styles.summary}>{t('settings.assistantCatalog.activation.summary')}</p>
          {actionableGroups.length > 0 ? (
            <Steps className={styles.steps} size='small' current={Math.min(step, actionableGroups.length)}>
              {actionableGroups.map((group) => (
                <Steps.Step key={group.kind} title={t(`settings.assistantCatalog.activation.groups.${group.kind}`)} />
              ))}
              <Steps.Step title={t('settings.assistantCatalog.activation.review')} />
            </Steps>
          ) : null}
          {currentGroup ? (
            <section className={styles.group} key={currentGroup.kind}>
              <header className={styles.groupHeader}>
                <strong>{t(`settings.assistantCatalog.activation.groups.${currentGroup.kind}`)}</strong>
                <span>{t('settings.assistantCatalog.activation.confirmSeparately')}</span>
              </header>
              {currentGroup.items.map((item) => {
                const draft = choices[item.requirementKey] ?? {};
                const resourceRequired = needsResource(draft.action);
                return (
                  <div className={styles.resourceItem} key={item.requirementKey}>
                    <div className={styles.identity}>
                      <strong>
                        {item.label}{' '}
                        <Tag size='small' color={item.required ? 'red' : 'gray'}>
                          {t(
                            item.required
                              ? 'settings.assistantCatalog.activation.required'
                              : 'settings.assistantCatalog.activation.optional'
                          )}
                        </Tag>
                      </strong>
                      <small>{item.message || t(`settings.assistantCatalog.activation.statuses.${item.status}`)}</small>
                    </div>
                    {item.status === 'ready' ? (
                      <span className={styles.ready}>{t('settings.assistantCatalog.activation.ready')}</span>
                    ) : (
                      <Select
                        data-testid={`assistant-activation-action-${item.requirementKey}`}
                        placeholder={t('settings.assistantCatalog.activation.chooseAction')}
                        value={draft.action}
                        options={item.allowedActions.map((action) => ({
                          value: action,
                          label: t(`settings.assistantCatalog.activation.actions.${action}`),
                        }))}
                        onChange={(action) =>
                          setChoices((current) => ({
                            ...current,
                            [item.requirementKey]: { action, resourceId: undefined },
                          }))
                        }
                      />
                    )}
                    {item.status === 'ready' ? (
                      <span />
                    ) : resourceRequired && item.candidates.length > 0 ? (
                      <Select
                        data-testid={`assistant-activation-resource-${item.requirementKey}`}
                        showSearch
                        placeholder={t('settings.assistantCatalog.activation.chooseResource')}
                        value={draft.resourceId}
                        options={item.candidates
                          .filter((candidate) => candidate.available)
                          .map((candidate) => ({
                            value: candidate.id,
                            label: candidate.label,
                            disabled: !candidate.enabled && draft.action === 'select',
                          }))}
                        onChange={(resourceId) =>
                          setChoices((current) => ({
                            ...current,
                            [item.requirementKey]: { ...current[item.requirementKey], resourceId },
                          }))
                        }
                      />
                    ) : resourceRequired ? (
                      <Button type='text' onClick={() => onOpenSettings(currentGroup.kind)}>
                        {t(`settings.assistantCatalog.activation.openSettings.${currentGroup.kind}`)}
                      </Button>
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
            </section>
          ) : reviewing ? (
            <div className={styles.review} data-testid='assistant-activation-review'>
              {actionableGroups.map((group) => (
                <section key={group.kind}>
                  <strong>{t(`settings.assistantCatalog.activation.groups.${group.kind}`)}</strong>
                  <span>
                    {t('settings.assistantCatalog.activation.confirmedItemCount', {
                      count: unresolvedItems(group).length,
                    })}
                  </span>
                </section>
              ))}
              <p>{t('settings.assistantCatalog.activation.atomicCommitHint')}</p>
            </div>
          ) : null}
        </>
      )}
    </Modal>
  );
};

export default AssistantActivationModal;
