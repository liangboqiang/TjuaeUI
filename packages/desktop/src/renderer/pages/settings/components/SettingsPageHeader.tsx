/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SettingsPageHeader — the shared header paradigm for settings pages.
 *
 * Layout (top to bottom):
 *   1. Title row: page title + description on the left, action slot on the right.
 *   2. Tabs (optional): underline tabs with an optional count badge.
 *
 * Pages own everything below the header (their list/content). This keeps the
 * title sizing, description, action placement, tab styling and responsive
 * breakpoints identical across Agents / Skills / Tools.
 */

import classNames from 'classnames';
import React, { useCallback } from 'react';

export type SettingsPageTab = {
  key: string;
  label: string;
  /** Optional count badge shown after the label. */
  count?: number;
};

type SettingsPageHeaderProps = {
  title: React.ReactNode;
  /** Secondary description under the title; may contain inline links. */
  description?: React.ReactNode;
  /** Right-aligned action slot (search, create button, dropdowns, …). */
  actions?: React.ReactNode;
  /** Action aligned with the tab row, such as a page-wide refresh or test. */
  tabActions?: React.ReactNode;
  tabs?: SettingsPageTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  /** Disable sticky behavior when the caller renders a fixed header outside its scroll body. */
  sticky?: boolean;
  /** Extra testid for the whole header block. */
  'data-testid'?: string;
};

const SettingsPageHeader: React.FC<SettingsPageHeaderProps> = ({
  title,
  description,
  actions,
  tabActions,
  tabs,
  activeTab,
  onTabChange,
  sticky = true,
  'data-testid': dataTestId,
}) => {
  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (!tabs?.length) return;

      let nextIndex: number | null = null;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex === null) return;

      event.preventDefault();
      onTabChange?.(tabs[nextIndex].key);
      const tabButtons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      tabButtons?.[nextIndex]?.focus();
    },
    [onTabChange, tabs]
  );

  return (
    <div
      data-testid={dataTestId}
      className={classNames('bg-1', sticky && 'sticky top-0 z-10 -mt-14px pt-14px md:-mt-32px md:pt-32px')}
    >
      <div className='flex flex-col items-stretch gap-12px sm:flex-row sm:items-center sm:justify-between sm:gap-16px'>
        <h1 className='m-0 min-w-0 text-22px font-bold leading-[1.2] text-t-primary sm:flex-1 md:text-24px'>{title}</h1>
        {actions ? (
          <div className='flex w-full flex-wrap items-center gap-8px sm:w-auto sm:shrink-0 sm:justify-end'>
            {actions}
          </div>
        ) : null}
      </div>
      {description ? <p className='m-0 mt-8px text-13px leading-relaxed text-t-secondary'>{description}</p> : null}

      {tabs && tabs.length > 0 ? (
        <div className='mt-18px flex flex-col gap-10px sm:flex-row sm:items-end sm:gap-14px sm:border-b sm:border-border-2'>
          <div
            className='scrollbar-hide -mx-2px flex min-w-0 flex-1 gap-18px overflow-x-auto border-b border-border-2 px-2px sm:mx-0 sm:gap-26px sm:border-b-0 sm:px-0'
            role='tablist'
            aria-label={typeof title === 'string' ? title : undefined}
          >
            {tabs.map((tab, index) => {
              const isActive = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  type='button'
                  role='tab'
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  data-testid={`settings-tab-${tab.key}`}
                  onClick={() => onTabChange?.(tab.key)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={classNames(
                    'relative inline-flex shrink-0 cursor-pointer items-center border-none bg-transparent px-2px pb-12px text-14px leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-6',
                    isActive ? 'font-600 text-t-primary' : 'font-500 text-t-secondary hover:text-t-primary'
                  )}
                >
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' ? (
                    <span
                      className={classNames(
                        'ml-6px inline-flex h-16px min-w-16px items-center justify-center rounded-999px px-5px text-10px font-500 leading-none',
                        isActive ? 'bg-primary-1 text-primary-6' : 'bg-fill-2 text-t-tertiary'
                      )}
                    >
                      {tab.count}
                    </span>
                  ) : null}
                  {isActive ? <span className='absolute inset-x-0 -bottom-1px h-2px rounded-2px bg-primary-6' /> : null}
                </button>
              );
            })}
          </div>
          {tabActions ? (
            <div data-testid='settings-tabs-actions' className='flex w-full shrink-0 justify-end sm:w-auto sm:pb-7px'>
              {tabActions}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default SettingsPageHeader;
