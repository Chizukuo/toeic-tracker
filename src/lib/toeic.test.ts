import { describe, expect, it } from 'vitest';

import {
  createInitialSessions,
  estimateToeicCombinedScore,
  getAnalyticsDataConfidence,
  getCombinedDataConfidence,
  getSessionDataConfidence,
  getSessionPartLossMap,
} from '@/lib/toeic';

describe('toeic scoring rules', () => {
  it('respects manual unfinished distribution before fallback allocation', () => {
    const reading = createInitialSessions().find((session) => session.id === 'R1');

    if (!reading) {
      throw new Error('Missing R1 session fixture');
    }

    reading.status = 'debugged';
    reading.mistakes = {
      'Part 5': 2,
      'Part 6': 1,
    };
    reading.timerSummary = {
      totalElapsedMs: 75 * 60 * 1000,
      forcedSubmit: true,
      timedOut: true,
      unfinishedQuestions: 7,
      resolvedUnfinished: false,
      unfinishedByPart: {
        'Part 5': 2,
        'Part 7 Single': 5,
      },
      unfinishedByPartMeta: {
        source: 'manual',
        confidence: 1,
      },
      completedAt: '2026-03-11T09:00:00.000Z',
    };

    const lossMap = getSessionPartLossMap(reading);

    expect(lossMap['Part 5']).toBe(4);
    expect(lossMap['Part 6']).toBe(1);
    expect(lossMap['Part 7 Single']).toBe(5);
    expect(lossMap['Part 7 Multiple']).toBe(0);
  });

  it('allocates unfinished reading questions from the back of the paper first', () => {
    const reading = createInitialSessions().find((session) => session.id === 'R1');

    if (!reading) {
      throw new Error('Missing R1 session fixture');
    }

    reading.status = 'debugged';
    reading.mistakes = {
      'Part 5': 2,
      'Part 6': 1,
    };
    reading.timerSummary = {
      totalElapsedMs: 75 * 60 * 1000,
      forcedSubmit: true,
      timedOut: true,
      unfinishedQuestions: 7,
      resolvedUnfinished: false,
      completedAt: '2026-03-11T09:00:00.000Z',
    };

    const lossMap = getSessionPartLossMap(reading);

    expect(lossMap['Part 7 Multiple']).toBe(7);
    expect(lossMap['Part 7 Single']).toBe(0);
    expect(lossMap['Part 6']).toBe(1);
    expect(lossMap['Part 5']).toBe(2);
  });

  it('infers unfinished distribution to late reading sections when earlier laps were captured', () => {
    const reading = createInitialSessions().find((session) => session.id === 'R3');

    if (!reading) {
      throw new Error('Missing R3 session fixture');
    }

    reading.status = 'in-progress';
    reading.readingLapTimes = {
      'Part 5': 10 * 60 * 1000,
      'Part 6': 8 * 60 * 1000,
    };
    reading.timerRuntime = {
      startedAt: '2026-03-11T08:00:00.000Z',
      lapStartedAt: '2026-03-11T08:18:00.000Z',
      currentLapIndex: 2,
      readingLapTimes: reading.readingLapTimes,
    };
    reading.timerSummary = {
      totalElapsedMs: 75 * 60 * 1000,
      forcedSubmit: true,
      timedOut: true,
      unfinishedQuestions: 6,
      resolvedUnfinished: false,
      completedAt: '2026-03-11T09:15:00.000Z',
    };

    const lossMap = getSessionPartLossMap(reading);

    expect(lossMap['Part 5']).toBe(0);
    expect(lossMap['Part 6']).toBe(0);
    expect((lossMap['Part 7 Single'] ?? 0) + (lossMap['Part 7 Multiple'] ?? 0)).toBe(6);
  });

  it('downgrades confidence when a session is still running or lacks a timer-summary', () => {
    const listening = createInitialSessions().find((session) => session.id === 'L1');

    if (!listening) {
      throw new Error('Missing L1 session fixture');
    }

    listening.status = 'in-progress';
    listening.mistakes = {
      'Part 2': 4,
    };
    listening.timerRuntime = {
      startedAt: '2026-03-11T08:00:00.000Z',
      lapStartedAt: '2026-03-11T08:00:00.000Z',
      currentLapIndex: 0,
      readingLapTimes: {},
    };

    const confidence = getSessionDataConfidence(listening);

    expect(confidence.level).toBe('low');
    expect(confidence.issues).toContain('timer-running');
    expect(confidence.issues).toContain('missing-timer');
    expect(confidence.issues).toContain('missing-review');
  });

  it('combines paired estimates and keeps medium confidence when reading still has backlog', () => {
    const sessions = createInitialSessions();
    const listening = sessions.find((session) => session.id === 'L2');
    const reading = sessions.find((session) => session.id === 'R2');

    if (!listening || !reading) {
      throw new Error('Missing paired session fixtures');
    }

    listening.status = 'debugged';
    listening.mistakes = {
      'Part 2': 6,
      'Part 3': 8,
    };
    listening.timerSummary = {
      totalElapsedMs: 44 * 60 * 1000,
      forcedSubmit: false,
      timedOut: false,
      unfinishedQuestions: 0,
      resolvedUnfinished: true,
      completedAt: '2026-03-11T10:00:00.000Z',
    };

    reading.status = 'debugged';
    reading.mistakes = {
      'Part 5': 5,
      'Part 6': 3,
      'Part 7 Single': 4,
    };
    reading.timerSummary = {
      totalElapsedMs: 75 * 60 * 1000,
      forcedSubmit: true,
      timedOut: true,
      unfinishedQuestions: 3,
      resolvedUnfinished: false,
      completedAt: '2026-03-11T11:00:00.000Z',
    };

    const estimate = estimateToeicCombinedScore(listening, reading);
    const confidence = getCombinedDataConfidence(listening, reading);

    expect(estimate.available).toBe(true);
    expect(estimate.total).toBeGreaterThan(0);
    expect(confidence.level).toBe('medium');
    expect(confidence.issues).toContain('unfinished-backlog');
  });

  it('marks analytics as low confidence when the sample is sparse and still in progress', () => {
    const sessions = createInitialSessions();
    const listening = sessions.find((session) => session.id === 'L1');
    const reading = sessions.find((session) => session.id === 'R1');

    if (!listening || !reading) {
      throw new Error('Missing analytics fixtures');
    }

    listening.status = 'in-progress';
    listening.timerRuntime = {
      startedAt: '2026-03-11T07:30:00.000Z',
      lapStartedAt: '2026-03-11T07:30:00.000Z',
      currentLapIndex: 0,
      readingLapTimes: {},
    };

    reading.status = 'debugged';
    reading.timerSummary = {
      totalElapsedMs: 75 * 60 * 1000,
      forcedSubmit: true,
      timedOut: true,
      unfinishedQuestions: 5,
      resolvedUnfinished: false,
      completedAt: '2026-03-11T08:50:00.000Z',
    };

    const analyticsConfidence = getAnalyticsDataConfidence(sessions);

    expect(analyticsConfidence.level).toBe('low');
    expect(analyticsConfidence.recordedSessions).toBe(2);
    expect(analyticsConfidence.inProgressSessions).toBe(1);
    expect(analyticsConfidence.unfinishedSessions).toBe(1);
    expect(analyticsConfidence.issues).toContain('sparse-history');
    expect(analyticsConfidence.issues).toContain('missing-review');
  });

  it('separates strict and potential reading estimates after overtime review', () => {
    const reading = createInitialSessions().find((session) => session.id === 'R5');

    if (!reading) {
      throw new Error('Missing R5 session fixture');
    }

    reading.status = 'debugged';
    reading.mistakes = {
      'Part 5': 3,
      'Part 6': 2,
    };
    reading.overtimeMistakes = {
      'Part 7 Single': 2,
    };
    reading.timerSummary = {
      totalElapsedMs: 75 * 60 * 1000,
      forcedSubmit: true,
      timedOut: true,
      unfinishedQuestions: 6,
      resolvedUnfinished: true,
      overtimeElapsedMs: 12 * 60 * 1000,
      completedAt: '2026-03-11T12:00:00.000Z',
    };

    const strict = estimateToeicCombinedScore(undefined, reading, 'strict');
    const potential = estimateToeicCombinedScore(undefined, reading, 'potential');
    const confidence = getSessionDataConfidence(reading);

    expect(potential.reading?.rawCorrect).toBeGreaterThan(strict.reading?.rawCorrect ?? 0);
    expect(strict.reading?.unfinishedPenalty).toBe(6);
    expect(potential.reading?.unfinishedPenalty).toBe(0);
    expect(confidence.issues).not.toContain('unfinished-backlog');
  });
});