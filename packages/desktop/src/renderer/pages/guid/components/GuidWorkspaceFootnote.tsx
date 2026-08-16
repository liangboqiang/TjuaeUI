import { ipcBridge } from '@/common';
import { addRecentWorkspace, getRecentWorkspaces } from '@/renderer/components/workspace';
import { TjuaeInlineSearchInput } from '@/renderer/components/base';
import { showGitError } from '@/renderer/pages/conversation/Workspace/utils/gitError';
import type { GitRepositoryInfo } from '@/common/types/platform/gitWorkspace';
import { Button, Input, Modal, Select, Tooltip } from '@arco-design/web-react';
import { Branch, Close, Down, DownloadOne, Plus } from '@icon-park/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from '../index.module.css';

type GuidWorkspaceFootnoteProps = {
  workspaceDir: string;
  onSelectWorkspace: (dir: string) => void;
  onClearWorkspace: () => void;
};

const FolderIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    fill='none'
    stroke='currentColor'
    strokeWidth='1.8'
    viewBox='0 0 24 24'
    style={{ lineHeight: 0, flexShrink: 0 }}
  >
    <path d='M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z' />
  </svg>
);

const PlusIcon = () => (
  <svg
    width='13'
    height='13'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.8'
    viewBox='0 0 24 24'
    style={{ flexShrink: 0 }}
  >
    <path d='M12 5v14M5 12h14' />
  </svg>
);

