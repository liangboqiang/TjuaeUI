/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const translations: Record<string, string> = {
  'preview.pptTitle': 'PowerPoint Presentation',
  'preview.word.title': 'Word Document',
  'preview.excel.title': 'Excel Spreadsheet',
  'preview.office.previewUnavailable': 'In-app preview is unavailable for this file type.',
  'preview.office.openOrDownloadHint': 'Use the toolbar to open the original file in a system app or download a copy.',
  'preview.errors.missingFilePath': 'File path is missing',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

import OfficeFileViewer from '@/renderer/pages/conversation/Preview/components/viewers/OfficeFileViewer';

describe('OfficeFileViewer', () => {
  it.each([
    ['word', 'Word Document'],
    ['excel', 'Excel Spreadsheet'],
    ['ppt', 'PowerPoint Presentation'],
  ] as const)('renders the safe %s fallback without launching a preview service', (fileType, title) => {
    render(<OfficeFileViewer fileType={fileType} file_path={`/workspace/sample.${fileType}`} />);

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText('In-app preview is unavailable for this file type.')).toBeInTheDocument();
    expect(
      screen.getByText('Use the toolbar to open the original file in a system app or download a copy.')
    ).toBeInTheDocument();
  });

  it('shows the localized missing-path message when no original file is available', () => {
    render(<OfficeFileViewer fileType='word' />);

    expect(screen.getByText('File path is missing')).toBeInTheDocument();
    expect(
      screen.queryByText('Use the toolbar to open the original file in a system app or download a copy.')
    ).not.toBeInTheDocument();
  });
});
