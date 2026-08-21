import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/common', () => ({
  ipcBridge: {
    dialog: { showOpen: { invoke: vi.fn() } },
    fs: { getImageBase64: { invoke: vi.fn() } },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import CatalogDetailHero from '@/renderer/pages/settings/components/CatalogDetailHero';

describe('CatalogDetailHero', () => {
  afterEach(cleanup);

  it('shows publishing after a saved edit and keeps it out of the unsaved edit state', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onPublish = vi.fn();
    render(
      <CatalogDetailHero
        identityKey='mine:writer'
        glyph={<span>W</span>}
        name='Writer'
        description='Write'
        categories={[]}
        categoryOptions={[]}
        sourceLabel='我的助手'
        versionLabel='版本'
        version='1.0.0'
        versionOptions={[{ label: '1.0.0', value: '1.0.0' }]}
        editable
        saving={false}
        noDescription='暂无说明'
        publishLabel='发布新版本'
        onVersionChange={vi.fn()}
        onSave={onSave}
        onPublish={onPublish}
      />
    );

    expect(screen.getByRole('button', { name: '发布新版本' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }));
    expect(screen.queryByRole('button', { name: '发布新版本' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: '发布新版本' }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('searches existing categories and creates a new category in the same control', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <CatalogDetailHero
        identityKey='mine:writer'
        glyph={<span>W</span>}
        name='Writer'
        description='Write'
        categories={['写作']}
        categoryOptions={['写作', '效率']}
        sourceLabel='我的助手'
        versionLabel='版本'
        version='1.0.0'
        versionOptions={[{ label: '1.0.0', value: '1.0.0' }]}
        editable
        saving={false}
        noDescription='暂无说明'
        onVersionChange={vi.fn()}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }));
    const categoryLabel = screen.getByText('settings.catalogCategories').closest('label');
    expect(categoryLabel).not.toBeNull();
    const select = categoryLabel!.querySelector('.arco-select-view');
    const input = categoryLabel!.querySelector('input');
    expect(select).not.toBeNull();
    expect(input).not.toBeNull();

    fireEvent.click(select!);
    expect(await screen.findByText('效率')).toBeInTheDocument();
    await user.type(input!, '新分类');
    const createdOption = (await screen.findAllByText('新分类'))
      .map((element) => element.closest('.arco-select-option'))
      .find(Boolean);
    expect(createdOption).not.toBeNull();
    fireEvent.click(createdOption!);
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].categories).toEqual(['写作', '新分类']);
  });
});
