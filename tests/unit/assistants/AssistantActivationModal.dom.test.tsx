import type { AssistantActivationPlan } from '@/common/types/platform/assistantCatalog';
import AssistantActivationModal from '@/renderer/pages/settings/AssistantSettings/AssistantActivationModal';
import { fireEvent, render, screen } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@arco-design/web-react', () => ({
  Alert: ({ title, content }: { title?: ReactNode; content?: ReactNode }) => (
    <div>
      {title}
      {content}
    </div>
  ),
  Button: ({
    children,
    disabled,
    onClick,
    ...props
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Checkbox: ({
    children,
    checked,
    onChange,
    ...props
  }: {
    children?: ReactNode;
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    [key: string]: unknown;
  }) => (
    <label>
      <input type='checkbox' checked={checked} onChange={(event) => onChange?.(event.target.checked)} {...props} />
      {children}
    </label>
  ),
  Modal: ({
    children,
    footer,
    title,
    visible,
  }: {
    children?: ReactNode;
    footer?: ReactNode;
    title?: ReactNode;
    visible?: boolean;
  }) =>
    visible ? (
      <div>
        <h1>{title}</h1>
        {children}
        {footer}
      </div>
    ) : null,
  Select: ({
    value,
    options = [],
    onChange,
    ...props
  }: {
    value?: string;
    options?: Array<{ value: string; label: ReactNode; disabled?: boolean }>;
    onChange?: (value: string) => void;
    [key: string]: unknown;
  }) => (
    <select value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} {...props}>
      <option value='' />
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Spin: () => <span>loading</span>,
  Steps: Object.assign(({ children }: { children?: ReactNode }) => <div>{children}</div>, {
    Step: ({ title }: { title?: ReactNode }) => <span>{title}</span>,
  }),
  Tag: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const plan: AssistantActivationPlan = {
  planId: 'plan-1',
  fingerprint: 'fingerprint-1',
  identity: { source: 'tjuae-hub', namespace: '', slug: 'writer' },
  version: '1.0.0',
  readyWithoutChanges: false,
  groups: [
    {
      kind: 'skill',
      requiresConfirmation: true,
      items: [
        {
          requirementKey: 'skill.writer',
          label: 'Writer skill',
          required: true,
          status: 'missing',
          message: 'missing',
          allowedActions: ['import'],
          candidates: [],
        },
      ],
    },
    {
      kind: 'mcp',
      requiresConfirmation: true,
      items: [
        {
          requirementKey: 'mcp.files',
          label: 'File MCP',
          required: true,
          status: 'ambiguous',
          message: 'ambiguous',
          allowedActions: ['select'],
          candidates: [
            { id: 'mcp-a', label: 'MCP A', enabled: true, available: true },
            { id: 'mcp-b', label: 'MCP B', enabled: true, available: true },
          ],
        },
      ],
    },
    {
      kind: 'model',
      requiresConfirmation: true,
      items: [
        {
          requirementKey: 'model.default',
          label: 'Default model',
          required: false,
          status: 'disabled',
          message: 'disabled',
          allowedActions: ['enable', 'use_default'],
          candidates: [],
        },
      ],
    },
    {
      kind: 'agent',
      requiresConfirmation: true,
      items: [
        {
          requirementKey: 'agent.runtime',
          label: 'Runtime agent',
          required: true,
          status: 'configuration_required',
          message: 'configuration required',
          allowedActions: ['configure'],
          candidates: [
            { id: 'agent-a', label: 'Agent A', enabled: true, available: true },
            { id: 'agent-b', label: 'Agent B', enabled: true, available: true },
          ],
        },
      ],
    },
  ],
};

const select = (testId: string, value: string) => {
  fireEvent.change(screen.getByTestId(testId), { target: { value } });
};

describe('AssistantActivationModal', () => {
  it('requires separate confirmation and a complete choice for every resource type', () => {
    const onCommit = vi.fn();
    render(
      <AssistantActivationModal
        plan={plan}
        visible
        submitting={false}
        onCancel={vi.fn()}
        onCommit={onCommit}
        onOpenSettings={vi.fn()}
      />
    );

    expect(screen.queryByTestId('assistant-activation-commit')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('assistant-activation-confirm-skill'));
    select('assistant-activation-action-mcp.files', 'select');
    select('assistant-activation-resource-mcp.files', 'mcp-b');
    fireEvent.click(screen.getByTestId('assistant-activation-confirm-mcp'));
    select('assistant-activation-action-model.default', 'use_default');
    fireEvent.click(screen.getByTestId('assistant-activation-confirm-model'));

    select('assistant-activation-resource-agent.runtime', 'agent-a');
    fireEvent.click(screen.getByTestId('assistant-activation-confirm-agent'));
    const commit = screen.getByTestId('assistant-activation-commit');
    expect(commit).toBeEnabled();

    fireEvent.click(commit);
    expect(onCommit).toHaveBeenCalledWith(
      ['skill', 'mcp', 'model', 'agent'],
      [
        { requirementKey: 'skill.writer', action: 'import', resourceId: undefined },
        { requirementKey: 'mcp.files', action: 'select', resourceId: 'mcp-b' },
        { requirementKey: 'model.default', action: 'use_default', resourceId: undefined },
        { requirementKey: 'agent.runtime', action: 'configure', resourceId: 'agent-a' },
      ]
    );
  });

  it('does not request confirmation or choices for an already ready group', () => {
    const onCommit = vi.fn();
    const readyPlan: AssistantActivationPlan = {
      ...plan,
      planId: 'plan-ready',
      readyWithoutChanges: true,
      groups: [
        {
          kind: 'skill',
          requiresConfirmation: false,
          items: [
            {
              requirementKey: 'skill.ready',
              label: 'Ready skill',
              required: true,
              status: 'ready',
              message: 'ready',
              allowedActions: ['keep'],
              candidates: [],
            },
          ],
        },
      ],
    };

    render(
      <AssistantActivationModal
        plan={readyPlan}
        visible
        submitting={false}
        onCancel={vi.fn()}
        onCommit={onCommit}
        onOpenSettings={vi.fn()}
      />
    );

    const commit = screen.getByTestId('assistant-activation-commit');
    expect(commit).toBeEnabled();
    fireEvent.click(commit);
    expect(onCommit).toHaveBeenCalledWith([], []);
  });
});
