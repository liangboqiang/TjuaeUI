#!/bin/bash
# ============================================================================
# Smoke test for install-web.sh
# Tests the full installation flow in a container environment
# ============================================================================

set -euo pipefail

MIRROR="${1:-}"
VERSION="${2:-}"

if [[ -z "$MIRROR" ]]; then
  echo "用法：$0 <镜像地址> [版本]"
  echo "示例：$0 file:///tmp/releases 3.0.0"
    exit 1
fi

echo "========================================"
echo "install-web.sh 冒烟测试"
echo "========================================"
echo "镜像：$MIRROR"
echo "版本：${VERSION:-latest}"

# 1. Download install-web.sh
echo ""
echo "1. 正在下载 install-web.sh……"
if [[ "$MIRROR" == file://* ]]; then
    # Local mirror: copy from filesystem
    base_path="${MIRROR#file://}"
    cp "${base_path}/install-web.sh" /tmp/install-web.sh
else
    # Remote mirror: use curl
    curl -fsSL "${MIRROR}/install-web.sh" -o /tmp/install-web.sh
fi
chmod +x /tmp/install-web.sh

# 2. Run installation
echo ""
echo "2. 正在执行安装……"
export MIRROR="$MIRROR"
export VERSION="${VERSION:-latest}"
export INSTALL_DIR="/tmp/tjuaeui-web-smoke-test"
export BIN_DIR="/tmp/smoke-bin"
export CREATE_SYMLINK=1
export UPDATE_PATH=0  # Don't modify shell profile in container

bash /tmp/install-web.sh --no-path

# 3. Verify installation
echo ""
echo "3. 正在验证安装……"

if [[ ! -d "$INSTALL_DIR" ]]; then
  echo "❌ 未找到安装目录：$INSTALL_DIR"
    exit 1
fi
echo "✓ 安装目录存在"

if [[ ! -x "${INSTALL_DIR}/tjuaeui-web" ]]; then
  echo "❌ CLI 可执行文件缺失或不可执行：${INSTALL_DIR}/tjuaeui-web"
    exit 1
fi
echo "✓ CLI 可执行文件存在"

if [[ ! -L "${BIN_DIR}/tjuaeui-web" ]]; then
  echo "❌ 未找到符号链接：${BIN_DIR}/tjuaeui-web"
    exit 1
fi
echo "✓ 符号链接已创建"

# 4. Test version command
echo ""
echo "4. 正在测试版本命令……"
export PATH="${BIN_DIR}:$PATH"
VERSION_OUTPUT=$(tjuaeui-web version 2>&1 || echo "")
if [[ -z "$VERSION_OUTPUT" ]]; then
  echo "❌ 版本命令返回空结果"
    exit 1
fi
echo "✓ 版本：$VERSION_OUTPUT"

# Cleanup
rm -rf "$INSTALL_DIR" "$BIN_DIR" /tmp/install-web.sh

echo ""
echo "========================================"
echo "✅ 冒烟测试通过！"
echo "========================================"
