import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  type MistakeKey,
  type ReadingLapKey,
  type SessionRecord,
  type SessionStatus,
  type TimerRuntimeState,
  type TimerSummary,
  createInitialSessions,
} from '@/lib/toeic';
import type { Locale as AppLocale } from '@/lib/i18n';
import {
  EXAM_DATE_PATTERN,
  STORAGE_VERSION,
  type HistoricalScoreRecord,
  type HistoricalScoreSource,
  type ImportSnapshotResult,
  type SprintSnapshot,
  DEFAULT_EXAM_DATE,
  clampScore,
  createSnapshot,
  getPersistStorage,
  migratePersistedState,
  normalizeHistoricalScores,
  normalizeSessions,
  parseImportSnapshot,
} from '@/lib/storeSnapshot';

const storage = createJSONStorage(getPersistStorage);

function sameStringArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameNumberRecord<T extends string>(
  left: Partial<Record<T, number>> | undefined,
  right: Partial<Record<T, number>> | undefined
) {
  if (left === right) {
    return true;
  }

  const leftKeys = Object.keys(left ?? {});
  const rightKeys = Object.keys(right ?? {});

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left?.[key as T] === right?.[key as T]);
}

function samePendingSubmit(
  left: TimerRuntimeState['pendingSubmit'],
  right: TimerRuntimeState['pendingSubmit']
) {
  return left?.forcedSubmit === right?.forcedSubmit && left?.timedOut === right?.timedOut;
}

function sameTimerSummary(left: TimerSummary | undefined, right: TimerSummary | undefined) {
  if (left === right) {
    return true;
  }

  return (
    left?.totalElapsedMs === right?.totalElapsedMs &&
    left?.forcedSubmit === right?.forcedSubmit &&
    left?.timedOut === right?.timedOut &&
    left?.unfinishedQuestions === right?.unfinishedQuestions &&
    left?.resolvedUnfinished === right?.resolvedUnfinished &&
    left?.overtimeElapsedMs === right?.overtimeElapsedMs &&
    left?.completedAt === right?.completedAt
  );
}

function sameTimerRuntime(left: TimerRuntimeState | undefined, right: TimerRuntimeState | undefined) {
  if (left === right) {
    return true;
  }

  return (
    left?.startedAt === right?.startedAt &&
    left?.lapStartedAt === right?.lapStartedAt &&
    left?.currentLapIndex === right?.currentLapIndex &&
    sameNumberRecord<ReadingLapKey>(left?.readingLapTimes, right?.readingLapTimes) &&
    left?.isOvertime === right?.isOvertime &&
    left?.overtimeStartedAt === right?.overtimeStartedAt &&
    left?.overtimeElapsedMs === right?.overtimeElapsedMs &&
    samePendingSubmit(left?.pendingSubmit, right?.pendingSubmit) &&
    left?.unfinishedQuestionsDraft === right?.unfinishedQuestionsDraft &&
    left?.timeLeftMs === right?.timeLeftMs
  );
}

function sameSessionRecord(left: SessionRecord, right: SessionRecord) {
  return (
    left.id === right.id &&
    left.sprintDay === right.sprintDay &&
    left.type === right.type &&
    left.setNumber === right.setNumber &&
    left.label === right.label &&
    left.title === right.title &&
    left.targetMinutes === right.targetMinutes &&
    left.status === right.status &&
    sameNumberRecord<MistakeKey>(left.mistakes, right.mistakes) &&
    sameNumberRecord<MistakeKey>(left.overtimeMistakes, right.overtimeMistakes) &&
    sameStringArray(left.reasons, right.reasons) &&
    sameNumberRecord<ReadingLapKey>(left.readingLapTimes, right.readingLapTimes) &&
    sameTimerSummary(left.timerSummary, right.timerSummary) &&
    sameTimerRuntime(left.timerRuntime, right.timerRuntime)
  );
}

