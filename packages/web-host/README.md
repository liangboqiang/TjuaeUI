# @tjuae/web-host

TjuaeUI 的 WebUI host 包，不依赖 Electron。

## 职责

- **backend-launcher**：创建或复用现有 `tjuaecore` 进程
- **static-server**：提供 `out/renderer` SPA，并将 `/api` 与 `/ws` 反向代理到后端
- **auth**：密码重置、修改、验证及配置读写（bcrypt + session）

## 用法

```ts
import { startWebHost } from '@tjuae/web-host';

const handle = await startWebHost({
  app: {
    version: '1.0.0',
    isPackaged: false,
    resourcesPath: '/path/to/resources',
    userDataPath: '/path/to/userData',
  },
  staticDir: '/path/to/out/renderer',
  backend: {
    kind: 'ownBackend',
    resolveBackend: () => '/path/to/tjuaecore',
  },
});

console.log(`WebUI running at ${handle.url}`);

await handle.stop();
```

## 状态

M3：骨架、类型定义与占位实现；占位实现目前都会抛出 `not implemented yet`。
