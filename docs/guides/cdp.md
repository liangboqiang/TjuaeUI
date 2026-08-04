# 使用 CDP（Chrome DevTools Protocol）开发 MCP

TjuaeUI 支持通过 CDP 集成外部调试工具。在开发模式（`just dev`）下，CDP 默认监听 9230 端口。

## 在生产环境启用 CDP

1. 打开 TjuaeUI“设置”→“系统”→“开发者调试”
2. 启用“远程调试（CDP）”
3. 重启应用

## 配置 chrome-devtools MCP

将以下内容加入 IDE 的 MCP 配置文件：

| IDE                | 配置路径                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **Cursor**         | `~/.cursor/mcp.json`                                                                                                             |
| **VS Code**        | `~/.vscode/mcp.json`                                                                                                             |
| **Claude Desktop** | macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`；Windows：`%APPDATA%\Claude\claude_desktop_config.json` |
| **Codebuddy**      | `~/.codebuddy/mcp.json`                                                                                                          |

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@0.16.0", "--browser-url=http://127.0.0.1:9230"]
    }
  }
}
```

## 其他适合 AI 开发的工具

| 工具               | 用途                                 | 配置                                      |
| ------------------ | ------------------------------------ | ----------------------------------------- |
| **Playwright MCP** | 浏览器自动化，可替代 chrome-devtools | `"@playwright/mcp@latest"`                |
| **Puppeteer MCP**  | 浏览器自动化                         | `"@puppeteer/mcp@latest"`                 |
| **Filesystem MCP** | 文件操作                             | `@modelcontextprotocol/server-filesystem` |
| **Git MCP**        | Git 仓库操作                         | `@modelcontextprotocol/server-git`        |

更多工具见 [MCP Servers](https://github.com/modelcontextprotocol/servers)。

## 通过 MCP 操作 TjuaeUI

配置完成后，可以使用：

- `list_pages`：列出 TjuaeUI 中已打开的页面
- `take_snapshot`：获取当前页面的无障碍树快照
- `click`、`fill`、`hover`：操作 UI 元素
- `navigate_page`：导航到 URL

## 使用 Chrome DevTools 检查

1. 在 Chrome 中打开 `http://127.0.0.1:9230/json`
2. 点击页面链接，以 DevTools 检查
3. 或打开 `chrome://inspect`，选择“Configure”，添加 `127.0.0.1:9230`
