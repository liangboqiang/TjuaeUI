#!/usr/bin/env bash

set -euo pipefail

OUTPUT_DIR="${1:-release-assets}"
VERSION="${2:-$(node -p "require('./package.json').version")}"
ERRORS=0

for f in latest.yml latest-mac.yml latest-linux.yml latest-linux-arm64.yml; do
  if [ ! -f "$OUTPUT_DIR/$f" ]; then
    echo "失败：缺少规范元数据：$f"
    ERRORS=$((ERRORS + 1))
  fi
done

extract_ref_file() {
  local metadata_file="$1"
  local ref
  ref=$(grep -E '^path:' "$metadata_file" | head -n 1 | sed -E 's/^path:[[:space:]]*//')
  if [ -z "$ref" ]; then
    ref=$(grep -E '^[[:space:]]*-?[[:space:]]*url:' "$metadata_file" | head -n 1 | sed -E 's/^[[:space:]]*-?[[:space:]]*url:[[:space:]]*//')
  fi
  echo "$ref"
}

assert_metadata_points_to_existing_file() {
  local metadata_name="$1"
  local expected_pattern="$2"
  local metadata_path="$OUTPUT_DIR/$metadata_name"

  local ref_file
  ref_file=$(extract_ref_file "$metadata_path")

  if [ -z "$ref_file" ]; then
    echo "失败：$metadata_name 没有 path/url 条目"
    ERRORS=$((ERRORS + 1))
    return
  fi

  if [[ ! "$ref_file" =~ $expected_pattern ]]; then
    echo "失败：$metadata_name 指向非预期文件：$ref_file"
    ERRORS=$((ERRORS + 1))
    return
  fi

  if [ ! -f "$OUTPUT_DIR/$ref_file" ]; then
    echo "失败：$metadata_name 引用了缺失文件：$ref_file"
    ERRORS=$((ERRORS + 1))
    return
  fi

  echo "通过：$metadata_name -> $ref_file"
}

assert_metadata_points_to_existing_file "latest.yml" "(win-x64|win32-x64|x64)"
assert_metadata_points_to_existing_file "latest-mac.yml" "(mac-x64|darwin-x64|x64)"
assert_metadata_points_to_existing_file "latest-linux.yml" "(linux|AppImage|deb)"
assert_metadata_points_to_existing_file "latest-linux-arm64.yml" "(arm64|aarch64)"

for f in latest-win-arm64.yml latest-arm64-mac.yml; do
  if [ ! -f "$OUTPUT_DIR/$f" ]; then
    echo "失败：缺少架构专属更新元数据：$f"
    ERRORS=$((ERRORS + 1))
  else
    echo "通过：$f 存在"
  fi
done

for f in TjuaeUI-${VERSION}-win-x64.exe TjuaeUI-${VERSION}-win-arm64.exe TjuaeUI-${VERSION}-mac-x64.dmg TjuaeUI-${VERSION}-mac-arm64.dmg TjuaeUI-${VERSION}-linux-x64.deb TjuaeUI-${VERSION}-linux-arm64.deb; do
  if [ ! -f "$OUTPUT_DIR/$f" ]; then
    echo "失败：缺少分发包：$f"
    ERRORS=$((ERRORS + 1))
  else
    echo "通过：$f 存在"
  fi
done

# Web CLI 压缩包与校验和。
for plat in darwin-arm64 darwin-x86_64 linux-arm64 linux-x86_64 win-x86_64; do
  tarball="tjuaeui-web-${VERSION}-${plat}.tar.gz"
  for f in "$tarball" "${tarball}.sha256"; do
    if [ ! -f "$OUTPUT_DIR/$f" ]; then
      echo "失败：缺少 Web CLI 资产：$f"
      ERRORS=$((ERRORS + 1))
    else
      echo "通过：$f 存在"
    fi
  done
done

if [ ! -f "$OUTPUT_DIR/install-web.sh" ]; then
  echo "失败：缺少 install-web.sh"
  ERRORS=$((ERRORS + 1))
else
  echo "通过：install-web.sh 存在"
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "验证失败：发现 $ERRORS 个错误"
  exit 1
fi

echo "全部检查通过"
