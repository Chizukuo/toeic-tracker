import { strToU8, zlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { createSnapshot } from '@/lib/storeSnapshot';
import {
  LISTENING_PARTS,
  LISTENING_TAGS,
  READING_LAP_SEGMENTS,
  READING_PARTS,
  READING_TAGS,
  createInitialSessions,
} from '@/lib/toeic';
import {
  SYNC_HASH_PREFIX,
  buildSyncHash,
  buildSyncUrl,
  decodeSnapshotFromSyncPayload,
  encodeSnapshotToSyncPayload,
  extractSyncPayloadFromHash,
} from '@/lib/syncLink';

function legacyEncodeSnapshotToSyncPayload(snapshot: ReturnType<typeof createSnapshot>) {
  const json = JSON.stringify(snapshot);
  const compressed = zlibSync(strToU8(json), { level: 9 });
  const binary = Array.from(compressed, (byte) => String.fromCharCode(byte)).join('');

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function v1EncodeSnapshotToSyncPayload(snapshot: ReturnType<typeof createSnapshot>) {
  const statusCodes = ['not-started', 'in-progress', 'debugged'] as const;
  const localeCodes = ['zh', 'en'] as const;
  const mistakeKeys = [...LISTENING_PARTS, ...READING_PARTS] as const;
  const reasonKeys = [...LISTENING_TAGS, ...READING_TAGS] as const;
  const lapKeys = READING_LAP_SEGMENTS.map((segment) => segment.key);
  const sessionIndex = new Map(createInitialSessions().map((session, index) => [session.id, index]));
  const toBase64Url = (bytes: Uint8Array) =>
    btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  const encodeNumberPairs = <T extends string>(source: Partial<Record<T, number>>, keys: readonly T[]) => {
    const pairs: number[] = [];

    keys.forEach((key, index) => {
      const value = source[key];
      if (typeof value === 'number' && value !== 0) {
        pairs.push(index, value);
      }
    });

    return pairs;
  };
  const encodeInstant = (value?: string) => {
    if (!value) {
      return '';
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? value : `~${timestamp.toString(36)}`;
  };
  const encodeDate = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return value;
    }

    const dayCount = Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
    return `~${dayCount.toString(36)}`;
  };
  const encodeScoreId = (value: string) => {
    const match = value.match(/^score-(\d+)$/);
    return match ? `~${Number(match[1]).toString(36)}` : value;
  };

  const payload = {
    f: 1,
    a: snapshot.app,
    v: snapshot.version,
    m: [snapshot.meta.exportedFromStorageVersion, snapshot.meta.minimumReaderVersion],
    t: encodeInstant(snapshot.exportedAt),
    d: {
      s: snapshot.data.sessions.flatMap((session) => {
        const index = sessionIndex.get(session.id);
        if (index === undefined) {
          return [];
        }

        const mistakes = encodeNumberPairs(session.mistakes, mistakeKeys);
        const reasons = session.reasons
          .map((reason) => reasonKeys.indexOf(reason as (typeof reasonKeys)[number]))
          .filter((reasonIndex) => reasonIndex >= 0);
        const lapTimes = encodeNumberPairs(session.readingLapTimes, lapKeys);

        if (
          session.status === 'not-started' &&
          mistakes.length === 0 &&
          reasons.length === 0 &&
          lapTimes.length === 0 &&
          !session.timerSummary &&
          !session.timerRuntime &&
          !session.updatedAt
        ) {
          return [];
        }

        return [[
          index,
          statusCodes.indexOf(session.status),
          mistakes.length > 0 ? mistakes : undefined,
          reasons.length > 0 ? reasons : undefined,
          lapTimes.length > 0 ? lapTimes : undefined,
          session.timerSummary
            ? [
                session.timerSummary.totalElapsedMs,
                (session.timerSummary.forcedSubmit ? 1 : 0) | (session.timerSummary.timedOut ? 2 : 0),
                session.timerSummary.unfinishedQuestions,
                encodeInstant(session.timerSummary.completedAt),
              ]
            : undefined,
          session.timerRuntime
            ? [
                encodeInstant(session.timerRuntime.startedAt),
                encodeInstant(session.timerRuntime.lapStartedAt),
                session.timerRuntime.currentLapIndex,
                encodeNumberPairs(session.timerRuntime.readingLapTimes, lapKeys),
                session.timerRuntime.pendingSubmit
                  ? (session.timerRuntime.pendingSubmit.forcedSubmit ? 1 : 0) | (session.timerRuntime.pendingSubmit.timedOut ? 2 : 0)
                  : 0,
                session.timerRuntime.unfinishedQuestionsDraft ?? '',
                session.timerRuntime.timeLeftMs ?? -1,
              ]
            : undefined,
          encodeInstant(session.updatedAt),
        ]];
      }),
      a: sessionIndex.get(snapshot.data.activeSessionId) ?? 0,
      l: localeCodes.indexOf(snapshot.data.locale),
      e: encodeDate(snapshot.data.examDate),
      h: snapshot.data.historicalScores.map((score) => [
        encodeDate(score.date),
        score.listening,
        score.reading,
        score.total,
        score.source === 'estimated' ? 1 : 0,
        encodeScoreId(score.id),
        score.note,
      ]),
    },
  };

  return toBase64Url(zlibSync(strToU8(JSON.stringify(payload)), { level: 9 }));
}

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
    } as unknown as Parameters<typeof createSnapshot>[0]);

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
    } as unknown as Parameters<typeof createSnapshot>[0]);

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

  it('optionally includes lightweight vocabulary metadata in sync payloads', () => {
    const sessions = createInitialSessions();
    const snapshot = createSnapshot({
      sessions,
      activeSessionId: 'L1',
      locale: 'zh',
      examDate: '2026-05-24',
      historicalScores: [],
      sprintConfig: { listeningCount: 10, readingCount: 10 },
      vocabularyEntries: [
        {
          id: 'v1',
          text: 'abandon',
          definition: '放弃',
          enDefinition: 'to leave behind',
          partOfSpeech: 'verb',
          exampleSentence: 'He abandoned the plan.',
          encounterCount: 2,
          sessionIds: ['L1'],
          tags: ['mock'],
          createdAt: '2026-03-11T00:00:00.000Z',
          updatedAt: '2026-03-11T00:00:00.000Z',
        },
        {
          id: 'v2',
          text: '  benchmark  ',
          encounterCount: 1,
          sessionIds: [],
          tags: [],
          createdAt: '2026-03-11T00:00:00.000Z',
          updatedAt: '2026-03-11T00:00:00.000Z',
        },
      ],
      targetScore: 850,
      unlockedAchievements: [],
    });

    const payloadWithoutVocabulary = encodeSnapshotToSyncPayload(snapshot);
    const payloadWithVocabulary = encodeSnapshotToSyncPayload(snapshot, { includeVocabulary: true });
    const decodedWithoutVocabulary = decodeSnapshotFromSyncPayload(payloadWithoutVocabulary);
    const decodedWithVocabulary = decodeSnapshotFromSyncPayload(payloadWithVocabulary);

    expect(decodedWithoutVocabulary.data.vocabularyEntries).toBeUndefined();
    expect(decodedWithVocabulary.data.vocabularyEntries).toEqual([
      {
        id: 'v1',
        text: 'abandon',
        encounterCount: 2,
        sessionIds: ['L1'],
        tags: ['mock'],
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: '2026-03-11T00:00:00.000Z',
      },
      {
        id: 'v2',
        text: 'benchmark',
        encounterCount: 1,
        sessionIds: [],
        tags: [],
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: '2026-03-11T00:00:00.000Z',
      },
    ]);
  });

  it('produces shorter payloads than the legacy full-json codec', () => {
    const sessions = createInitialSessions().map((session, index) => {
      if (session.id === 'L1') {
        return {
          ...session,
          status: 'debugged' as const,
          mistakes: { 'Part 2': 4, 'Part 3': 7 },
          reasons: ['词汇盲区', '预判超时'],
          updatedAt: '2026-03-11T08:15:00.000Z',
        };
      }

      if (session.id === 'R3') {
        return {
          ...session,
          status: 'in-progress' as const,
          mistakes: { 'Part 5': 5, 'Part 7 Multiple': 8 },
          reasons: ['跨表检索超时'],
          readingLapTimes: {
            'Part 5': 605000,
            'Part 6': 492000,
            'Part 7 Single': 1490000,
          },
          timerSummary: {
            totalElapsedMs: 4530000,
            forcedSubmit: true,
            timedOut: false,
            unfinishedQuestions: 6,
            resolvedUnfinished: false,
            completedAt: '2026-03-11T09:30:45.000Z',
          },
          timerRuntime: {
            startedAt: '2026-03-11T08:15:45.000Z',
            lapStartedAt: '2026-03-11T09:05:45.000Z',
            currentLapIndex: 2,
            readingLapTimes: {
              'Part 5': 605000,
              'Part 6': 492000,
            },
            pendingSubmit: {
              forcedSubmit: true,
              timedOut: false,
            },
            unfinishedQuestionsDraft: '6',
            timeLeftMs: 31000,
          },
          updatedAt: '2026-03-11T09:31:00.000Z',
        };
      }

      return index % 5 === 0
        ? {
            ...session,
            status: 'debugged' as const,
            updatedAt: `2026-03-${String(10 + index).padStart(2, '0')}T07:00:00.000Z`,
          }
        : session;
    });

    const snapshot = createSnapshot({
      sessions,
      activeSessionId: 'R3',
      locale: 'en',
      examDate: '2026-06-15',
      historicalScores: [
        {
          id: 'score-1741688100000',
          date: '2026-03-11',
          listening: 350,
          reading: 340,
          total: 690,
          source: 'manual',
          note: 'mock exam',
        },
        {
          id: 'score-1741774500000',
          date: '2026-03-12',
          listening: 365,
          reading: 355,
          total: 720,
          source: 'estimated',
          note: 'timed retry',
        },
      ],
    } as unknown as Parameters<typeof createSnapshot>[0]);

    const compactPayload = encodeSnapshotToSyncPayload(snapshot);
    const v1Payload = v1EncodeSnapshotToSyncPayload(snapshot);
    const legacyPayload = legacyEncodeSnapshotToSyncPayload(snapshot);

    expect(compactPayload.length).toBeLessThan(v1Payload.length);
    expect(compactPayload.length).toBeLessThan(legacyPayload.length);
    expect(decodeSnapshotFromSyncPayload(compactPayload)).toEqual(snapshot);
    expect(decodeSnapshotFromSyncPayload(v1Payload)).toEqual(snapshot);
  });
});