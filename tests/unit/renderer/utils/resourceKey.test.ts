import { createFileResourceKey } from '@/renderer/utils/file/resourceKey';
import { describe, expect, it } from 'vitest';

describe('createFileResourceKey', () => {
  it('treats regular and Windows verbatim paths as the same file', () => {
    const workspace = 'C:\\Users\\Administrator\\AppData\\Roaming\\TjuaeUI';
    expect(createFileResourceKey(workspace, `${workspace}\\skills\\cron\\SKILL.md`)).toBe(
      createFileResourceKey(`\\\\?\\${workspace}`, `\\\\?\\${workspace}\\skills\\cron\\SKILL.md`)
    );
  });

  it('normalizes drive case and path separators', () => {
    expect(createFileResourceKey('c:/work/tjuae', 'C:\\work\\tjuae\\SKILL.md')).toBe(
      createFileResourceKey('C:\\WORK\\TJuae', 'c:/work/tjuae/SKILL.md')
    );
  });

  it('identifies the same absolute file independently of the caller workspace', () => {
    const file = 'C:\\work\\tjuae\\skills\\cron\\SKILL.md';
    expect(createFileResourceKey('C:\\work\\tjuae', file)).toBe(
      createFileResourceKey('C:\\work\\tjuae\\skills\\cron', file)
    );
  });
});