interface AppState {
  sessions: SessionRecord[];
  activeSessionId: string;
  locale: AppLocale;
  examDate: string;
  historicalScores: HistoricalScoreRecord[];
  ensureInitialized: () => void;
  selectSession: (sessionId: string) => void;
  setLocale: (locale: AppLocale) => void;
  setExamDate: (examDate: string) => void;
  addHistoricalScore: (payload: {
    date: string;
    listening: number;
    reading: number;
    total?: number;
    source?: HistoricalScoreSource;
    note?: string;
  }) => void;
  removeHistoricalScore: (id: string) => void;
  patchSession: (sessionId: string, data: Partial<SessionRecord>) => void;
  saveDiagnostics: (
    sessionId: string,
    payload: {
      mistakes: Partial<Record<MistakeKey, number>>;
      reasons: string[];
      status?: SessionStatus;
    }
  ) => void;
  saveOvertimeDiagnostics: (
    sessionId: string,
    payload: {
      overtimeMistakes: Partial<Record<MistakeKey, number>>;
      resolvedUnfinished: boolean;
      overtimeElapsedMs?: number;
      status?: SessionStatus;
    }
  ) => void;
  exportSnapshot: () => SprintSnapshot;
  importSnapshot: (snapshot: unknown) => ImportSnapshotResult;
  resetProgress: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      sessions: createInitialSessions(),
      activeSessionId: 'L1',
      locale: 'zh',
      examDate: DEFAULT_EXAM_DATE,
      historicalScores: [],
      ensureInitialized: () =>
        set((state) => {
          const sessions = normalizeSessions(state.sessions);
          return {
            sessions,
            activeSessionId: sessions.some((session) => session.id === state.activeSessionId)
              ? state.activeSessionId
              : 'L1',
            examDate: state.examDate || DEFAULT_EXAM_DATE,
            historicalScores: normalizeHistoricalScores(state.historicalScores),
          };
        }),
      selectSession: (sessionId) =>
        set((state) => ({
          activeSessionId: state.sessions.some((session) => session.id === sessionId) ? sessionId : state.activeSessionId,
        })),
      setLocale: (locale) => set({ locale }),
      setExamDate: (examDate) =>
        set((state) => ({
          examDate: EXAM_DATE_PATTERN.test(examDate) ? examDate : state.examDate,
        })),
      addHistoricalScore: (payload) =>
        set((state) => {
          const listening = clampScore(payload.listening, 5, 495);
          const reading = clampScore(payload.reading, 5, 495);
          const total = payload.total !== undefined ? clampScore(payload.total, 10, 990) : clampScore(listening + reading, 10, 990);
          const source: HistoricalScoreSource = payload.source === 'estimated' ? 'estimated' : 'manual';
          const note = typeof payload.note === 'string' && payload.note.trim() ? payload.note.trim() : undefined;

          return {
            historicalScores: [
              ...state.historicalScores,
              {
                id: `score-${Date.now()}`,
                date: EXAM_DATE_PATTERN.test(payload.date) ? payload.date : DEFAULT_EXAM_DATE,
                listening,
                reading,
                total,
                source,
                note,
              },
            ].sort((a, b) => a.date.localeCompare(b.date)),
          };
        }),
      removeHistoricalScore: (id) =>
        set((state) => ({
          historicalScores: state.historicalScores.filter((item) => item.id !== id),
        })),
      patchSession: (sessionId, data) =>
        set((state) => {
          let changed = false;

          const sessions = state.sessions.map((session) => {
            if (session.id !== sessionId) {
              return session;
            }

            const nextSession: SessionRecord = {
              ...session,
              ...data,
              mistakes: data.mistakes ?? session.mistakes,
              overtimeMistakes: data.overtimeMistakes ?? session.overtimeMistakes,
              reasons: data.reasons ?? session.reasons,
              readingLapTimes: data.readingLapTimes ?? session.readingLapTimes,
              timerSummary: data.timerSummary
                ? {
                    ...session.timerSummary,
                    ...data.timerSummary,
                  }
                : session.timerSummary,
            };

            if (sameSessionRecord(session, nextSession)) {
              return session;
            }

            changed = true;
            return {
              ...nextSession,
              updatedAt: new Date().toISOString(),
            };
          });

          return changed ? { sessions } : state;
        }),
      saveDiagnostics: (sessionId, payload) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  mistakes: payload.mistakes,
                  reasons: payload.reasons,
                  status: payload.status ?? 'debugged',
                  updatedAt: new Date().toISOString(),
                }
              : session
          ),
        })),
      saveOvertimeDiagnostics: (sessionId, payload) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  overtimeMistakes: payload.overtimeMistakes,
                  status: payload.status ?? 'debugged',
                  timerSummary: session.timerSummary
                    ? {
                        ...session.timerSummary,
                        resolvedUnfinished: payload.resolvedUnfinished,
                        overtimeElapsedMs:
                          payload.overtimeElapsedMs ?? session.timerSummary.overtimeElapsedMs,
                      }
                    : session.timerSummary,
                  timerRuntime: undefined,
                  updatedAt: new Date().toISOString(),
                }
              : session
          ),
        })),
      exportSnapshot: () => {
        return createSnapshot(get());
      },
      importSnapshot: (snapshot) => {
        const next = parseImportSnapshot(snapshot);
        set({
          sessions: next.sessions,
          activeSessionId: next.activeSessionId,
          locale: next.locale,
          examDate: next.examDate,
          historicalScores: next.historicalScores,
        });
        return next.result;
      },
      resetProgress: () =>
        set((state) => ({
          sessions: createInitialSessions(),
          activeSessionId: 'L1',
          locale: state.locale,
          examDate: DEFAULT_EXAM_DATE,
          historicalScores: [],
        })),
    }),
    {
      name: 'cheese-toeic-storage',
      version: STORAGE_VERSION,
      storage,
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        locale: state.locale,
        examDate: state.examDate,
        historicalScores: state.historicalScores,
      }),
      migrate: (persistedState: unknown, version) => {
        return migratePersistedState(persistedState, version);
      },
    }
  )
);

export type { SessionRecord } from '@/lib/toeic';
export type {
  HistoricalScoreRecord,
  HistoricalScoreSource,
  ImportSnapshotResult,
  SprintSnapshot,
} from '@/lib/storeSnapshot';
