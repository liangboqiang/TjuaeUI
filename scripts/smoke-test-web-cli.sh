#!/bin/bash
set -e

TARBALL_PATH=$1

if [ -z "$TARBALL_PATH" ]; then
  echo "用法：$0 <压缩包路径>"
  exit 1
fi

echo "========================================"
echo "Web CLI 压缩包冒烟测试"
echo "========================================"
echo "压缩包：$TARBALL_PATH"

# 1. Extract tarball
echo ""
echo "1. 正在解压……"
TEMP_DIR=$(mktemp -d)
tar -xzf "$TARBALL_PATH" -C "$TEMP_DIR"

# 2. Verify directory structure
echo ""
echo "2. 正在验证目录结构……"
if [ ! -d "$TEMP_DIR/tjuaeui-web" ]; then
  echo "❌ 缺少 tjuaeui-web 目录"
  exit 1
fi

cd "$TEMP_DIR/tjuaeui-web"

# New layout (bun compile standalone binary):
#   tjuaeui-web/
#   ├── tjuaeui-web           ← single compiled executable (no bin/, no dist/, no node_modules)
#   ├── package.json         ← for version lookup
#   ├── static/              ← SPA assets
#   └── bundled-tjuaecore/<plat-arch>/...
for dir in static bundled-tjuaecore; do
  if [ ! -d "$dir" ]; then
    echo "❌ 缺少 $dir 目录"
    exit 1
  fi
  echo "✓ 已找到 $dir/"
done

if [ ! -f "package.json" ]; then
  echo "❌ 缺少 package.json"
  exit 1
fi
echo "✓ 已找到 package.json"

# 3. Check executable
echo ""
echo "3. 正在检查可执行文件……"
if [ ! -x "tjuaeui-web" ]; then
  echo "❌ tjuaeui-web 不可执行"
  exit 1
fi
echo "✓ tjuaeui-web 可执行"

# 4. Test version command
echo ""
echo "4. 正在测试版本命令……"
VERSION=$(./tjuaeui-web version)
if [ -z "$VERSION" ]; then
  echo "❌ 版本命令返回空结果"
  exit 1
fi
echo "✓ 版本：$VERSION"

# 5. 测试后端二进制文件。
echo ""
echo "5. 正在检查后端二进制文件……"
BACKEND_DIR="bundled-tjuaecore/$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/aarch64/arm64/; s/x86_64/x64/')"
BACKEND_BINARY="$BACKEND_DIR/tjuaecore"
if [ ! -x "$BACKEND_BINARY" ]; then
  echo "❌ 后端二进制文件缺失或不可执行：$BACKEND_BINARY"
  exit 1
fi
# 从 manifest.json 读取固定版本，并用 --version 验证清单与二进制文件一致。
if [ -f "$BACKEND_DIR/manifest.json" ]; then
  BACKEND_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$BACKEND_DIR/manifest.json" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
  echo "✓ 后端清单版本：${BACKEND_VERSION:-未知}"
fi
if ! BACKEND_VERSION_OUTPUT=$("$BACKEND_BINARY" --version 2>&1); then
  echo "❌ 后端二进制文件执行失败（--version 返回非零退出码）"
  echo "$BACKEND_VERSION_OUTPUT" | head -5
  exit 1
fi
if [ -n "${BACKEND_VERSION:-}" ] && [[ "$BACKEND_VERSION_OUTPUT" != *"${BACKEND_VERSION#v}"* ]]; then
  echo "❌ 后端二进制版本与清单不一致：$BACKEND_VERSION_OUTPUT / $BACKEND_VERSION"
  exit 1
fi
echo "✓ 后端二进制文件可在当前平台加载：$BACKEND_VERSION_OUTPUT"

# 6. HTTP 冒烟测试：启动 Web CLI，访问根路径并检查 SPA 外壳。
echo ""
echo "6. 正在验证 HTTP 服务返回 SPA 首页……"
HTTP_PORT=25899
DATA_DIR="$(mktemp -d)/tjuaeui-web-data"
# Full-stack start: backend is bundled, so we can also exercise /login below.
# If the bundled backend is missing the CLI falls back to frontend-only mode
# and later login probe is skipped.
./tjuaeui-web start --port "$HTTP_PORT" --data-dir "$DATA_DIR" > /tmp/tjuaeui-web.log 2>&1 &
SERVER_PID=$!

