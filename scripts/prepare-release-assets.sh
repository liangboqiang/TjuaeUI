#!/usr/bin/env bash
# prepare-release-assets.sh
#
# 将多架构构建产物中的 electron-updater 元数据规范化到确定性的
# release-assets/ 目录。
#
# 用法：
#   ./scripts/prepare-release-assets.sh [ARTIFACTS_DIR] [OUTPUT_DIR]
#
# 默认值：
#   ARTIFACTS_DIR = build-artifacts
#   OUTPUT_DIR    = release-assets

set -euo pipefail

ARTIFACTS_DIR="${1:-build-artifacts}"
OUTPUT_DIR="${2:-release-assets}"
VERSION="${MOCK_VERSION:-$(node -p "require('./package.json').version")}"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# ---------------------------------------------------------------------------
# 1）复制全部分发包（文件名必须唯一）。
# ---------------------------------------------------------------------------
echo "==> 正在从 $ARTIFACTS_DIR 复制分发包……"
DISTRIBUTABLES=()
while IFS= read -r file; do
  DISTRIBUTABLES+=("$file")
done < <(find "$ARTIFACTS_DIR" -type f \( \
  -name "*.exe" -o \
  -name "*.msi" -o \
  -name "*.dmg" -o \
  -name "*.deb" -o \
  -name "*.zip" \
\) | sort)

DUPLICATE_BASENAMES=$(for file in "${DISTRIBUTABLES[@]}"; do basename "$file"; done | sort | uniq -d || true)
if [ -n "$DUPLICATE_BASENAMES" ]; then
  echo "::error::发现重复的分发包文件名；平铺输出会发生覆盖："
  echo "$DUPLICATE_BASENAMES"
  exit 1
fi

for file in "${DISTRIBUTABLES[@]}"; do
  cp -f "$file" "$OUTPUT_DIR/"
done

# electron-builder 按 Debian 约定把 x64 命名为 amd64；公开发布统一使用 x64。
LINUX_AMD64_ASSET="$OUTPUT_DIR/TjuaeUI-${VERSION}-linux-amd64.deb"
LINUX_X64_ASSET="$OUTPUT_DIR/TjuaeUI-${VERSION}-linux-x64.deb"
if [ -f "$LINUX_AMD64_ASSET" ]; then
  if [ -e "$LINUX_X64_ASSET" ]; then
    echo "::error::Linux x64 与 amd64 产物同时存在，无法确定规范文件"
    exit 1
  fi
  mv "$LINUX_AMD64_ASSET" "$LINUX_X64_ASSET"
fi

# ---------------------------------------------------------------------------
# 1b）复制 Web CLI 压缩包和 SHA-256 校验和。
# ---------------------------------------------------------------------------
echo "==> 正在从 $ARTIFACTS_DIR 复制 Web CLI 压缩包……"
WEB_CLI_FILES=()
while IFS= read -r file; do
  WEB_CLI_FILES+=("$file")
done < <(find "$ARTIFACTS_DIR" -type f \( \
  -name "tjuaeui-web-*.tar.gz" -o \
  -name "tjuaeui-web-*.tar.gz.sha256" \
\) | sort)

WEB_CLI_DUPS=$(for file in "${WEB_CLI_FILES[@]}"; do basename "$file"; done | sort | uniq -d || true)
if [ -n "$WEB_CLI_DUPS" ]; then
  echo "::error::Web CLI 产物文件名重复："
  echo "$WEB_CLI_DUPS"
  exit 1
fi

for file in "${WEB_CLI_FILES[@]}"; do
  cp -f "$file" "$OUTPUT_DIR/"
done

# ---------------------------------------------------------------------------
# 1c）复制已替换版本号的 install-web.sh。
# ---------------------------------------------------------------------------
echo "==> 正在复制 install-web.sh……"
INSTALL_SCRIPT=$(find "$ARTIFACTS_DIR" -type f -name 'install-web.sh' | head -n 1 || true)
if [ -n "$INSTALL_SCRIPT" ]; then
  cp -f "$INSTALL_SCRIPT" "$OUTPUT_DIR/install-web.sh"
  chmod +x "$OUTPUT_DIR/install-web.sh"
fi

# ---------------------------------------------------------------------------
# 2）从各平台产物目录收集更新元数据。
# ---------------------------------------------------------------------------
echo "==> 正在收集更新元数据……"

WIN_X64_LATEST=$(find "$ARTIFACTS_DIR" -type f -path "*/windows-build-x64/*" -name "latest.yml" | sort | head -n 1 || true)
WIN_ARM64_LATEST=$(find "$ARTIFACTS_DIR" -type f -path "*/windows-build-arm64/*" -name "latest.yml" | sort | head -n 1 || true)
MAC_X64_LATEST=$(find "$ARTIFACTS_DIR" -type f -path "*/macos-build-x64/*" -name "latest-mac.yml" | sort | head -n 1 || true)
MAC_ARM64_LATEST=$(find "$ARTIFACTS_DIR" -type f -path "*/macos-build-arm64/*" -name "latest-mac.yml" | sort | head -n 1 || true)
LINUX_X64_LATEST=$(find "$ARTIFACTS_DIR" -type f -path "*/linux-build-x64/*" -name "latest-linux.yml" | sort | head -n 1 || true)
LINUX_ARM64_LATEST=$(find "$ARTIFACTS_DIR" -type f -path "*/linux-build-arm64/*" -name "latest-linux-arm64.yml" | sort | head -n 1 || true)

