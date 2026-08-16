import { Tabs } from '@arco-design/web-react';
import { FolderOpen, SourceCode } from '@icon-park/react';
import type { TFunction } from 'i18next';
import React from 'react';
import type { WorkspaceTab } from '../types';

type Props = {
  t: TFunction;
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  changeCount: number;
};

const WorkspaceTabBar: React.FC<Props> = ({ t, activeTab, onTabChange, changeCount }) => (
  <Tabs
    activeTab={activeTab}
    onChange={(key) => onTabChange(key as WorkspaceTab)}
    type='line'
    size='small'
    className='shrink-0 border-b border-border-2 px-12px [&_.arco-tabs-header]:!h-38px [&_.arco-tabs-header-nav]:!h-38px [&_.arco-tabs-header-title]:!mr-18px [&_.arco-tabs-header-title]:!text-13px [&_.arco-tabs-nav]:!border-b-0'
  >
    <Tabs.TabPane
      key='files'
      title={
        <span className='flex items-center gap-5px'>
          <FolderOpen size={13} />
          {t('conversation.workspace.changes.filesTab')}
        </span>
      }
    />
    <Tabs.TabPane
      key='sourceControl'
      title={
        <span className='flex items-center gap-5px'>
          <SourceCode size={13} />
          {t('conversation.workspace.git.resourceManagement')}
          {changeCount > 0 ? (
            <span className='rounded-full bg-fill-3 px-4px text-9px'>{changeCount > 99 ? '99+' : changeCount}</span>
          ) : null}
        </span>
      }
    />
  </Tabs>
);

export default WorkspaceTabBar;
