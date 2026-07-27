# TjuaeUI WebUI 启动指南

WebUI 允许通过现代浏览器使用 TjuaeUI。可以只监听本机，也可以显式开启局域网访问；服务器部署见[无头服务器部署指南](deploy-server.md)。

## 运行方式

TjuaeUI 提供三种 WebUI 入口：

| 入口                            | 适用场景                             | 是否依赖 Electron |
| ------------------------------- | ------------------------------------ | ----------------- |
| 桌面应用中的 WebUI 开关         | 已安装桌面应用，希望同时从浏览器访问 | 是                |
| `TjuaeUI --webui`               | 使用打包后的桌面可执行文件启动 WebUI | 是                |
| `tjuaeui-web` / `bun run webui` | 服务器、容器或源码开发环境           | 否                |

默认端口：

- 生产构建：`25808`
- 开发环境：`25809`
- 多实例开发的第二实例：`25810`

实际端口以启动日志为准。

## 桌面应用内启用

1. 打开 TjuaeUI 设置中的 WebUI 配置
2. 选择监听端口
3. 仅在确有局域网访问需求时启用远程访问
4. 启动 WebUI，并复制界面显示的本地或局域网 URL

设置会保存在 TjuaeCore 的客户端设置中，并在下次启动时恢复。认证用户与密码以 TjuaeCore 的 SQLite 用户表为唯一事实来源。

## 使用打包后的桌面应用

### Windows

在 Command Prompt 或 PowerShell 中运行：

```cmd
"C:\Program Files\TjuaeUI\TjuaeUI.exe" --webui
```

允许局域网访问：

```cmd
"C:\Program Files\TjuaeUI\TjuaeUI.exe" --webui --remote
```

指定端口：

```cmd
"C:\Program Files\TjuaeUI\TjuaeUI.exe" --webui --port 8080
```

也可以创建 `start-tjuaeui-webui.bat`：

```batch
@echo off
"C:\Program Files\TjuaeUI\TjuaeUI.exe" --webui
pause
```

### macOS

```bash
/Applications/TjuaeUI.app/Contents/MacOS/TjuaeUI --webui

# 或
open -a TjuaeUI --args --webui
```

局域网访问：

```bash
/Applications/TjuaeUI.app/Contents/MacOS/TjuaeUI --webui --remote
```

### Linux

`.deb` 安装：

```bash
tjuaeui --webui

# 或
/opt/TjuaeUI/tjuaeui --webui
```

AppImage：

```bash
chmod +x TjuaeUI-*.AppImage
./TjuaeUI-*.AppImage --webui
```

### Linux systemd 服务

需要后台运行时，创建 `/etc/systemd/system/tjuaeui-webui.service`：

```ini
[Unit]
Description=TjuaeUI WebUI Service
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
ExecStart=/opt/TjuaeUI/tjuaeui --webui
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tjuaeui-webui.service
sudo systemctl status tjuaeui-webui.service
```

只有需要从其他设备连接时，才在 `ExecStart` 中增加 `--remote`。公网部署应配合 TLS 反向代理和外围访问控制。

## 无 Electron 的独立 WebUI

### 源码开发

TjuaeCore 的 `tjuaecore` 必须已位于 `PATH`，或通过环境变量指定。

```bash
bun install
bun run webui
```

该命令会先运行 `bun run package` 刷新 renderer，再启动后端、静态服务器与认证层。快速迭代脚本本身时可以跳过重新构建：

```bash
bun run webui -- --no-build
```

生产模式：

```bash
bun run webui:prod
```

允许局域网访问：

```bash
bun run webui:remote
bun run webui:prod:remote
```

### 独立 CLI

如果安装包提供 `tjuaeui-web`：

```bash
tjuaeui-web start
tjuaeui-web start --port 8080
tjuaeui-web start --remote
tjuaeui-web help
```

常用参数：

| 参数                   | 说明                           |
| ---------------------- | ------------------------------ |
| `--port <n>`           | 监听端口                       |
| `--remote`             | 绑定 `0.0.0.0`，允许局域网访问 |
| `--open`               | 强制打开本机浏览器             |
| `--no-open`            | 禁止自动打开浏览器             |
| `--data-dir <path>`    | 覆盖数据目录                   |
| `--log-dir <path>`     | 覆盖日志目录                   |
| `--static-dir <path>`  | 使用指定的 renderer 静态资源   |
| `--backend-bin <path>` | 指定 `tjuaecore` 可执行文件    |

### 独立模式数据目录

为避免与 Electron 的 userData 和符号链接发生冲突，独立 WebUI 默认使用：

| 模式               | 默认数据目录           |
| ------------------ | ---------------------- |
| 生产               | `~/.tjuaeui-web`       |
| 开发               | `~/.tjuaeui-web-dev`   |
| 多实例开发第二实例 | `~/.tjuaeui-web-dev-2` |

只有明确需要共享数据时，才通过 `--data-dir` 或 `TJUAEUI_DATA_DIR` 指向桌面应用的数据目录。不要让两个后端进程同时打开同一个 SQLite 数据库。

## 环境变量

