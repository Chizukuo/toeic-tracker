import { describe, expect, it } from 'vitest';

import { getNextStepRecommendation } from '@/lib/nextStep';
import { createInitialSessions } from '@/lib/toeic';

describe('next step recommendation engine', () => {
  it('prioritizes unresolved reading backlog over any other action', () => {
    const sessions = createInitialSessions();
    const active = sessions.find((session) => session.id === 'L1');
    const backlog = sessions.find((session) => session.id === 'R3');

    if (!active || !backlog) {
      throw new Error('Missing fixture sessions');
    }

    active.status = 'in-progress';
    backlog.status = 'debugged';
    backlog.timerSummary = {
      totalElapsedMs: 75 * 60 * 1000,
      forcedSubmit: true,
      timedOut: true,
      unfinishedQuestions: 6,
      resolvedUnfinished: false,
      completedAt: '2026-03-11T09:00:00.000Z',
    };

    const recommendation = getNextStepRecommendation({
      locale: 'zh',
      sessions,
      activeSessionId: 'L1',
      historicalScoreCount: 0,
    });

    expect(recommendation.kind).toBe('resolve-backlog');
    expect(recommendation.targetSessionId).toBe('R3');
    expect(recommendation.href).toBe('/unfinished');
  });

  it('resumes the active session when it is still in progress and no backlog exists', () => {
    const sessions = createInitialSessions();
    const active = sessions.find((session) => session.id === 'L2');

    if (!active) {
      throw new Error('Missing active fixture session');
    }

    active.status = 'in-progress';

    const recommendation = getNextStepRecommendation({
      locale: 'en',
      sessions,
      activeSessionId: 'L2',
      historicalScoreCount: 1,
    });

    expect(recommendation.kind).toBe('resume-active');
    expect(recommendation.targetSessionId).toBe('L2');
    expect(recommendation.href).toBe('/timer');
  });

  it('switches to the next unfinished session that matches the weakest side', () => {
    const sessions = createInitialSessions();
    const active = sessions.find((session) => session.id === 'L1');
    const completedReading = sessions.find((session) => session.id === 'R1');
    const targetReading = sessions.find((session) => session.id === 'R2');

    if (!active || !completedReading || !targetReading) {
      throw new Error('Missing weakness-plan fixtures');
    }

    active.status = 'debugged';
    completedReading.status = 'debugged';
    completedReading.mistakes = {
      'Part 7 Multiple': 10,
    };

    const recommendation = getNextStepRecommendation({
      locale: 'zh',
      sessions,
      activeSessionId: 'L1',
      historicalScoreCount: 2,
    });

    expect(recommendation.kind).toBe('reinforce-weakness');
    expect(recommendation.targetSessionId).toBe('R2');
    expect(recommendation.href).toBe('/timer');
  });

  it('keeps weakness reinforcement on listening sessions for listening hotspots', () => {
    const sessions = createInitialSessions();
    const active = sessions.find((session) => session.id === 'R1');
    const completedListening = sessions.find((session) => session.id === 'L1');
    const targetListening = sessions.find((session) => session.id === 'L2');

    if (!active || !completedListening || !targetListening) {
      throw new Error('Missing listening weakness fixtures');
    }

    active.status = 'debugged';
    completedListening.status = 'debugged';
    completedListening.mistakes = {
      'Part 2': 12,
    };

    const recommendation = getNextStepRecommendation({
      locale: 'en',
      sessions,
      activeSessionId: 'R1',
      historicalScoreCount: 2,
    });

    expect(recommendation.kind).toBe('reinforce-weakness');
    expect(recommendation.targetSessionId).toBe('L2');
    expect(recommendation.href).toBe('/timer');
  });

  it('asks for a score record when the workflow is clean but no history exists', () => {
    const sessions = createInitialSessions();
    for (const session of sessions) {
      session.status = 'debugged';
    }

    const recommendation = getNextStepRecommendation({
      locale: 'en',
      sessions,
      activeSessionId: 'L1',
      historicalScoreCount: 0,
    });

    expect(recommendation.kind).toBe('record-score');
    expect(recommendation.href).toBe('/scores');
  });
});