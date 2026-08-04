/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageA2aPart } from '@/common/chat/chatLib';
import { downloadBase64Content, downloadTextContent } from '@/renderer/utils/file/download';
import { openExternalUrl } from '@/renderer/utils/platform';
import { Button, Collapse, Message, Modal, Tag } from '@arco-design/web-react';
import { Download, LinkOne } from '@icon-park/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const MAX_INLINE_DOWNLOAD_BYTES = 2 * 1024 * 1024;

export const safeA2aFilename = (value: string | undefined, fallback: string): string => {
  const leaf = (value || fallback).split(/[\\/]/).pop() || fallback;
  return leaf.replace(/[\p{Cc}<>:"|?*]/gu, '_').slice(0, 180) || fallback;
};

const formatBytes = (value: number | undefined): string | undefined => {
  if (value === undefined || !Number.isFinite(value) || value < 0) return undefined;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
};

export const getExternalA2aHttpUrl = (value: string): URL | undefined => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const MessageA2aPart: React.FC<{ message: IMessageA2aPart }> = ({ message }) => {
  const { t } = useTranslation();
  const part = message.content;
  const displayName =
    part.filename ||
    part.name ||
    t('messages.a2aPart.unnamed', {
      defaultValue: 'A2A content',
    });
  const size = formatBytes(part.byte_length);
  const structuredData = useMemo(
    () => (part.data === undefined ? undefined : JSON.stringify(part.data, null, 2)),
    [part.data]
  );

  const confirmOpen = () => {
    if (!part.url) return;
    const target = getExternalA2aHttpUrl(part.url);
    if (!target) {
      Message.error(
        t('messages.a2aPart.unsupportedUrl', {
          defaultValue: 'Only HTTP and HTTPS links can be opened.',
        })
      );
      return;
    }
    Modal.confirm({
      title: t('messages.a2aPart.openConfirmTitle', {
        defaultValue: 'Open external A2A resource?',
      }),
      content: (
        <div className='flex flex-col gap-8px'>
          <div>
            {t('messages.a2aPart.openConfirmContent', {
              defaultValue: 'This link was supplied by a remote Agent. Verify the destination before continuing.',
            })}
          </div>
          <code className='text-12px [word-break:break-all]'>{target.toString()}</code>
        </div>
      ),
      okText: t('messages.a2aPart.open', { defaultValue: 'Open' }),
      onOk: async () => {
        try {
          await openExternalUrl(target.toString());
        } catch {
          Message.error(t('messages.openLinkFailed'));
        }
      },
    });
  };

  const confirmDownload = () => {
    const hasInlineBytes =
      typeof part.bytes_base64 === 'string' &&
      part.bytes_base64.length > 0 &&
      (part.byte_length === undefined || part.byte_length <= MAX_INLINE_DOWNLOAD_BYTES);
    const hasStructuredData = structuredData !== undefined;
    if (!hasInlineBytes && !hasStructuredData) return;

    Modal.confirm({
      title: t('messages.a2aPart.downloadConfirmTitle', {
        defaultValue: 'Download content from this A2A Agent?',
      }),
      content: t('messages.a2aPart.downloadConfirmContent', {
        name: displayName,
        defaultValue: 'Save “{{name}}” locally only if you trust the remote Agent and expected this file.',
      }),
      okText: t('messages.a2aPart.download', { defaultValue: 'Download' }),
      onOk: () => {
        try {
          if (hasInlineBytes) {
            downloadBase64Content(
              part.bytes_base64!,
              safeA2aFilename(part.filename, 'a2a-content.bin'),
              part.media_type || 'application/octet-stream'
            );
          } else if (structuredData !== undefined) {
            downloadTextContent(
              structuredData,
              safeA2aFilename(part.filename, 'a2a-data.json'),
              part.media_type || 'application/json'
            );
          }
          Message.success(t('messages.downloadSuccess'));
        } catch {
          Message.error(t('messages.downloadFailed'));
        }
      },
    });
  };

  const inlineTooLarge =
    typeof part.bytes_base64 === 'string' &&
    part.byte_length !== undefined &&
    part.byte_length > MAX_INLINE_DOWNLOAD_BYTES;

  return (
    <div className='w-full max-w-720px rd-8px border border-solid border-3 bg-1 p-12px flex flex-col gap-8px'>
      <div className='flex flex-wrap items-center gap-6px'>
        <span className='font-500 text-t-primary [word-break:break-word]'>{displayName}</span>
        <Tag size='small'>A2A</Tag>
        {part.media_type && <Tag size='small'>{part.media_type}</Tag>}
        {size && <span className='text-12px text-t-tertiary'>{size}</span>}
      </div>
      {part.description && (
        <div className='text-13px text-t-secondary whitespace-break-spaces [word-break:break-word]'>
          {part.description}
        </div>
      )}
      {part.url && <code className='text-12px text-t-secondary [word-break:break-all]'>{part.url}</code>}
      {structuredData !== undefined && (
        <Collapse bordered={false}>
          <Collapse.Item
            name='a2a-data'
            header={t('messages.a2aPart.structuredData', {
              defaultValue: 'Structured data',
            })}
          >
            <pre className='m-0 max-h-320px overflow-auto whitespace-pre-wrap [word-break:break-word] text-12px'>
              {structuredData}
            </pre>
          </Collapse.Item>
        </Collapse>
      )}
      {inlineTooLarge && (
        <div className='text-12px text-color-warning'>
          {t('messages.a2aPart.inlineTooLarge', {
            defaultValue: 'The inline file exceeds the safe 2 MiB download limit.',
          })}
        </div>
      )}
      <div className='flex flex-wrap gap-8px'>
        {part.url && (
          <Button size='small' icon={<LinkOne />} onClick={confirmOpen}>
            {t('messages.a2aPart.open', { defaultValue: 'Open' })}
          </Button>
        )}
        {!inlineTooLarge && (part.bytes_base64 || structuredData !== undefined) && (
          <Button size='small' icon={<Download />} onClick={confirmDownload}>
            {t('messages.a2aPart.download', { defaultValue: 'Download' })}
          </Button>
        )}
      </div>
    </div>
  );
};

export default MessageA2aPart;
