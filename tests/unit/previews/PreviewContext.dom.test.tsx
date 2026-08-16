import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import { PreviewProvider, usePreviewContext } from '@/renderer/pages/conversation/Preview/context/PreviewContext';
import { createFileResourceKey } from '@/renderer/utils/file/resourceKey';

vi.mock('@/common', () => ({
  ipcBridge: {
    fileStream: {
      contentUpdate: { on: vi.fn(() => vi.fn()) },
    },
    preview: {
      open: { on: vi.fn(() => vi.fn()) },
    },
    fs: {
      writeFile: { invoke: vi.fn() },
      getFileMetadata: { invoke: vi.fn(async () => null) },
      readFile: { invoke: vi.fn() },
      getImageBase64: { invoke: vi.fn() },
    },
  },
}));

vi.mock('@/renderer/utils/emitter', () => ({
  emitter: {
    on: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' },
  }),
}));

const previewWrapper = ({ children }: { children: ReactNode }) => <PreviewProvider>{children}</PreviewProvider>;

describe('PreviewContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('initializes with closed state', () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper: previewWrapper });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTabId).toBe(null);
  });

  it('opens preview and creates tab', () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper: previewWrapper });
    act(() => {
      result.current.openPreview('# Hello', 'markdown', { title: 'test.md' });
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].content).toBe('# Hello');
    expect(result.current.tabs[0].content_type).toBe('markdown');
  });

  it('activates and updates an existing tab when the same resource is opened again', () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper: previewWrapper });
    act(() => {
      result.current.openPreview('# First', 'markdown', {
        title: 'SKILL.md',
        resource_key: 'file:c:/workspace/skill.md',
      });
      result.current.openPreview('# Other', 'markdown', {
        title: 'OTHER.md',
        resource_key: 'file:c:/workspace/other.md',
      });
      result.current.openPreview('# Updated', 'markdown', {
        title: 'SKILL.md',
        resource_key: 'file:c:/workspace/skill.md',
      });
    });

    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.activeTab?.resource_key).toBe('file:c:/workspace/skill.md');
    expect(result.current.activeTab?.content).toBe('# Updated');
  });

  it('does not duplicate a file opened through regular and Windows verbatim paths', () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper: previewWrapper });
    const workspace = 'C:\\Users\\Administrator\\AppData\\Roaming\\TjuaeUI';
    const regularPath = `${workspace}\\skills\\cron\\SKILL.md`;
    const verbatimPath = `\\\\?\\${regularPath}`;

    act(() => {
      result.current.openPreview('# Skill', 'markdown', {
        title: 'SKILL.md',
        file_path: regularPath,
        workspace,
        resource_key: createFileResourceKey(workspace, regularPath),
      });
      result.current.openPreview('# Skill refreshed', 'markdown', {
        title: 'SKILL.md',
        file_path: verbatimPath,
        workspace,
        resource_key: createFileResourceKey(`\\\\?\\${workspace}`, verbatimPath),
      });
    });

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTab?.content).toBe('# Skill refreshed');
  });

  it('closes preview and clears all tabs', () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper: previewWrapper });
    act(() => {
      result.current.openPreview('content', 'code');
    });
    act(() => {
      result.current.closePreview();
    });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.tabs).toEqual([]);
  });

  it('provides all context API methods', () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper: previewWrapper });
    expect(typeof result.current.openPreview).toBe('function');
    expect(typeof result.current.closePreview).toBe('function');
    expect(typeof result.current.updateContent).toBe('function');
    expect(typeof result.current.findPreviewTab).toBe('function');
  });

  it('updates content and marks tab as dirty', () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper: previewWrapper });
    act(() => {
      result.current.openPreview('original', 'code');
    });
    expect(result.current.activeTab?.isDirty).toBe(false);
    act(() => {
      result.current.updateContent('modified');
    });
    expect(result.current.activeTab?.content).toBe('modified');
    expect(result.current.activeTab?.isDirty).toBe(true);
  });
});
