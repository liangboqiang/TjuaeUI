import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import TjuaeManifestRenderer, {
  isTjuaeManifestFileName,
  TjuaeManifestDiffRenderer,
} from '@/renderer/pages/conversation/Preview/components/renderers/TjuaeManifestRenderer';

describe('TjuaeManifestRenderer', () => {
  it('recognizes every .tjuae-xx.json manifest independent of its workspace', () => {
    expect(isTjuaeManifestFileName('.tjuae-skill.json')).toBe(true);
    expect(isTjuaeManifestFileName('.tjuae-assistant.json')).toBe(true);
    expect(isTjuaeManifestFileName('.tjuae-project.json')).toBe(true);
    expect(isTjuaeManifestFileName('skill.json')).toBe(false);
  });

  it('renders and interactively edits structured manifest fields', () => {
    const onContentChange = vi.fn();
    render(
      <TjuaeManifestRenderer
        fileName='.tjuae-skill.json'
        content={JSON.stringify({
          $schema: 'https://raw.githubusercontent.com/liangboqiang/TjuaeHub/main/schemas/tjuae-skill.v1.schema.json',
          schemaVersion: 1,
          id: 'demo',
          version: '1.0.0',
          categories: ['development'],
          enabled: true,
          autoInject: false,
          source: { kind: 'local' },
        })}
        onContentChange={onContentChange}
      />
    );

    expect(screen.getByTestId('tjuae-manifest-preview')).toHaveTextContent('demo');
    expect(screen.queryByText('preview.tjuaeManifest.fields.schema')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('preview.tjuaeManifest.sourceKinds.local')).toHaveAttribute('readonly');
    const versionInput = screen.getByDisplayValue('1.0.0');
    fireEvent.change(versionInput, { target: { value: '1.1.0' } });
    expect(onContentChange).toHaveBeenCalledWith(expect.stringContaining('"version": "1.1.0"'));
  });

  it('renders field-level manifest changes instead of raw JSON text', () => {
    render(
      <TjuaeManifestDiffRenderer
        originalContent='{"version":"1.0.0","preferences":{"autoInject":false}}'
        modifiedContent='{"version":"1.1.0","preferences":{"autoInject":true}}'
        sideBySide
      />
    );

    const diff = screen.getByTestId('tjuae-manifest-diff-preview');
    expect(diff).toHaveTextContent('version');
    expect(diff).toHaveTextContent('Preferences / preview.tjuaeManifest.fields.autoInject');
    expect(diff).toHaveTextContent('1.0.0');
    expect(diff).toHaveTextContent('1.1.0');
  });
});
