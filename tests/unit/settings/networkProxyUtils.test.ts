import { describe, expect, it } from 'vitest';
import { normalizeNetworkProxyUrl } from '../../../packages/desktop/src/renderer/components/settings/SettingsModal/contents/SystemModalContent/networkProxyUtils';

describe('normalizeNetworkProxyUrl', () => {
  it('为省略协议的本地代理地址补充 HTTP 协议', () => {
    expect(normalizeNetworkProxyUrl('127.0.0.1:8080')).toBe('http://127.0.0.1:8080');
  });

  it('保留合法的 HTTPS 代理地址', () => {
    expect(normalizeNetworkProxyUrl('https://proxy.example:8443')).toBe('https://proxy.example:8443');
  });

  it('拒绝凭据、路径和不支持的协议', () => {
    expect(normalizeNetworkProxyUrl('http://user:secret@proxy.example:8080')).toBeNull();
    expect(normalizeNetworkProxyUrl('http://proxy.example:8080/path')).toBeNull();
    expect(normalizeNetworkProxyUrl('socks5://127.0.0.1:1080')).toBeNull();
  });
});
