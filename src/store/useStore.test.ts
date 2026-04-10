import { beforeEach, describe, expect, it } from 'vitest';

import { createInitialSessions } from '@/lib/toeic';
import { SNAPSHOT_APP, SNAPSHOT_VERSION, STORAGE_VERSION } from '@/lib/storeSnapshot';
import { useStore } from '@/store/useStore';

describe('useStore snapshot compatibility', () => {
  beforeEach(() => {
    const state = useStore.getState();

    state.resetProgress();
    state.setLocale('zh');
    state.setExamDate('2026-05-24');
  });

  it('exports a canonical snapshot with metadata and current state', () => {
    const state = useStore.getState();

    state.setLocale('en');
    state.setExamDate('2026-06-01');
    state.selectSession('R3');
    state.patchSession('L1', {
      status: 'debugged',
      mistakes: { 'Part 2': 5 },
    });
    state.addHistoricalScore({
      date: '2026-03-10',
      listening: 347,
      reading: 332,
      source: 'manual',
      note: 'mock',
    });

    const snapshot = useStore.getState().exportSnapshot();

    expect(snapshot.app).toBe(SNAPSHOT_APP);
    expect(snapshot.version).toBe(SNAPSHOT_VERSION);
    expect(snapshot.meta).toMatchObject({
      schema: 'cheese-toeic-snapshot',
      snapshotVersion: SNAPSHOT_VERSION,
      exportedFromStorageVersion: STORAGE_VERSION,
      minimumReaderVersion: 1,
    });
    expect(snapshot.data.locale).toBe('en');
    expect(snapshot.data.examDate).toBe('2026-06-01');
    expect(snapshot.data.activeSessionId).toBe('R3');
    expect(snapshot.data.sessions.find((session) => session.id === 'L1')?.mistakes['Part 2']).toBe(5);
    expect(snapshot.data.historicalScores).toHaveLength(1);
    expect(snapshot.data.historicalScores[0]).toMatchObject({
      listening: 345,
      reading: 330,
      total: 675,
      source: 'manual',
      note: 'mock',
    });
  });

  it('imports the canonical snapshot format without marking it as migrated', () => {
    const sessions = createInitialSessions();
    const l2 = sessions.find((session) => session.id === 'L2');

    if (!l2) {
      throw new Error('Missing L2 fixture');
    }

    l2.status = 'debugged';
    l2.mistakes = { 'Part 3': 7 };

    const result = useStore.getState().importSnapshot({
      app: SNAPSHOT_APP,
      version: SNAPSHOT_VERSION,
      meta: {
        schema: 'cheese-toeic-snapshot',
        snapshotVersion: SNAPSHOT_VERSION,
        exportedFromStorageVersion: STORAGE_VERSION,
        minimumReaderVersion: 1,
      },
      exportedAt: '2026-03-11T00:00:00.000Z',
      data: {
        sessions,
        activeSessionId: 'L2',
        locale: 'en',
        examDate: '2026-06-15',
        historicalScores: [
          {
            id: 'score-1',
            date: '2026-03-09',
            listening: 351,
            reading: 337,
            total: 688,
            source: 'estimated',
            note: 'pair estimate',
          },
        ],
      },
    });

    const nextState = useStore.getState();

    expect(result).toEqual({
      source: 'snapshot',
      importedVersion: SNAPSHOT_VERSION,
      migrated: false,
      futureVersion: false,
    });
    expect(nextState.activeSessionId).toBe('L2');
    expect(nextState.locale).toBe('en');
    expect(nextState.examDate).toBe('2026-06-15');
    expect(nextState.sessions.find((session) => session.id === 'L2')?.mistakes['Part 3']).toBe(7);
    expect(nextState.historicalScores[0]).toMatchObject({
      listening: 350,
      reading: 335,
      total: 690,
      source: 'estimated',
      note: 'pair estimate',
    });
  });

  it('imports persisted-state payloads in compatibility mode and flags future versions', () => {
    const sessions = createInitialSessions();
    const r4 = sessions.find((session) => session.id === 'R4');

    if (!r4) {
      throw new Error('Missing R4 fixture');
    }

    r4.status = 'in-progress';
    r4.timerSummary = {
      totalElapsedMs: 75 * 60 * 1000,
      forcedSubmit: true,
      timedOut: true,
      unfinishedQuestions: 4,
      resolvedUnfinished: false,
      completedAt: '2026-03-11T12:00:00.000Z',
    };

    const result = useStore.getState().importSnapshot({
      version: 9,
      state: {
        sessions,
        activeSessionId: 'R4',
        locale: 'zh',
        examDate: 'invalid-date',
        historicalScores: [],
      },
    });

    const nextState = useStore.getState();

    expect(result).toEqual({
      source: 'persisted-state',
      importedVersion: 9,
      migrated: true,
      futureVersion: true,
    });
    expect(nextState.activeSessionId).toBe('R4');
    expect(nextState.examDate).toBe('2026-05-24');
    expect(nextState.sessions.find((session) => session.id === 'R4')?.timerSummary?.unfinishedQuestions).toBe(4);
  });

  it('migrates legacy records into modern sessions and preserves compatible fields', () => {
    const result = useStore.getState().importSnapshot({
      records: [
        {
          day: 2,
          type: 'R',
          status: 'completed',
          totalTimeMs: 4_200_000,
          laps: [
            { part: 'Part 5 (10m)', timeSpentMs: 620_000 },
            { part: 'Part 7 Multiple (32m)', timeSpentMs: 1_920_000 },
          ],
          mistakes: { 'Part 5': 3, 'Part 7 Multiple': 6 },
          reasons: ['长难句解析卡顿'],
        },
      ],
      activeSessionId: 'R2',
      locale: 'en',
      examDate: '2026-07-20',
      historicalScores: [
        {
          id: 'legacy-score',
          date: '2026-03-01',
          listening: 360,
          reading: 340,
          total: 700,
          source: 'manual',
        },
      ],
    });

    const nextState = useStore.getState();
    const migratedSession = nextState.sessions.find((session) => session.id === 'R2');

    expect(result).toEqual({
      source: 'legacy-records',
      importedVersion: 'legacy',
      migrated: true,
      futureVersion: false,
    });
    expect(nextState.activeSessionId).toBe('R2');
    expect(nextState.locale).toBe('en');
    expect(nextState.examDate).toBe('2026-07-20');
    expect(migratedSession).toMatchObject({
      status: 'debugged',
      mistakes: { 'Part 5': 3, 'Part 7 Multiple': 6 },
      reasons: ['长难句解析卡顿'],
      readingLapTimes: {
        'Part 5': 620_000,
        'Part 7 Multiple': 1_920_000,
      },
    });
    expect(migratedSession?.timerSummary?.totalElapsedMs).toBe(4_200_000);
    expect(nextState.historicalScores).toHaveLength(1);
    expect(nextState.historicalScores[0].total).toBe(700);
  });

  it('skips no-op session patches so timer draft sync cannot loop on unchanged state', () => {
    const before = useStore.getState().sessions.find((session) => session.id === 'R1');

    if (!before) {
      throw new Error('Missing R1 fixture');
    }

    useStore.getState().patchSession('R1', {
      status: 'in-progress',
      timerRuntime: {
        startedAt: '2026-03-13T10:00:00.000Z',
        currentLapIndex: 0,
        readingLapTimes: {},
        pendingSubmit: {
          forcedSubmit: true,
          timedOut: true,
        },
        unfinishedQuestionsDraft: '6',
        timeLeftMs: 0,
      },
    });

    const patched = useStore.getState().sessions.find((session) => session.id === 'R1');

    if (!patched) {
      throw new Error('Missing patched R1 fixture');
    }

    const firstUpdatedAt = patched.updatedAt;

    useStore.getState().patchSession('R1', {
      status: 'in-progress',
      timerRuntime: {
        startedAt: '2026-03-13T10:00:00.000Z',
        currentLapIndex: 0,
        readingLapTimes: {},
        pendingSubmit: {
          forcedSubmit: true,
          timedOut: true,
        },
        unfinishedQuestionsDraft: '6',
        timeLeftMs: 0,
      },
    });

    const afterNoOp = useStore.getState().sessions.find((session) => session.id === 'R1');

    expect(afterNoOp).toBe(patched);
    expect(afterNoOp?.updatedAt).toBe(firstUpdatedAt);
  });

  it('recovers vocabulary session provenance from existing entries when AI import lacks sessionIds', () => {
    const state = useStore.getState();

    state.addVocabularyEntry({
      text: 'take off',
      definition: 'to leave the ground',
      sessionIds: ['R3'],
      encounterCount: 2,
      tags: [],
    });

    const result = state.importSnapshot([
      {
        text: 'take off',
        definition: 'to remove clothing',
      },
    ]);

    const imported = useStore
      .getState()
      .vocabularyEntries
      .find((entry) => entry.text.toLowerCase() === 'take off');

    expect(result.source).toBe('vocabulary-list');
    expect(imported).toBeDefined();
    expect(imported?.sessionIds).toEqual(['R3']);
  });

  it('falls back to active session provenance when AI import has no matching vocabulary', () => {
    const state = useStore.getState();
    state.selectSession('R6');

    state.importSnapshot([
      {
        text: 'call it a day',
        definition: 'to stop working on something',
      },
    ]);

    const imported = useStore
      .getState()
      .vocabularyEntries
      .find((entry) => entry.text.toLowerCase() === 'call it a day');

    expect(imported).toBeDefined();
    expect(imported?.sessionIds).toEqual(['R6']);
  });
});
