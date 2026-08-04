import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { confirm, error } = vi.hoisted(() => ({
  confirm: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@arco-design/web-react', async (importOriginal) => {
  const original = await importOriginal<typeof import('@arco-design/web-react')>();
  return {
    ...original,
    Modal: { ...original.Modal, confirm },
    Message: { ...original.Message, error, success: vi.fn() },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue || _key,
  }),
}));

import MessageA2aPart, {
  getExternalA2aHttpUrl,
  safeA2aFilename,
} from '../../packages/desktop/src/renderer/pages/conversation/Messages/components/MessageA2aPart';

const baseMessage = {
  id: 'message-1',
  type: 'a2a_part' as const,
  conversation_id: 'conversation-1',
  position: 'left' as const,
  content: {
    kind: 'resource' as const,
  },
};

describe('A2A non-text part security', () => {
  beforeEach(() => {
    confirm.mockReset();
    error.mockReset();
  });

  it('only accepts HTTP(S) external resources', () => {
    expect(getExternalA2aHttpUrl('https://agent.example/file')).toBeInstanceOf(URL);
    expect(getExternalA2aHttpUrl('http://agent.example/file')).toBeInstanceOf(URL);
    expect(getExternalA2aHttpUrl('file:///C:/secret.txt')).toBeUndefined();
    expect(getExternalA2aHttpUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('strips paths and reserved characters from suggested filenames', () => {
    expect(safeA2aFilename('../../unsafe:name?.txt', 'fallback.bin')).toBe('unsafe_name_.txt');
  });

  it('requires confirmation before opening a remote URL', () => {
    render(
      <MessageA2aPart
        message={{
          ...baseMessage,
          content: {
            kind: 'resource',
            url: 'https://agent.example/report.pdf',
            filename: 'report.pdf',
          },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0][0]).toMatchObject({
      title: 'Open external A2A resource?',
    });
  });

  it('blocks non-web schemes without showing a confirmation', () => {
    render(
      <MessageA2aPart
        message={{
          ...baseMessage,
          content: {
            kind: 'resource',
            url: 'file:///C:/Windows/win.ini',
          },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(error).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });
});
