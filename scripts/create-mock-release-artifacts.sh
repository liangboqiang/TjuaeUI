#!/usr/bin/env bash

set -euo pipefail

ARTIFACTS_DIR="${1:-build-artifacts}"

rm -rf "$ARTIFACTS_DIR"
mkdir -p "$ARTIFACTS_DIR/windows-build-x64"
mkdir -p "$ARTIFACTS_DIR/windows-build-arm64"
mkdir -p "$ARTIFACTS_DIR/macos-build-x64"
mkdir -p "$ARTIFACTS_DIR/macos-build-arm64"
mkdir -p "$ARTIFACTS_DIR/linux-build-x64"
mkdir -p "$ARTIFACTS_DIR/linux-build-arm64"

# Windows x64。
touch "$ARTIFACTS_DIR/windows-build-x64/TjuaeUI-1.0.0-win-x64.exe"
cat > "$ARTIFACTS_DIR/windows-build-x64/latest.yml" <<'EOF'
version: 1.0.0
files:
  - url: TjuaeUI-1.0.0-win-x64.exe
    sha512: fake-sha512-x64
    size: 100000
path: TjuaeUI-1.0.0-win-x64.exe
sha512: fake-sha512-x64
releaseDate: '2025-01-01'
EOF

# Windows arm64。
touch "$ARTIFACTS_DIR/windows-build-arm64/TjuaeUI-1.0.0-win-arm64.exe"
cat > "$ARTIFACTS_DIR/windows-build-arm64/latest.yml" <<'EOF'
version: 1.0.0
files:
  - url: TjuaeUI-1.0.0-win-arm64.exe
    sha512: fake-sha512-arm64
    size: 100000
path: TjuaeUI-1.0.0-win-arm64.exe
sha512: fake-sha512-arm64
releaseDate: '2025-01-01'
EOF

# macOS x64。
touch "$ARTIFACTS_DIR/macos-build-x64/TjuaeUI-1.0.0-mac-x64.dmg"
touch "$ARTIFACTS_DIR/macos-build-x64/TjuaeUI-1.0.0-mac-x64.zip"
cat > "$ARTIFACTS_DIR/macos-build-x64/latest-mac.yml" <<'EOF'
version: 1.0.0
files:
  - url: TjuaeUI-1.0.0-mac-x64.dmg
    sha512: fake-sha512-mac-x64
    size: 200000
EOF

# macOS arm64。
touch "$ARTIFACTS_DIR/macos-build-arm64/TjuaeUI-1.0.0-mac-arm64.dmg"
touch "$ARTIFACTS_DIR/macos-build-arm64/TjuaeUI-1.0.0-mac-arm64.zip"
cat > "$ARTIFACTS_DIR/macos-build-arm64/latest-mac.yml" <<'EOF'
version: 1.0.0
files:
  - url: TjuaeUI-1.0.0-mac-arm64.dmg
    sha512: fake-sha512-mac-arm64
    size: 200000
EOF

# Linux x64。
touch "$ARTIFACTS_DIR/linux-build-x64/TjuaeUI-1.0.0-linux-x64.deb"
cat > "$ARTIFACTS_DIR/linux-build-x64/latest-linux.yml" <<'EOF'
version: 1.0.0
files:
  - url: TjuaeUI-1.0.0-linux-x64.deb
    sha512: fake-sha512-linux
    size: 300000
EOF

# Linux arm64。
touch "$ARTIFACTS_DIR/linux-build-arm64/TjuaeUI-1.0.0-linux-arm64.deb"
cat > "$ARTIFACTS_DIR/linux-build-arm64/latest-linux-arm64.yml" <<'EOF'
version: 1.0.0
files:
  - url: TjuaeUI-1.0.0-linux-arm64.deb
    sha512: fake-sha512-linux-arm64
    size: 300000
EOF

# Web CLI 压缩包（5 个平台）。
WEB_PLATFORMS=(
  "darwin-arm64"
  "darwin-x86_64"
  "linux-arm64"
  "linux-x86_64"
  "win-x86_64"
)

for plat in "${WEB_PLATFORMS[@]}"; do
  dir="$ARTIFACTS_DIR/web-cli-${plat}"
  mkdir -p "$dir"
  tarball="tjuaeui-web-1.0.0-${plat}.tar.gz"
  touch "$dir/$tarball"
  # 按预期格式生成确定性的伪 SHA-256 文件：
  # “<64 个十六进制字符>  <文件名>”。
  echo "0000000000000000000000000000000000000000000000000000000000000000  ${tarball}" > "$dir/${tarball}.sha256"
done

# install-web.sh（已替换版本占位符）。
mkdir -p "$ARTIFACTS_DIR/install-web-script"
cat > "$ARTIFACTS_DIR/install-web-script/install-web.sh" <<'EOF'
#!/usr/bin/env bash
# 发布脚本测试使用的模拟 install-web.sh。
set -euo pipefail
echo "模拟 install-web.sh"
EOF
chmod +x "$ARTIFACTS_DIR/install-web-script/install-web.sh"

echo "已在 $ARTIFACTS_DIR 创建模拟构件："
find "$ARTIFACTS_DIR" -type f | sort
