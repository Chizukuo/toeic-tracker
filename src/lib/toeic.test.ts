import { describe, expect, it } from 'vitest';

import {
  createInitialSessions,
  estimateCurrentLevel,
  estimateSectionLevel,
  estimateToeicCombinedScore,
  estimateToeicScaledScore,
  estimateToeicSessionScore,
  getAnalyticsDataConfidence,
  getCombinedDataConfidence,
  getSessionDataConfidence,
  getSessionPartLossMap,
  planCorrectAnswersForTarget,
  type SessionRecord,
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

  it('does not expose estimate availability for in-progress non-timeout sessions', () => {
    const listening = createInitialSessions().find((session) => session.id === 'L4');

    if (!listening) {
      throw new Error('Missing L4 session fixture');
    }

    listening.status = 'in-progress';
    listening.mistakes = {
      'Part 2': 6,
      'Part 3': 7,
    };

    const estimate = estimateToeicSessionScore(listening, 'strict');

    expect(estimate.available).toBe(false);
  });

  it('allows provisional estimate availability when an in-progress session timed out', () => {
    const reading = createInitialSessions().find((session) => session.id === 'R6');

    if (!reading) {
      throw new Error('Missing R6 session fixture');
    }

    reading.status = 'in-progress';
    reading.mistakes = {
      'Part 5': 4,
      'Part 6': 2,
      'Part 7 Single': 6,
    };
    reading.timerSummary = {
      totalElapsedMs: 75 * 60 * 1000,
      forcedSubmit: true,
      timedOut: true,
      unfinishedQuestions: 5,
      resolvedUnfinished: false,
      completedAt: '2026-03-11T13:00:00.000Z',
    };

    const estimate = estimateToeicSessionScore(reading, 'strict');

    expect(estimate.available).toBe(true);
  });
});
describe('score estimator', () => {
  const reviewed = (id: string, mistakes: SessionRecord['mistakes'], completedAt?: string) => {
    const session = createInitialSessions().find((item) => item.id === id);
    if (!session) throw new Error(`Missing fixture ${id}`);
    return {
      ...session,
      status: 'debugged' as const,
      mistakes,
      timerSummary: completedAt
        ? {
            totalElapsedMs: 0,
            forcedSubmit: false,
            timedOut: false,
            unfinishedQuestions: 0,
            resolvedUnfinished: true,
            completedAt,
          }
        : undefined,
    };
  };

  it('scores by number correct only: where the mistakes fall does not move the estimate', () => {
    const slipsOnEasyItems = estimateToeicSessionScore(reviewed('L1', { 'Part 1': 4, 'Part 2': 16 }));
    const missesOnHardItems = estimateToeicSessionScore(reviewed('L1', { 'Part 3': 10, 'Part 4': 10 }));

    expect(slipsOnEasyItems.scaled).toBe(missesOnHardItems.scaled);
    expect(slipsOnEasyItems.bias.anomalyDetected).toBe(true);
    expect(missesOnHardItems.bias.anomalyDetected).toBe(false);
    // An unusual pattern only widens the uncertainty.
    expect(slipsOnEasyItems.interval.max - slipsOnEasyItems.interval.min)
      .toBeGreaterThan(missesOnHardItems.interval.max - missesOnHardItems.interval.min);
  });

  it('credits a 1-in-4 blind guess for unanswered reading items in strict mode', () => {
    const base = reviewed('R1', { 'Part 5': 6 });
    const withBlanks = {
      ...base,
      timerSummary: {
        totalElapsedMs: 75 * 60 * 1000,
        forcedSubmit: true,
        timedOut: true,
        unfinishedQuestions: 8,
        resolvedUnfinished: false,
        completedAt: '2026-03-10T09:00:00.000Z',
      },
    };

    const strict = estimateToeicSessionScore(withBlanks, 'strict');
    expect(strict.rawCorrect).toBe(86);
    expect(strict.guessCredit).toBe(2);
    expect(strict.adjustedRawCorrect).toBe(88);
    expect(estimateToeicSessionScore(withBlanks, 'potential').guessCredit).toBe(0);
  });

  it('weights recent sets more and narrows the interval as consistent sets accumulate', () => {
    const one = estimateSectionLevel([reviewed('L1', { 'Part 3': 20 }, '2026-03-01T09:00:00.000Z')], 'L');
    const sessions = [
      reviewed('L1', { 'Part 3': 30 }, '2026-03-01T09:00:00.000Z'),
      reviewed('L2', { 'Part 3': 20 }, '2026-03-02T09:00:00.000Z'),
      reviewed('L3', { 'Part 3': 20 }, '2026-03-03T09:00:00.000Z'),
      reviewed('L4', { 'Part 3': 20 }, '2026-03-04T09:00:00.000Z'),
    ];
    const level = estimateSectionLevel(sessions, 'L');

    if (!one || !level) throw new Error('Expected a level estimate');
    expect(level.setsUsed).toBe(4);
    // The weak first set pulls the level down only a little.
    expect(level.scaled).toBeLessThan(one.scaled);
    expect(one.scaled - level.scaled).toBeLessThanOrEqual(15);
    expect(level.interval.max - level.interval.min).toBeLessThan(one.interval.max - one.interval.min);
    expect(level.trendPerSet).toBeGreaterThan(0);
  });

  it('needs both sections before reporting a total', () => {
    const listeningOnly = estimateCurrentLevel([reviewed('L1', { 'Part 2': 5 })]);
    expect(listeningOnly.listening?.scaled).toBeGreaterThan(0);
    expect(listeningOnly.total).toBeUndefined();

    const both = estimateCurrentLevel([reviewed('L1', { 'Part 2': 5 }), reviewed('R1', { 'Part 5': 5 })]);
    expect(both.total?.scaled).toBe((both.listening?.scaled ?? 0) + (both.reading?.scaled ?? 0));
  });

  it('plans the fewest extra correct answers to reach a target', () => {
    const current = estimateToeicScaledScore(70, 'L') + estimateToeicScaledScore(70, 'R');
    expect(planCorrectAnswersForTarget(70, 70, current)).toMatchObject({ total: 0, reachable: true });

    const plan = planCorrectAnswersForTarget(70, 70, current + 100);
    expect(plan.reachable).toBe(true);
    expect(estimateToeicScaledScore(70 + plan.listening, 'L') + estimateToeicScaledScore(70 + plan.reading, 'R'))
      .toBeGreaterThanOrEqual(current + 100);
    // One fewer answer must not be enough, otherwise the plan is not minimal.
    const shortBy = (l: number, r: number) =>
      estimateToeicScaledScore(70 + l, 'L') + estimateToeicScaledScore(70 + r, 'R') < current + 100;
    expect(plan.reading === 0 || shortBy(plan.listening, plan.reading - 1)).toBe(true);
    expect(plan.listening === 0 || shortBy(plan.listening - 1, plan.reading)).toBe(true);

    expect(planCorrectAnswersForTarget(99, 99, 995).reachable).toBe(false);
  });
});
