import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const testMcpConnectionInvoke = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      let value = typeof params?.defaultValue === 'string' ? params.defaultValue : key;
      Object.entries(params ?? {}).forEach(([name, replacement]) => {
        value = value.replaceAll(`{{${name}}}`, String(replacement));
      });
      return value;
    },
  }),
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  mcpService: {
    testMcpConnection: {
      invoke: (...args: unknown[]) => testMcpConnectionInvoke(...args),
    },
  },
}));

vi.mock('@/renderer/components/base/TjuaeModal', () => ({
  default: ({
    visible,
    children,
    header,
    footer,
  }: {
    visible: boolean;
    children: React.ReactNode;
    header?: { title?: React.ReactNode };
    footer?: { render?: () => React.ReactNode };
  }) =>
    visible ? (
      <div>
        <div>{header?.title}</div>
        {children}
        {footer?.render?.()}
      </div>
    ) : null,
}));

vi.mock('@icon-park/react', () => ({
  Delete: () => <span>delete-icon</span>,
  Plus: () => <span>plus-icon</span>,
}));

vi.mock('@arco-design/web-react', () => {
  const Button = ({
    children,
    onClick,
    disabled,
    'data-testid': dataTestId,
    'aria-pressed': ariaPressed,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'data-testid'?: string;
    'aria-pressed'?: boolean;
  }) => (
    <button type='button' disabled={disabled} data-testid={dataTestId} aria-pressed={ariaPressed} onClick={onClick}>
      {children}
    </button>
  );
  const Input = React.forwardRef<
    { blur: () => void; dom: HTMLInputElement | null; focus: () => void },
    {
      id?: string;
      value?: string;
      onChange?: (value: string) => void;
      onPressEnter?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
      placeholder?: string;
      disabled?: boolean;
      'data-testid'?: string;
    }
  >(({ id, value, onChange, onPressEnter, placeholder, disabled, 'data-testid': dataTestId }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => ({
      blur: () => inputRef.current?.blur(),
      dom: inputRef.current,
      focus: () => inputRef.current?.focus(),
    }));
    return (
      <input
        ref={inputRef}
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={dataTestId}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onPressEnter?.(event);
        }}
      />
    );
  });
  Input.displayName = 'MockInput';
  Input.TextArea = Input;
  const InputTag = ({
    id,
    value,
    onChange,
    placeholder,
    'data-testid': dataTestId,
  }: {
    id?: string;
    value?: string[];
    onChange?: (value: string[]) => void;
    placeholder?: string;
    'data-testid'?: string;
  }) => (
    <input
      id={id}
      value={(value ?? []).join(',')}
      placeholder={placeholder}
      data-testid={dataTestId}
      onChange={(event) => onChange?.(event.target.value.split(',').filter(Boolean))}
    />
  );

  const Select = ({
    children,
    id,
    value,
    onChange,
    'data-testid': dataTestId,
  }: {
    children: React.ReactNode;
    id?: string;
    value?: string;
    onChange?: (value: string) => void;
    'data-testid'?: string;
  }) => (
    <select id={id} data-testid={dataTestId} value={value} onChange={(event) => onChange?.(event.target.value)}>
      {children}
    </select>
  );
  Select.Option = ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  );

  const CollapseContext = React.createContext<{
    activeKeys: string[];
    toggle: (name: string) => void;
  }>({ activeKeys: [], toggle: () => undefined });
  const Collapse = ({
    children,
    activeKey,
    onChange,
  }: {
    children: React.ReactNode;
    activeKey?: string | string[];
    onChange?: (key: string, keys: string[]) => void;
  }) => {
    const activeKeys = Array.isArray(activeKey) ? activeKey : activeKey ? [activeKey] : [];
    const toggle = (name: string) => {
      const nextKeys = activeKeys.includes(name) ? activeKeys.filter((key) => key !== name) : [...activeKeys, name];
      onChange?.(name, nextKeys);
    };
    return <CollapseContext.Provider value={{ activeKeys, toggle }}>{children}</CollapseContext.Provider>;
  };
  Collapse.Item = ({
    children,
    className,
    header,
    name,
  }: {
    children: React.ReactNode;
    className?: string;
    header: React.ReactNode;
    name: string;
  }) => {
    const { activeKeys, toggle } = React.useContext(CollapseContext);
    return (
      <section className={className}>
        <button type='button' onClick={() => toggle(name)}>
          {header}
        </button>
        {activeKeys.includes(name) ? children : null}
      </section>
    );
  };

  const RadioContext = React.createContext<{
    value?: string;
    onChange?: (value: string) => void;
  }>({});
  const Radio = ({
    value,
    children,
    'data-testid': dataTestId,
  }: {
    value: string;
    children: React.ReactNode;
    'data-testid'?: string;
  }) => {
    const group = React.useContext(RadioContext);
    return (
      <label>
        <input
          type='radio'
          checked={group.value === value}
          data-testid={dataTestId}
          onChange={() => group.onChange?.(value)}
        />
        {children}
      </label>
    );
  };
  Radio.Group = ({
    value,
    onChange,
    children,
    'data-testid': dataTestId,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    children: React.ReactNode;
    'data-testid'?: string;
  }) => (
    <RadioContext.Provider value={{ value, onChange }}>
      <div data-testid={dataTestId}>{children}</div>
    </RadioContext.Provider>
  );

  return {
    Alert: ({ content, 'data-testid': dataTestId }: { content: React.ReactNode; 'data-testid'?: string }) => (
      <div data-testid={dataTestId}>{content}</div>
    ),
    Button,
    Collapse,
    Input,
    InputTag,
    Radio,
    Select,
    Switch: ({ checked, onChange }: { checked?: boolean; onChange?: (checked: boolean) => void }) => (
      <input type='checkbox' checked={checked} onChange={(event) => onChange?.(event.target.checked)} />
    ),
    Tag: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    Typography: {
      Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    },
  };
});

