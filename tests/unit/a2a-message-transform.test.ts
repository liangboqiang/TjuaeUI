import { describe, expect, it } from 'vitest';
import { transformMessage } from '../../packages/desktop/src/common/chat/chatLib';

describe('A2A message transformation', () => {
  it('keeps structured non-text parts as visible chat messages', () => {
    const message = transformMessage({
      type: 'a2a_part',
      conversation_id: 'conversation-1',
      msg_id: 'part-1',
      data: {
        kind: 'artifact',
        artifact_id: 'artifact-1',
        name: 'Report',
        data: { answer: 42 },
        filename: 'report.json',
        media_type: 'application/json',
      },
    } as never);

    expect(message).toMatchObject({
      type: 'a2a_part',
      position: 'left',
      conversation_id: 'conversation-1',
      msg_id: 'part-1',
      content: {
        kind: 'artifact',
        artifact_id: 'artifact-1',
        data: { answer: 42 },
      },
    });
  });

  it('rejects malformed part kinds instead of rendering arbitrary system payloads', () => {
    const message = transformMessage({
      type: 'a2a_part',
      conversation_id: 'conversation-1',
      data: {
        kind: 'execute_local_command',
        data: { command: 'do not run' },
      },
    } as never);

    expect(message).toBeUndefined();
  });
});