| 环境变量                      | 说明                                                |
| ----------------------------- | --------------------------------------------------- |
| `TJUAEUI_PORT`                | WebUI 监听端口                                      |
| `TJUAEUI_HOST`                | host 提示；`0.0.0.0`、`::` 会启用远程访问           |
| `TJUAEUI_ALLOW_REMOTE`        | `1`/`true` 时允许局域网访问                         |
| `TJUAEUI_DATA_DIR`            | 独立模式数据目录                                    |
| `TJUAEUI_LOG_DIR`             | 日志目录，默认 `<data-dir>/logs`                    |
| `TJUAEUI_STATIC_DIR`          | renderer 静态资源目录                               |
| `TJUAEUI_BACKEND_BIN`         | `tjuaecore` 的绝对路径                              |
| `TJUAEUI_BACKEND_BUNDLED_DIR` | 包含 `bundled-tjuaecore/<platform-arch>/` 的目录    |
| `TJUAEUI_OPEN_BROWSER`        | `1`/`true` 强制打开浏览器；`0`/`false` 禁止自动打开 |
| `TJUAEUI_NO_BUILD`            | 源码 WebUI 中跳过 `bun run package`                 |

示例：

```bash
export TJUAEUI_PORT=8080
export TJUAEUI_ALLOW_REMOTE=true
export TJUAEUI_BACKEND_BIN=/opt/tjuae/bin/tjuaecore
bun run webui:prod
```

## 远程访问

`--remote` 会将服务从 `127.0.0.1` 改为监听 `0.0.0.0`。这意味着同一网络中的设备可能访问该端口。

### 查找局域网地址

Windows：

```cmd
ipconfig
```

macOS：

```bash
ipconfig getifaddr en0
```

Linux：

```bash
hostname -I
```

其他设备访问：

```text
http://YOUR_LAN_IP:25808
```

### 安全建议

- 首次启动后立即修改初始密码
- 公网访问使用 TLS 反向代理，不要长期暴露明文 HTTP
- 配置主机防火墙、安全组、VPN 或零信任网关
- 不需要远程访问时，不要使用 `--remote`
- 不要将 WebUI 与其他服务共用弱口令

## 重置管理员密码

重置会生成随机新密码，并使现有会话失效。

### 打包后的桌面可执行文件

Windows：

```cmd
"C:\Program Files\TjuaeUI\TjuaeUI.exe" --resetpass
```

macOS：

```bash
/Applications/TjuaeUI.app/Contents/MacOS/TjuaeUI --resetpass
```

Linux：

```bash
tjuaeui --resetpass
```

### 独立 WebUI

源码环境：

```bash
bun run resetpass

# 自定义数据目录或端口
bun run resetpass -- --data-dir /path/to/data --port 8080
```

独立 CLI：

```bash
tjuaeui-web resetpass
tjuaeui-web resetpass --data-dir /path/to/data
```

如果对应端口已有 WebUI 正在运行，命令会复用其 API；否则会临时启动 TjuaeCore 完成重置后退出。终端显示新密码后应立即保存并在下次登录后修改。

## Android（Termux，实验性）

Electron 桌面模式不支持 Android。通过 Termux + proot 运行 Linux ARM64 包属于实验性方案，不在正式支持矩阵中；升级 Android、Termux、Ubuntu rootfs 或 Electron 后都可能失效。

基本流程：

```bash
pkg update -y
pkg install proot-distro -y
proot-distro install ubuntu
proot-distro login ubuntu
```

在 proot Ubuntu 中安装必要库与 ARM64 `.deb`，然后使用：

```bash
TjuaeUI --no-sandbox --webui
```

`--no-sandbox` 会降低隔离能力，只应在受控的 proot 环境中使用。遇到问题时请附上 Android、Termux、rootfs、架构、TjuaeUI 版本和完整日志。

## 故障排查

### 端口已占用

指定其他端口：

```bash
tjuaeui-web start --port 8080

# 或
bun run webui -- --port 8080
```

先用系统工具定位占用进程，确认后再停止，不要盲目终止不明进程。

### 浏览器无法访问

1. 查看启动日志中的实际 URL 与端口
2. 本机模式使用 `127.0.0.1` 或 `localhost`
3. 跨设备访问确认已启用 `--remote`
4. 检查防火墙、安全组、容器端口映射和反向代理
5. 确认 WebSocket 也被代理

### 找不到 `tjuaecore`

```bash
# macOS / Linux
which tjuaecore

# Windows
where.exe tjuaecore
```

将其加入 `PATH`，或设置 `TJUAEUI_BACKEND_BIN`/`--backend-bin`。

### 找不到 renderer 资源

源码模式先运行：

```bash
bun run package
```

也可以通过 `TJUAEUI_STATIC_DIR` 或 `--static-dir` 指定已经构建的 `out/renderer`。

### 密码重置到了错误的数据目录

确保 WebUI 与重置命令使用相同的 `--data-dir`、`TJUAEUI_DATA_DIR` 和 `NODE_ENV`。开发与生产默认目录不同。

## 相关文档

- [TjuaeUI 主 README](../../readme.md)
- [无头服务器部署](deploy-server.md)
- [开发环境](../contributing/development.md)
- [架构总览](../architecture/overview.md)
- [GitHub Issues](https://github.com/liangboqiang/TjuaeUI/issues)
