
import React from 'react';
import { useTranslation } from 'react-i18next';

export type OfficeFileType = 'ppt' | 'word' | 'excel';

const TITLE_KEYS = {
  ppt: 'preview.pptTitle',
  word: 'preview.word.title',
  excel: 'preview.excel.title',
} as const;

interface OfficeFileViewerProps {
  fileType: OfficeFileType;
  file_path?: string;
}

/**
 * Safe fallback for Office documents.
 *
 * TjuaeUI deliberately does not launch or install a separate document
 * rendering service. The preview toolbar remains available for opening the
 * original file in its system application or downloading a copy.
 */
const OfficeFileViewer: React.FC<OfficeFileViewerProps> = ({ fileType, file_path }) => {
  const { t } = useTranslation();

  return (
    <div className='h-full w-full flex items-center justify-center bg-bg-1 px-24px' role='status'>
      <div className='max-w-480px text-center'>
        <div className='text-16px font-medium text-t-primary mb-8px'>{t(TITLE_KEYS[fileType])}</div>
        <div className='text-14px text-t-secondary mb-6px'>{t('preview.office.previewUnavailable')}</div>
        <div className='text-12px leading-18px text-t-tertiary'>
          {file_path ? t('preview.office.openOrDownloadHint') : t('preview.errors.missingFilePath')}
        </div>
      </div>
    </div>
  );
};

export default OfficeFileViewer;