const GuidWorkspaceFootnote: React.FC<GuidWorkspaceFootnoteProps> = ({
  workspaceDir,
  onSelectWorkspace,
  onClearWorkspace,
}) => {
  const { t } = useTranslation();
  const recentWorkspaces = getRecentWorkspaces();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [repository, setRepository] = useState<GitRepositoryInfo | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [cloneModalVisible, setCloneModalVisible] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const handleBrowseWorkspace = useCallback(() => {
    setOpen(false);
    ipcBridge.dialog.showOpen
      .invoke({ properties: ['openDirectory', 'createDirectory'] })
      .then((dirs) => {
        if (dirs && dirs[0]) {
          addRecentWorkspace(dirs[0]);
          onSelectWorkspace(dirs[0]);
        }
      })
      .catch((error) => {
        console.error('Failed to open directory dialog:', error);
      });
  }, [onSelectWorkspace]);

  const handleSelectPath = useCallback(
    (path: string) => {
      addRecentWorkspace(path);
      onSelectWorkspace(path);
      setOpen(false);
      setSearchQuery('');
    },
    [onSelectWorkspace]
  );

  const openDropdown = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // position above the trigger, aligned to left edge
    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      bottom: window.innerHeight - rect.top + 6,
      minWidth: 230,
      zIndex: 9999,
    });
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSearchQuery('');
  }, []);

  const toggleOpen = useCallback(() => {
    if (open) closeDropdown();
    else openDropdown();
  }, [open, openDropdown, closeDropdown]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, closeDropdown]);

  const filteredRecent = recentWorkspaces.filter((p) => {
    if (!searchQuery) return true;
    const name = p.split(/[\\/]/).pop() || p;
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) || p.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const workspaceName = workspaceDir ? workspaceDir.split(/[\\/]/).pop() || workspaceDir : '';

  const refreshRepository = useCallback(async () => {
    if (!workspaceDir) {
      setRepository(null);
      return;
    }
    setGitLoading(true);
    try {
      setRepository(await ipcBridge.git.ensure.invoke({ workspace: workspaceDir }));
    } catch (error) {
      console.error('[GuidWorkspaceFootnote] Failed to prepare Git workspace:', error);
      showGitError(t, error);
    } finally {
      setGitLoading(false);
    }
  }, [t, workspaceDir]);

  useEffect(() => {
    void refreshRepository();
  }, [refreshRepository]);

  const switchBranch = useCallback(
    async (name: string) => {
      if (!workspaceDir || name === repository?.branch) return;
      setGitLoading(true);
      try {
        await ipcBridge.git.switchBranch.invoke({ workspace: workspaceDir, name });
        await refreshRepository();
      } catch (error) {
        console.error('[GuidWorkspaceFootnote] Failed to switch branch:', error);
        showGitError(t, error);
      } finally {
        setGitLoading(false);
      }
    },
    [refreshRepository, repository?.branch, t, workspaceDir]
  );

  const createBranch = useCallback(async () => {
    const name = newBranchName.trim();
    if (!workspaceDir || !name) return;
    setGitLoading(true);
    try {
      await ipcBridge.git.createBranch.invoke({ workspace: workspaceDir, name });
      await refreshRepository();
      setBranchModalVisible(false);
      setNewBranchName('');
    } catch (error) {
      console.error('[GuidWorkspaceFootnote] Failed to create branch:', error);
      showGitError(t, error);
    } finally {
      setGitLoading(false);
    }
  }, [newBranchName, refreshRepository, t, workspaceDir]);

  const handleCloneRepository = useCallback(async () => {
    const repositoryUrl = cloneUrl.trim();
    if (!repositoryUrl) return;

    setCloneLoading(true);
    try {
      const directories = await ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory', 'createDirectory'] });
      const parentDirectory = directories?.[0];
      if (!parentDirectory) return;

      const clonedRepository = await ipcBridge.git.clone.invoke({
        repository_url: repositoryUrl,
        parent_directory: parentDirectory,
      });
      addRecentWorkspace(clonedRepository.workspacePath);
      onSelectWorkspace(clonedRepository.workspacePath);
      setCloneModalVisible(false);
      setCloneUrl('');
    } catch (error) {
      console.error('[GuidWorkspaceFootnote] Failed to clone Git repository:', error);
      showGitError(t, error);
    } finally {
      setCloneLoading(false);
    }
  }, [cloneUrl, onSelectWorkspace, t]);

  const dropdownEl = open
    ? createPortal(
        <div ref={dropdownRef} className={styles.wsDropdown} style={dropdownStyle}>
          <div className='mb-8px'>
            <TjuaeInlineSearchInput
              className='w-full'
              ref={searchRef}
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('guid.workspace.searchPlaceholder')}
            />
          </div>

          {filteredRecent.map((path) => {
            const name = path.split(/[\\/]/).pop() || path;
            const isActive = path === workspaceDir;
            return (
              <div
                key={path}
                className={`${styles.wsDropdownItem} ${isActive ? styles.wsDropdownItemActive : ''}`}
                onClick={() => handleSelectPath(path)}
              >
                <FolderIcon size={13} />
                <span className={styles.wsDropdownItemName}>{name}</span>
                {isActive && (
                  <svg
                    width='12'
                    height='12'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2.5'
                    viewBox='0 0 24 24'
                    style={{ marginLeft: 'auto', flexShrink: 0 }}
                  >
                    <path d='M20 6L9 17l-5-5' />
                  </svg>
                )}
              </div>
            );
          })}

          {filteredRecent.length > 0 && <div className={styles.wsDropdownSep} />}

          <div className={`${styles.wsDropdownItem} ${styles.wsDropdownItemAccent}`} onClick={handleBrowseWorkspace}>
            <PlusIcon />
            <span>{t('team.create.chooseDifferentFolder')}</span>
          </div>
          <div
            className={`${styles.wsDropdownItem} ${styles.wsDropdownItemAccent}`}
            onClick={() => {
              closeDropdown();
              setCloneModalVisible(true);
            }}
          >
            <DownloadOne size={13} />
            <span>{t('guid.workspace.cloneRepository')}</span>
          </div>

          <>
            <div className={styles.wsDropdownSep} />
            <div
              className={`${styles.wsDropdownItem} ${workspaceDir ? styles.wsDropdownItemMuted : styles.wsDropdownItemMutedDisabled}`}
              onClick={() => {
                if (workspaceDir) onClearWorkspace();
                closeDropdown();
              }}
            >
              <svg
                width='13'
                height='13'
                fill='none'
                stroke='currentColor'
                strokeWidth='1.8'
                viewBox='0 0 24 24'
                style={{ flexShrink: 0 }}
              >
                <path d='M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z' />
                <line x1='2' y1='2' x2='22' y2='22' strokeWidth='1.5' />
              </svg>
              <span>{t('guid.workspace.noProject')}</span>
            </div>
          </>
        </div>,
        document.body
      )
    : null;

  return (
    <div className={styles.workspaceFootnote}>
      {workspaceDir ? (
        <>
          <Tooltip content={workspaceDir} position='top'>
            <div className={styles.workspacePill}>
              <button
                ref={triggerRef as React.RefObject<HTMLButtonElement>}
                className={styles.workspacePillMain}
                onClick={toggleOpen}
              >
                <FolderIcon size={14} />
                <span className={styles.workspacePillName}>{workspaceName}</span>
                <Down
                  theme='outline'
                  size='12'
                  fill='currentColor'
                  style={{ flexShrink: 0, transform: 'translateY(1px)' }}
                />
              </button>
              <span
                role='button'
                aria-label={t('guid.workspace.clearWorkspace')}
                className={styles.workspacePillClose}
                onClick={(e) => {
                  e.stopPropagation();
                  onClearWorkspace();
                }}
              >
                <Close theme='outline' size='10' fill='currentColor' />
              </span>
            </div>
          </Tooltip>
          <Select
            size='mini'
            showSearch
            loading={gitLoading}
            value={repository?.branch}
            className='!ml-6px !w-118px'
            prefix={<Branch size={12} />}
            options={(repository?.branches ?? []).map((branch) => ({
              label: branch.name,
              value: branch.name,
              disabled: branch.checkedOut && !branch.current,
            }))}
            onChange={(value) => void switchBranch(String(value))}
          />
          <Tooltip mini content={t('conversation.workspace.git.createBranch')}>
            <Button
              type='text'
              size='mini'
              className='!ml-2px !h-24px !w-24px !p-0'
              icon={<Plus size={12} />}
              disabled={!repository || gitLoading}
              onClick={() => setBranchModalVisible(true)}
            />
          </Tooltip>
          {dropdownEl}
        </>
      ) : (
        <>
          <button
            ref={triggerRef as React.RefObject<HTMLButtonElement>}
            className={styles.workspaceEmptyBtn}
            data-testid='workspace-selector-btn'
            onClick={toggleOpen}
          >
            <FolderIcon size={14} />
            <span>{t('guid.workspace.workInProject')}</span>
            <Down
              theme='outline'
              size='12'
              fill='currentColor'
              style={{ flexShrink: 0, transform: 'translateY(1px)' }}
            />
          </button>
          {dropdownEl}
        </>
      )}
      <Modal
        title={t('conversation.workspace.git.createBranch')}
        visible={branchModalVisible}
        okButtonProps={{ disabled: !newBranchName.trim(), loading: gitLoading }}
        onCancel={() => setBranchModalVisible(false)}
        onOk={createBranch}
      >
        <Input
          value={newBranchName}
          placeholder={t('conversation.workspace.git.branchName')}
          onChange={setNewBranchName}
          onPressEnter={() => void createBranch()}
        />
      </Modal>
      <Modal
        title={t('guid.workspace.cloneRepository')}
        visible={cloneModalVisible}
        okText={t('guid.workspace.chooseCloneFolder')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !cloneUrl.trim(), loading: cloneLoading }}
        onCancel={() => {
          if (cloneLoading) return;
          setCloneModalVisible(false);
          setCloneUrl('');
        }}
        onOk={() => void handleCloneRepository()}
      >
        <div className='mb-8px text-13px text-t-secondary'>{t('guid.workspace.cloneRepositoryDescription')}</div>
        <Input
          value={cloneUrl}
          placeholder={t('guid.workspace.repositoryUrlPlaceholder')}
          onChange={setCloneUrl}
          onPressEnter={() => void handleCloneRepository()}
        />
      </Modal>
    </div>
  );
};

export default GuidWorkspaceFootnote;
