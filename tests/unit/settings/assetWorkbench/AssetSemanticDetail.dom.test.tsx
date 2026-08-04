import type { AssetFile, AssetKind } from '@/common/types/agent/assets';
import AssetSemanticDetail, {
  type SemanticAssetFile,
} from '@/renderer/pages/settings/Assets/components/AssetSemanticDetail';
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => (options?.count === undefined ? key : `${key}:${options.count}`),
  }),
}));

vi.mock('@/renderer/components/Markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <article data-testid='semantic-markdown'>{children}</article>
  ),
}));

const definitionFile = (path: string, content: string): AssetFile => ({
  assetId: 'asset:test',
  path,
  digest: 'sha256-definition',
  mediaType: path.endsWith('.md') ? 'text/markdown' : 'application/json',
  content,
  contentSource: 'local',
});

const renderDetail = (
  kind: AssetKind,
  entryFile: string,
  content: string,
  files: SemanticAssetFile[] = [{ path: entryFile, size: content.length, mediaType: 'text/plain' }]
) => {
  const loadFile = vi.fn(async (path: string) => definitionFile(path, content));
  const onOpenFile = vi.fn();
  render(
    <AssetSemanticDetail
      assetKey={`${kind}:test`}
      kind={kind}
      description='测试资产说明'
      runtimeId={`${kind}-runtime`}
      entryFile={entryFile}
      files={files}
      dependencies={['asset:foundation']}
      version='1.2.3'
      runtimeState='active'
      healthState='healthy'
      loadFile={loadFile}
      onOpenFile={onOpenFile}
    />
  );
  return { loadFile, onOpenFile };
};

describe('semantic-first asset details', () => {
  it('renders skill frontmatter, markdown outline, and conventional asset folders', async () => {
    const content = `---\nname: demo\ndescription: 演示技能\n---\n# 演示\n## 工作流程\n正文`;
    const { onOpenFile } = renderDetail('skill', 'SKILL.md', content, [
      { path: 'SKILL.md', size: content.length, mediaType: 'text/markdown' },
      { path: 'scripts/run.ts', size: 8, mediaType: 'text/plain' },
      { path: 'references/api.md', size: 8, mediaType: 'text/markdown' },
      { path: 'templates/report.md', size: 8, mediaType: 'text/markdown' },
      { path: 'resources/schema.json', size: 8, mediaType: 'application/json' },
    ]);

    expect(await screen.findByTestId('semantic-markdown')).toHaveTextContent('工作流程');
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('演示技能')).toBeInTheDocument();
    expect(screen.getByText('scripts/run.ts')).toBeInTheDocument();
    expect(screen.getByText('references/api.md')).toBeInTheDocument();
    expect(screen.getByText('templates/report.md')).toBeInTheDocument();
    expect(screen.getByText('resources/schema.json')).toBeInTheDocument();
    fireEvent.click(screen.getByText('scripts/run.ts'));
    expect(onOpenFile).toHaveBeenCalledWith('scripts/run.ts');
  });

  it('renders assistant rules, prompts, and declared dependencies', async () => {
    const content = JSON.stringify({
      kind: 'assistant',
      rules: { 'zh-CN': 'rules/zh-CN.md' },
      recommendedPrompts: ['整理本周进展'],
      skillDependencies: ['skill:summary'],
    });
    renderDetail('assistant', 'assistant.json', content);

    const semantic = await screen.findByTestId('asset-semantic-detail');
    expect(within(semantic).getByText('rules/zh-CN.md')).toBeInTheDocument();
    expect(within(semantic).getByText('整理本周进展')).toBeInTheDocument();
    expect(within(semantic).getByText('skill:summary')).toBeInTheDocument();
    expect(within(semantic).getByText('asset:foundation')).toBeInTheDocument();
  });

  it('renders engine protocol, user-installed command, capabilities, and typed configuration binding', async () => {
    const content = JSON.stringify({
      kind: 'engineAdapter',
      protocol: { type: 'acp', transport: 'stdio' },
      runtime: {
        commandName: 'codex',
      },
      capabilities: { streaming: true },
      configurationSchema: {
        fields: [
          {
            key: 'apiKey',
            label: 'API 密钥',
            required: true,
            secret: true,
            binding: { target: 'environment', name: 'OPENAI_API_KEY' },
          },
        ],
      },
    });
    renderDetail('engineAdapter', 'engine-adapter.json', content);

    const contentSection = await screen.findByTestId('asset-semantic-content');
    expect(contentSection).toHaveTextContent('acp · stdio');
    expect(contentSection).toHaveTextContent('codex');
    expect(contentSection).not.toHaveTextContent('@zed-industries/codex-acp');
    expect(contentSection).not.toHaveTextContent('bunx');
    expect(screen.getByText('streaming')).toBeInTheDocument();
    expect(screen.getByText('API 密钥')).toBeInTheDocument();
    expect(screen.getByText('environment:OPENAI_API_KEY')).toBeInTheDocument();
  });

  it('renders MCP transport, tools capability, package, and health state', async () => {
    const content = JSON.stringify({
      kind: 'mcp',
      transport: {
        type: 'stdio',
        package: { name: '@modelcontextprotocol/server-everything', version: '1.0.0', runner: 'npx' },
      },
      capabilities: { tools: true, resources: true },
    });
    renderDetail('mcp', 'mcp.json', content);

    const semantic = await screen.findByTestId('asset-semantic-detail');
    expect(semantic).toHaveTextContent('stdio');
    expect(semantic).toHaveTextContent('@modelcontextprotocol/server-everything@1.0.0 · npx');
    expect(semantic).toHaveTextContent('settings.assetWorkbench.semantic.supported');
    expect(semantic).toHaveTextContent('healthy');
  });
});