# Wait up to 30s for HTTP to come up. With backend spawned, first start spends
# time on SQLite migrations on slower CI runners.
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${HTTP_PORT}/" > /tmp/tjuaeui-web.html 2>/dev/null; then
    break
  fi
  sleep 1
done

if [ ! -s /tmp/tjuaeui-web.html ]; then
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  echo "❌ HTTP 探测失败，没有响应正文。服务日志："
  cat /tmp/tjuaeui-web.log
  exit 1
fi

# Look for the SPA shell signature — <html + <div id="root" or similar marker
if grep -q '<html' /tmp/tjuaeui-web.html && grep -qE '<(div id="root"|script)' /tmp/tjuaeui-web.html; then
echo "✓ HTTP 根路径返回 SPA 首页（$(wc -c < /tmp/tjuaeui-web.html) 字节）"
else
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  echo "❌ HTTP 根路径响应不像 SPA 首页："
  head -20 /tmp/tjuaeui-web.html
  echo "--- 服务日志 ---"
  cat /tmp/tjuaeui-web.log
  exit 1
fi

# 7. 认证初始化冒烟测试：首次启动时从标准输出取得管理员密码，
#    再提交到 /login，并验证成功响应与会话 Cookie。
echo ""
echo "7. 正在验证首次启动的管理员密码与登录……"
if grep -q '未找到后端二进制文件' /tmp/tjuaeui-web.log; then
  echo "⚠️  已进入仅前端模式（无内置后端），跳过登录探测"
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
else
  # 最多等待 20 秒；后端需先完成迁移，/api/auth/status 才会响应。
  PASSWORD=""
  for i in $(seq 1 20); do
    PASSWORD=$(grep -oE '已生成初始管理员密码：[^ ]+' /tmp/tjuaeui-web.log | head -1 | sed 's/^已生成初始管理员密码：//')
    if [ -n "$PASSWORD" ]; then
      break
    fi
    sleep 1
  done

  if [ -z "$PASSWORD" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    echo "❌ 标准输出中未出现初始管理员密码。"
    echo "--- 服务日志 ---"
    cat /tmp/tjuaeui-web.log
    exit 1
  fi
  echo "✓ 已从标准输出取得初始管理员密码"

  # 向 /login 发起 POST；静态服务器会代理到后端。预期返回 200、
  # success:true，以及至少一个包含会话 Cookie 的 Set-Cookie 响应头。
  LOGIN_BODY=$(printf '{"username":"admin","password":"%s","remember":false}' "$PASSWORD")
  LOGIN_RESP_HEADERS=$(mktemp)
  LOGIN_RESP_BODY=$(mktemp)
  HTTP_CODE=$(curl -sS -o "$LOGIN_RESP_BODY" -D "$LOGIN_RESP_HEADERS" -w '%{http_code}' \
    -X POST "http://127.0.0.1:${HTTP_PORT}/login" \
    -H 'Content-Type: application/json' \
    --data "$LOGIN_BODY" || echo "000")

  # Stop the server before asserting so we don't leak a process on failure.
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true

  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ /login 返回 HTTP $HTTP_CODE"
    echo "--- 响应头 ---"
    cat "$LOGIN_RESP_HEADERS"
    echo "--- 响应正文 ---"
    cat "$LOGIN_RESP_BODY"
    echo "--- 服务日志 ---"
    cat /tmp/tjuaeui-web.log
    exit 1
  fi

  if ! grep -q '"success":[[:space:]]*true' "$LOGIN_RESP_BODY"; then
    echo "❌ /login 返回 200，但响应正文没有 success:true"
    cat "$LOGIN_RESP_BODY"
    exit 1
  fi

  if ! grep -iq '^set-cookie:' "$LOGIN_RESP_HEADERS"; then
    echo "❌ /login 返回成功，但没有 Set-Cookie 响应头"
    cat "$LOGIN_RESP_HEADERS"
    exit 1
  fi
  echo "✓ 使用输出密码登录成功（HTTP 200，且存在 Set-Cookie）"
fi

# Cleanup
cd -
rm -rf "$TEMP_DIR"

echo ""
echo "========================================"
echo "✅ 冒烟测试通过！"
echo "========================================"
