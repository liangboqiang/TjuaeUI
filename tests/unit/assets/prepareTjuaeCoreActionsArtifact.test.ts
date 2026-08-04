import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';

const {
  getActionsArtifactName,
  getActionsArtifactMissingMessage,
  prepareTjuaeCore,
} = require('../../../packages/shared-scripts/src/prepare-tjuaecore');

const posixFakeToolchainIt = process.platform === 'win32' ? it.skip : it;

function writeFile(filePath: string, contents = 'x') {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function writeExecutable(filePath: string, contents: string) {
  writeFile(filePath, contents);
  chmodSync(filePath, 0o755);
}

function createFakeToolchain(root: string, { curlFails = false } = {}) {
  const binDir = join(root, 'bin');
  mkdirSync(binDir, { recursive: true });

  writeExecutable(
    join(binDir, 'curl'),
    curlFails
      ? '#!/usr/bin/env bash\nexit 1\n'
      : `#!/usr/bin/env bash
set -euo pipefail
out=''
while [[ $# -gt 0 ]]; do
  if [[ "$1" == '-o' ]]; then
    shift
    out="$1"
  fi
  shift || true
done
if [[ -z "$out" ]]; then
  printf '{}'
  exit 0
fi
mkdir -p "$(dirname "$out")"
printf 'archive' > "$out"
`
  );
  writeExecutable(join(binDir, 'wget'), '#!/usr/bin/env bash\nexit 1\n');
  writeExecutable(
    join(binDir, 'gh'),
    `#!/usr/bin/env bash
cat <<'JSON'
{"artifacts":[{"id":123,"name":"tjuaecore-manual-linux-x64","archive_download_url":"https://example.invalid/artifact.zip"}]}
JSON
`
  );
  writeExecutable(
    join(binDir, 'unzip'),
    `#!/usr/bin/env bash
set -euo pipefail
out=''
while [[ $# -gt 0 ]]; do
  if [[ "$1" == '-d' ]]; then
    shift
    out="$1"
  fi
  shift || true
done
mkdir -p "$out"
printf 'archive' > "$out/tjuaecore-v0.1.46-x86_64-unknown-linux-gnu.tar.gz"
`
  );
  writeExecutable(
    join(binDir, 'tar'),
    `#!/usr/bin/env bash
set -euo pipefail
out=''
while [[ $# -gt 0 ]]; do
  if [[ "$1" == '-C' ]]; then
    shift
    out="$1"
  fi
  shift || true
done
mkdir -p "$out"
cat > "$out/tjuaecore" <<'SH'
#!/usr/bin/env bash
exit 0
SH
chmod +x "$out/tjuaecore"
`
  );

  return binDir;
}

afterEach(() => {
  delete process.env.TJUAEUI_BACKEND_RUN_ID;
  delete process.env.TJUAEUI_BACKEND_BUILD_MODE;
  delete process.env.TJUAEUI_BACKEND_LOCAL_BINARY;
  rmSync(join(tmpdir(), 'tjuaecore-prepare', 'v0.1.46'), { recursive: true, force: true });
  rmSync(join(tmpdir(), 'tjuaecore-prepare-actions', '123'), { recursive: true, force: true });
});

describe('prepare-tjuaecore GitHub Actions artifact resolver', () => {
  it.each([
    ['win32', 'x64', 'tjuaecore-manual-windows-x64'],
    ['win32', 'arm64', 'tjuaecore-manual-windows-arm64'],
    ['darwin', 'x64', 'tjuaecore-manual-macos-x64'],
    ['darwin', 'arm64', 'tjuaecore-manual-macos-arm64'],
    ['linux', 'x64', 'tjuaecore-manual-linux-x64'],
    ['linux', 'arm64', 'tjuaecore-manual-linux-arm64'],
  ])('maps %s-%s to %s', (platform, arch, artifactName) => {
    expect(getActionsArtifactName(platform, arch)).toBe(artifactName);
  });

  it('说明请求平台缺少哪个 TjuaeCore 手动构建产物', () => {
    expect(
      getActionsArtifactMissingMessage({
        runId: '27319522909',
        platform: 'win32',
        arch: 'x64',
        expectedArtifactName: 'tjuaecore-manual-windows-x64',
        availableArtifactNames: ['tjuaecore-manual-macos-arm64', 'tjuaecore-manual-linux-x64'],
      })
    ).toBe(
      [
        'TjuaeCore 运行 27319522909 不包含 win32-x64 所需的产物 [ tjuaecore-manual-windows-x64 ]。',
        '可用产物：tjuaecore-manual-macos-arm64, tjuaecore-manual-linux-x64。',
        '请重新运行 TjuaeCore 手动构建，平台选择 [ windows-x64 ] 或 all。',
      ].join(' ')
    );
  });

  // 这些用例会执行临时 POSIX shell 脚本形式的 tjuaecore 二进制文件。
  // Windows 下的契约拒绝覆盖由验证器与本地资源包测试负责。
  posixFakeToolchainIt('hard fails Actions artifact input when prepared managed resources lack contract', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'tjuaeui-actions-gate-'));
    const fakeBin = createFakeToolchain(tmp);
    const previousPath = process.env.PATH;
    process.env.PATH = `${fakeBin}${delimiter}${previousPath || ''}`;
    process.env.TJUAEUI_BACKEND_RUN_ID = '123';

    try {
      expect(() =>
        prepareTjuaeCore({
          projectRoot: join(tmp, 'project'),
          platform: 'linux',
          arch: 'x64',
          version: 'v0.1.46',
        })
      ).toThrow(/managed-resources\/manifest\.json/);
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  posixFakeToolchainIt('hard fails GitHub release download input when prepared managed resources lack contract', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'tjuaeui-download-gate-'));
    const fakeBin = createFakeToolchain(tmp);
    const previousPath = process.env.PATH;
    process.env.PATH = `${fakeBin}${delimiter}${previousPath || ''}`;

    try {
      expect(() =>
        prepareTjuaeCore({
          projectRoot: join(tmp, 'project'),
          platform: 'linux',
          arch: 'x64',
          version: 'v0.1.46',
        })
      ).toThrow(/managed-resources\/manifest\.json/);
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  posixFakeToolchainIt('hard fails local binary fallback when prepared managed resources lack contract', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'tjuaeui-local-binary-gate-'));
    const localBinary = join(tmp, 'tjuaecore');
    writeExecutable(localBinary, '#!/usr/bin/env bash\nexit 0\n');
    const fakeBin = createFakeToolchain(tmp, { curlFails: true });
    const previousPath = process.env.PATH;
    process.env.PATH = `${fakeBin}${delimiter}${previousPath || ''}`;
    process.env.TJUAEUI_BACKEND_BUILD_MODE = 'development';
    process.env.TJUAEUI_BACKEND_LOCAL_BINARY = localBinary;

    try {
      expect(() =>
        prepareTjuaeCore({
          projectRoot: join(tmp, 'project'),
          platform: 'linux',
          arch: 'x64',
          version: 'v0.1.46',
        })
      ).toThrow(/managed-resources\/manifest\.json/);
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
