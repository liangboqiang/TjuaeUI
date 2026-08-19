import type { Assistant } from '@/common/types/agent/assistantTypes';
import type { IMcpServer } from '@/common/config/storage';
import type { SkillCatalogItem } from '@/common/types/platform/skill';

export type SkillInfo = SkillCatalogItem;

export type AssistantListItem = Assistant;

export type BuiltinAvatarOption = {
  id: string;
  label: string;
  src: string;
};

export type AvailableBackendModelOption = {
  value: string;
  label: string;
  description?: string;
};

export type AvailableBackend = {
  id: string;
  name: string;
  runtimeKey: string;
  isExtension?: boolean;
  /** Agent icon/avatar (raw value from the backend catalog), for the dropdown. */
  icon?: string;
  /** Custom agent id (e.g. `ext:name:adapter`), used to resolve extension logos. */
  customAgentId?: string;
  modelOptions: AvailableBackendModelOption[];
};

export type AssistantEditorViewModel = {
  isCreating: boolean;
  profile: {
    name: string;
    setName: (value: string) => void;
    description: string;
    setDescription: (value: string) => void;
    avatar: string;
    setAvatar: (value: string) => void;
    setAvatarPreview: (value: string | undefined) => void;
    avatarImage?: string;
    builtinAvatarOptions: BuiltinAvatarOption[];
  };
  agent: {
    value: string;
    setValue: (value: string) => void;
    availableBackends: AvailableBackend[];
  };
  prompts: {
    text: string;
    setText: (value: string) => void;
  };
  defaults: {
    model: {
      mode: 'auto' | 'fixed';
      setMode: (value: 'auto' | 'fixed') => void;
      value: string;
      setValue: (value: string) => void;
    };
    permission: {
      mode: 'auto' | 'fixed';
      setMode: (value: 'auto' | 'fixed') => void;
      value: string;
      setValue: (value: string) => void;
    };
    thoughtLevel: {
      mode: 'auto' | 'fixed';
      setMode: (value: 'auto' | 'fixed') => void;
      value: string;
      setValue: (value: string) => void;
    };
    mcps: {
      mode: 'auto' | 'fixed';
      setMode: (value: 'auto' | 'fixed') => void;
      availableServers: IMcpServer[];
      selectedIds: string[];
      setSelectedIds: (value: string[]) => void;
    };
  };
  rules: {
    content: string;
    setContent: (value: string) => void;
    viewMode: 'edit' | 'preview';
    setViewMode: (value: 'edit' | 'preview') => void;
  };
  skills: {
    availableSkills: SkillInfo[];
    selectedSkills: string[];
    setSelectedSkills: (value: string[]) => void;
  };
  actions: {
    save: () => void;
    requestDelete: () => void;
    duplicate: (assistant: AssistantListItem) => void;
  };
};