# ---------------------------------------------------------------------------
# 3）生成确定性的 electron-updater 规范元数据，避免并行任务同名覆盖。
# ---------------------------------------------------------------------------
echo "==> 正在写入规范更新元数据……"

[ -n "$WIN_X64_LATEST" ]    && cp -f "$WIN_X64_LATEST"    "$OUTPUT_DIR/latest.yml"
[ -n "$MAC_X64_LATEST" ]    && cp -f "$MAC_X64_LATEST"    "$OUTPUT_DIR/latest-mac.yml"
[ -n "$LINUX_X64_LATEST" ]  && cp -f "$LINUX_X64_LATEST"  "$OUTPUT_DIR/latest-linux.yml"
[ -n "$LINUX_ARM64_LATEST" ] && cp -f "$LINUX_ARM64_LATEST" "$OUTPUT_DIR/latest-linux-arm64.yml"

if [ -f "$OUTPUT_DIR/latest-linux.yml" ]; then
  sed -i "s/TjuaeUI-${VERSION}-linux-amd64\.deb/TjuaeUI-${VERSION}-linux-x64.deb/g" \
    "$OUTPUT_DIR/latest-linux.yml"
fi

# ---------------------------------------------------------------------------
# 4）写入 electron-updater 所需的架构专属元数据。
# ---------------------------------------------------------------------------
echo "==> 正在写入架构专属更新元数据……"

[ -n "$WIN_ARM64_LATEST" ]  && cp -f "$WIN_ARM64_LATEST"  "$OUTPUT_DIR/latest-win-arm64.yml"

# macOS 上 electron-updater 按“${channel}-mac.yml”构造文件名；arm64 的
# channel 为 latest-arm64，因此需要 latest-arm64-mac.yml。
[ -n "$MAC_ARM64_LATEST" ]  && cp -f "$MAC_ARM64_LATEST"  "$OUTPUT_DIR/latest-arm64-mac.yml"

# ---------------------------------------------------------------------------
# 5）强制验证必要的更新元数据。
# ---------------------------------------------------------------------------
echo "==> 正在验证必要元数据……"

MISSING=0
for required in latest.yml latest-mac.yml latest-linux.yml latest-linux-arm64.yml; do
  if [ ! -f "$OUTPUT_DIR/$required" ]; then
    echo "::error::缺少必要的更新元数据：$required"
    MISSING=1
  fi
done

# ---------------------------------------------------------------------------
# 5b）强制验证桌面端发布资产。
# ---------------------------------------------------------------------------
echo "==> 正在验证桌面端发布资产……"

for arch in x64 arm64; do
  asset="TjuaeUI-${VERSION}-win-${arch}.exe"
  if [ ! -f "$OUTPUT_DIR/$asset" ]; then
    echo "::error::缺少 Windows 安装器：$asset"
    MISSING=1
  fi

  asset="TjuaeUI-${VERSION}-linux-${arch}.deb"
  if [ ! -f "$OUTPUT_DIR/$asset" ]; then
    echo "::error::缺少 Linux 软件包：$asset"
    MISSING=1
  fi
done

for arch in x64 arm64; do
  for ext in dmg zip; do
    asset="TjuaeUI-${VERSION}-mac-${arch}.${ext}"
    if [ ! -f "$OUTPUT_DIR/$asset" ]; then
      if [ "$ext" = "zip" ]; then
        echo "::error::缺少 macOS ZIP 产物：$asset"
      else
        echo "::error::缺少 macOS DMG 产物：$asset"
      fi
      MISSING=1
    fi
  done
done

# ---------------------------------------------------------------------------
# 5c）强制验证 Web CLI 发布资产。
# ---------------------------------------------------------------------------
echo "==> 正在验证 Web CLI 资产……"

WEB_PLATFORMS=(
  "darwin-arm64"
  "darwin-x86_64"
  "linux-arm64"
  "linux-x86_64"
  "win-x86_64"
)

for plat in "${WEB_PLATFORMS[@]}"; do
  tarball="tjuaeui-web-${VERSION}-${plat}.tar.gz"
  if [ ! -f "$OUTPUT_DIR/$tarball" ]; then
    echo "::error::缺少 Web CLI 压缩包：$tarball"
    MISSING=1
  fi
  if [ ! -f "$OUTPUT_DIR/${tarball}.sha256" ]; then
    echo "::error::缺少 Web CLI 校验和：${tarball}.sha256"
    MISSING=1
  fi
done

if [ ! -f "$OUTPUT_DIR/install-web.sh" ]; then
  echo "::error::缺少 install-web.sh"
  MISSING=1
fi

if [ "$MISSING" -ne 0 ]; then
  exit 1
fi

echo ""
echo "==> 已准备发布资产："
ls -lh "$OUTPUT_DIR"
echo ""
echo "==> 完成。"
