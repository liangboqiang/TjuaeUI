import { mcpService } from '@/common/adapter/ipcBridge';
import type { IMcpServer } from '@/common/config/storage';

const dedupeServers = (servers: IMcpServer[]) => {
  const seen = new Set<string>();
  const deduped: IMcpServer[] = [];

  for (const server of servers) {
    if (seen.has(server.id)) {
      continue;
    }
    seen.add(server.id);
    deduped.push(server);
  }

  return deduped;
};

/**
 * 读取 Core 已投影且当前用户可见的 MCP 运行目录。
 *
 * 官方定义同样由 Hub 安装后经 Core projector 进入该目录；渲染进程不再
 * 从客户端设置拼接第二份“内置 MCP”，也不携带私有传输配置快照。
 */
export const loadRuntimeMcpCatalog = async (): Promise<IMcpServer[]> =>
  dedupeServers(await mcpService.listServers.invoke());