import ManualMcpServerModal from '@/renderer/pages/settings/components/ManualMcpServerModal';

describe('ManualMcpServerModal', () => {
  beforeEach(() => {
    testMcpConnectionInvoke.mockReset();
    testMcpConnectionInvoke.mockResolvedValue({ success: true, tools: [{ name: 'echo' }, { name: 'read' }] });
  });

  it('builds and tests a structured STDIO configuration before adding it', async () => {
    const onSubmit = vi.fn();
    render(<ManualMcpServerModal visible existingServerNames={[]} onCancel={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getByTestId('mcp-transport-stdio')).toBeChecked();
    expect(screen.getByText('本机进程：通过命令启动 MCP 服务器。')).toBeInTheDocument();
    expect(screen.queryByText('配置摘要')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('mcp-manual-name'), { target: { value: 'everything' } });
    fireEvent.change(screen.getByTestId('mcp-manual-command'), { target: { value: 'npx' } });
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));

    await waitFor(() => expect(testMcpConnectionInvoke).toHaveBeenCalledTimes(1));
    expect(testMcpConnectionInvoke.mock.calls[0][0]).toMatchObject({
      name: 'everything',
      transport: { type: 'stdio', command: 'npx' },
      runtime_scope_id: expect.stringMatching(/^draft-mcp-/),
    });
    expect(screen.getByText('连接、协议协商与工具发现通过，共 2 个工具。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '添加服务器' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'everything',
      transport: { type: 'stdio', command: 'npx' },
    });
  });

  it('changes remote authentication and rejects plaintext sensitive headers', async () => {
    const onSubmit = vi.fn();
    render(<ManualMcpServerModal visible existingServerNames={[]} onCancel={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByTestId('mcp-transport-streamable_http'));
    expect(screen.getByTestId('mcp-transport-streamable_http')).toBeChecked();
    expect(screen.getByText('远程服务：使用推荐的 Streamable HTTP 协议。')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'OAuth 2.1 + PKCE' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '客户端凭据（扩展）' })).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('mcp-auth-select'), { target: { value: 'bearer' } });
    expect(screen.getByTestId('mcp-secret-reference')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('mcp-manual-name'), { target: { value: 'remote-tools' } });
    fireEvent.change(screen.getByTestId('mcp-manual-url'), { target: { value: 'https://example.com/mcp' } });
    fireEvent.change(screen.getByLabelText('认证方式*'), { target: { value: 'custom_headers' } });
    fireEvent.click(screen.getByRole('button', { name: '添加一项' }));
    fireEvent.change(screen.getByPlaceholderText('键'), { target: { value: 'Authorization' } });
    fireEvent.change(screen.getByPlaceholderText('值'), { target: { value: 'Bearer plaintext' } });
    fireEvent.click(screen.getByRole('button', { name: '添加服务器' }));

    expect(await screen.findByText('敏感请求头必须使用 ${env:变量名} 引用，不能保存明文密钥。')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears stale test feedback after connection fields change', async () => {
    render(<ManualMcpServerModal visible existingServerNames={[]} onCancel={vi.fn()} onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByTestId('mcp-manual-name'), { target: { value: 'everything' } });
    fireEvent.change(screen.getByTestId('mcp-manual-command'), { target: { value: 'npx' } });
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));

    expect(await screen.findByTestId('mcp-draft-test-result')).toHaveTextContent(
      '连接、协议协商与工具发现通过，共 2 个工具。'
    );
    fireEvent.change(screen.getByTestId('mcp-manual-command'), { target: { value: 'uvx' } });
    expect(screen.queryByTestId('mcp-draft-test-result')).not.toBeInTheDocument();
  });

  it('keeps the modal open and reports save failures', async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue(new Error('disk unavailable'));
    render(<ManualMcpServerModal visible existingServerNames={[]} onCancel={onCancel} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('mcp-manual-name'), { target: { value: 'everything' } });
    fireEvent.change(screen.getByTestId('mcp-manual-command'), { target: { value: 'npx' } });
    fireEvent.click(screen.getByRole('button', { name: '添加服务器' }));

    expect(await screen.findByText('保存 MCP 配置失败：disk unavailable')).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('separates advanced editing from JSON preview and supports keyboard-first pair entry', () => {
    render(<ManualMcpServerModal visible existingServerNames={[]} onCancel={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByText('高级配置')).toBeInTheDocument();
    expect(screen.queryByText('高级设置与生成配置')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '环境变量' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'JSON 预览' })).toBeInTheDocument();
    expect(screen.queryByTestId('mcp-json-preview-empty')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '环境变量' }));
    fireEvent.click(screen.getByTestId('mcp-add-pair'));
    const firstKey = screen.getByPlaceholderText('键');
    const firstValue = screen.getByPlaceholderText('值');
    expect(firstKey).toHaveFocus();

    fireEvent.keyDown(firstKey, { key: 'Enter' });
    expect(firstValue).toHaveFocus();
    fireEvent.keyDown(firstValue, { key: 'Enter' });
    expect(screen.getAllByPlaceholderText('键')).toHaveLength(2);
    expect(screen.getAllByPlaceholderText('键')[1]).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'JSON 预览' }));
    expect(screen.getByTestId('mcp-json-preview-empty')).toHaveTextContent('请输入服务器名称。');
    fireEvent.change(screen.getByTestId('mcp-manual-name'), { target: { value: 'everything' } });
    expect(screen.getByTestId('mcp-json-preview')).toHaveTextContent('"everything"');
  });

  it('keeps newly expanded advanced content inside the modal viewport', () => {
    vi.useFakeTimers();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    try {
      render(<ManualMcpServerModal visible existingServerNames={[]} onCancel={vi.fn()} onSubmit={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: '环境变量' }));
      act(() => vi.advanceTimersByTime(220));

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });

      scrollIntoView.mockClear();
      fireEvent.click(screen.getByTestId('mcp-transport-streamable_http'));
      fireEvent.change(screen.getByTestId('mcp-auth-select'), { target: { value: 'custom_headers' } });
      act(() => vi.advanceTimersByTime(220));

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
    } finally {
      vi.useRealTimers();
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: originalScrollIntoView,
        });
      } else {
        delete (HTMLElement.prototype as { scrollIntoView?: Element['scrollIntoView'] }).scrollIntoView;
      }
    }
  });
});
