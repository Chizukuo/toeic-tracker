import { describe, expect, it } from 'vitest';

import { createSnapshot } from '@/lib/storeSnapshot';
import { createInitialSessions } from '@/lib/toeic';
import {
  SYNC_HASH_PREFIX,
  buildSyncHash,
  buildSyncUrl,
  decodeSnapshotFromSyncPayload,
  encodeSnapshotToSyncPayload,
  extractSyncPayloadFromHash,
} from '@/lib/syncLink';

describe('syncLink helpers', () => {
  it('round-trips a canonical snapshot through compressed sync payloads', () => {
    const snapshot = createSnapshot({
      sessions: createInitialSessions(),
      activeSessionId: 'R3',
      locale: 'en',
      examDate: '2026-06-15',
      historicalScores: [
        {
          id: 'score-1',
          date: '2026-03-11',
          listening: 350,
          reading: 340,
          total: 690,
          source: 'manual',
          note: 'mock',
        },
      ],
    });

    const payload = encodeSnapshotToSyncPayload(snapshot);
    const decoded = decodeSnapshotFromSyncPayload(payload);

    expect(decoded).toEqual(snapshot);
  });

  it('builds and extracts hash-based sync links', () => {
    const snapshot = createSnapshot({
      sessions: createInitialSessions(),
      activeSessionId: 'L1',
      locale: 'zh',
      examDate: '2026-05-24',
      historicalScores: [],
    });

    const hash = buildSyncHash(snapshot);
    const url = buildSyncUrl(snapshot, 'https://example.com/vault#stale');
    const payload = extractSyncPayloadFromHash(hash);

    expect(hash.startsWith(`#${SYNC_HASH_PREFIX}`)).toBe(true);
    expect(url.startsWith('https://example.com/vault#')).toBe(true);
    expect(payload).not.toBeNull();
    expect(decodeSnapshotFromSyncPayload(payload!)).toEqual(snapshot);
  });

  it('rejects malformed sync payloads', () => {
    expect(() => decodeSnapshotFromSyncPayload('not-a-sync-payload')).toThrow('Invalid sync payload');
  });
});