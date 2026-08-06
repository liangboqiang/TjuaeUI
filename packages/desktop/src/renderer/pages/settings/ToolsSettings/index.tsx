/**
 * ToolsSettings — standalone settings page for MCP servers and built-in tools
 * (e.g. image generation). Split out of the former combined "Capabilities" page
 * so Tools has its own top-level entry in the settings sidebar.
 */

import React from 'react';
import ToolsModalContent from '@/renderer/components/settings/SettingsModal/contents/ToolsModalContent';
import SettingsPageWrapper from '../components/SettingsPageWrapper';

const ToolsSettings: React.FC = () => {
  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      <ToolsModalContent />
    </SettingsPageWrapper>
  );
};

export default ToolsSettings;
