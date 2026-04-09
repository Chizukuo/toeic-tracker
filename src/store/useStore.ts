import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  type MistakeKey,
  type ReadingLapKey,
  type SessionRecord,
  type SessionStatus,
  type TimerRuntimeState,
  type TimerSummary,
  type VocabularyEntry,
  type SprintConfig,
  SPRINT_DEFAULT_CONFIG,
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
  normalizeVocabularyEntries,
  parseImportSnapshot,
  createAutoBackup,
} from '@/lib/storeSnapshot';
import { evaluateAchievements } from '@/lib/achievements';

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
    left.notes === right.notes &&
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
  sprintConfig: SprintConfig;
  vocabularyEntries: VocabularyEntry[];
  targetScore: number;
  unlockedAchievements: string[];
  justUnlocked: string[];

  // Core actions
  ensureInitialized: () => void;
  selectSession: (sessionId: string) => void;
  setLocale: (locale: AppLocale) => void;
  setExamDate: (examDate: string) => void;
  setTargetScore: (score: number) => void;

  // Sprint config
  setSprintConfig: (config: SprintConfig) => void;

  // Score history
  addHistoricalScore: (payload: {
    date: string;
    listening: number;
    reading: number;
    total?: number;
    source?: HistoricalScoreSource;
    note?: string;
  }) => void;
  removeHistoricalScore: (id: string) => void;

  dismissAchievement: (id: string) => void;

  // Session management
  patchSession: (sessionId: string, data: Partial<SessionRecord>) => void;
  saveDiagnostics: (
    sessionId: string,
    payload: {
      mistakes: Partial<Record<MistakeKey, number>>;
      reasons: string[];
      notes?: string;
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
  saveSessionNotes: (sessionId: string, notes: string) => void;

  // Vocabulary notebook
  addVocabularyEntry: (entry: Omit<VocabularyEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  removeVocabularyEntry: (id: string) => void;
  updateVocabularyEntry: (id: string, patch: Partial<VocabularyEntry>) => void;
  bumpVocabularyEncounter: (text: string, sessionId?: string) => string | null;
  recordVocabularyKnockdown: (id: string, sessionId?: string) => void;
  recordVocabularyComeback: (id: string, sessionId?: string) => void;

  // Data management
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
      sprintConfig: SPRINT_DEFAULT_CONFIG,
      vocabularyEntries: [],
      targetScore: 850,
      unlockedAchievements: [],
      justUnlocked: [],

      dismissAchievement: (id) => set((state) => ({ justUnlocked: state.justUnlocked.filter((i) => i !== id) })),

      ensureInitialized: () =>
        set((state) => {
          const sessions = normalizeSessions(state.sessions, state.sprintConfig);
          return {
            sessions,
            activeSessionId: sessions.some((session) => session.id === state.activeSessionId)
              ? state.activeSessionId
              : 'L1',
            examDate: state.examDate || DEFAULT_EXAM_DATE,
            historicalScores: normalizeHistoricalScores(state.historicalScores),
            vocabularyEntries: normalizeVocabularyEntries(state.vocabularyEntries),
            unlockedAchievements: Array.isArray(state.unlockedAchievements) ? state.unlockedAchievements : [],
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

      setTargetScore: (targetScore) => set({ targetScore }),

      setSprintConfig: (config) =>
        set((state) => {
          const newSessions = createInitialSessions(config);
          // Preserve existing session data by merging
          const mergedSessions = newSessions.map((newSession) => {
            const existing = state.sessions.find((s) => s.id === newSession.id);
            return existing ?? newSession;
          });
          const validActiveId = mergedSessions.some((s) => s.id === state.activeSessionId)
            ? state.activeSessionId
            : mergedSessions[0]?.id ?? 'L1';
          return { sprintConfig: config, sessions: mergedSessions, activeSessionId: validActiveId };
        }),

      addHistoricalScore: (payload) =>
        set((state) => {
          const listening = clampScore(payload.listening, 5, 495);
          const reading = clampScore(payload.reading, 5, 495);
          const total = payload.total !== undefined ? clampScore(payload.total, 10, 990) : clampScore(listening + reading, 10, 990);
          const source: HistoricalScoreSource = payload.source === 'estimated' ? 'estimated' : 'manual';
          const note = typeof payload.note === 'string' && payload.note.trim() ? payload.note.trim() : undefined;

          const nextHistoricalScores = [
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
          ].sort((a, b) => a.date.localeCompare(b.date));

          const nextState = { ...state, historicalScores: nextHistoricalScores };
          const newlyUnlocked = evaluateAchievements(nextState);

          return {
            historicalScores: nextHistoricalScores,
            unlockedAchievements: [...state.unlockedAchievements, ...newlyUnlocked],
            justUnlocked: [...state.justUnlocked, ...newlyUnlocked],
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

          if (!changed) return state;

          // Trigger auto-backup on meaningful session changes
          const currentState = get();
          if (typeof window !== 'undefined') {
            try {
              createAutoBackup(
                { ...currentState, sessions },
                window.localStorage
              );
            } catch {
              // best-effort
            }
          }

          return { sessions };
        }),

      saveDiagnostics: (sessionId, payload) =>
        set((state) => {
          const sessions = state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  mistakes: payload.mistakes,
                  reasons: payload.reasons,
                  notes: payload.notes ?? session.notes,
                  status: payload.status ?? 'debugged',
                  updatedAt: new Date().toISOString(),
                }
              : session
          );
          
          const nextState = { ...state, sessions };
          const newlyUnlocked = evaluateAchievements(nextState);

          return {
            sessions,
            unlockedAchievements: [...state.unlockedAchievements, ...newlyUnlocked],
            justUnlocked: [...state.justUnlocked, ...newlyUnlocked],
          };
        }),

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

      saveSessionNotes: (sessionId, notes) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, notes, updatedAt: new Date().toISOString() }
              : session
          ),
        })),

      // ── Vocabulary CRUD ──────────────────────────────────────────────────────

      addVocabularyEntry: (entry) =>
        set((state) => {
          const now = new Date().toISOString();
          const id = entry.id ?? `vocab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const newEntry: VocabularyEntry = {
            ...entry,
            id,
            encounterCount: entry.encounterCount ?? 1,
            sessionIds: entry.sessionIds ?? [],
            tags: entry.tags ?? [],
            createdAt: now,
            updatedAt: now,
          };
          return { vocabularyEntries: [...state.vocabularyEntries, newEntry] };
        }),

      removeVocabularyEntry: (id) =>
        set((state) => ({
          vocabularyEntries: state.vocabularyEntries.filter((e) => e.id !== id),
        })),

      updateVocabularyEntry: (id, patch) =>
        set((state) => ({
          vocabularyEntries: state.vocabularyEntries.map((e) =>
            e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e
          ),
        })),

      /**
       * If a vocabulary entry with the same text (case-insensitive) already exists,
       * increment its encounterCount and optionally tag it with a sessionId.
       * Returns the id of the entry bumped, or null if not found.
       */
      bumpVocabularyEncounter: (text, sessionId) => {
        const { vocabularyEntries } = get();
        const normalizedText = text.trim().toLowerCase();
        const existing = vocabularyEntries.find(
          (e) => e.text.toLowerCase() === normalizedText
        );
        if (!existing) return null;

        set((state) => ({
          vocabularyEntries: state.vocabularyEntries.map((e) =>
            e.id === existing.id
              ? {
                  ...e,
                  encounterCount: e.encounterCount + 1,
                  sessionIds: sessionId && !e.sessionIds.includes(sessionId)
                    ? [...e.sessionIds, sessionId]
                    : e.sessionIds,
                  updatedAt: new Date().toISOString(),
                }
              : e
          ),
        }));
        return existing.id;
      },

      recordVocabularyKnockdown: (id, sessionId) =>
        set((state) => ({
          vocabularyEntries: state.vocabularyEntries.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  encounterCount: entry.encounterCount + 1,
                  knockdownCount: (entry.knockdownCount ?? 0) + 1,
                  lastKnockdownAt: new Date().toISOString(),
                  sessionIds: sessionId && !entry.sessionIds.includes(sessionId)
                    ? [...entry.sessionIds, sessionId]
                    : entry.sessionIds,
                  updatedAt: new Date().toISOString(),
                }
              : entry
          ),
        })),

      recordVocabularyComeback: (id, sessionId) =>
        set((state) => ({
          vocabularyEntries: state.vocabularyEntries.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  comebackCount: (entry.comebackCount ?? 0) + 1,
                  lastComebackAt: new Date().toISOString(),
                  sessionIds: sessionId && !entry.sessionIds.includes(sessionId)
                    ? [...entry.sessionIds, sessionId]
                    : entry.sessionIds,
                  updatedAt: new Date().toISOString(),
                }
              : entry
          ),
        })),

      // ── Data management ──────────────────────────────────────────────────────

      exportSnapshot: () => {
        return createSnapshot(get());
      },

      importSnapshot: (snapshot) => {
        createAutoBackup(get(), getPersistStorage() as Storage);
        const next = parseImportSnapshot(snapshot, get());
        const importedAchievements =
          next.result.source === 'snapshot' || next.result.source === 'vocabulary-list'
            ? next.unlockedAchievements
            : get().unlockedAchievements;
        set({
          sessions: next.sessions,
          activeSessionId: next.activeSessionId,
          locale: next.locale,
          examDate: next.examDate,
          historicalScores: next.historicalScores,
          sprintConfig: next.sprintConfig,
          vocabularyEntries: next.vocabularyEntries,
          unlockedAchievements: importedAchievements,
        });
        return next.result;
      },

      resetProgress: () => {
        createAutoBackup(get(), getPersistStorage() as Storage);
        set((state) => ({
          sessions: createInitialSessions(state.sprintConfig),
          activeSessionId: 'L1',
          locale: state.locale,
          examDate: DEFAULT_EXAM_DATE,
          historicalScores: [],
          vocabularyEntries: [],
        }));
      },
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
        sprintConfig: state.sprintConfig,
        vocabularyEntries: state.vocabularyEntries,
        unlockedAchievements: state.unlockedAchievements,
      }),
      migrate: (persistedState: unknown, version) => {
        return migratePersistedState(persistedState, version);
      },
    }
  )
);

export type { SessionRecord, VocabularyEntry, SprintConfig } from '@/lib/toeic';
export type {
  HistoricalScoreRecord,
  HistoricalScoreSource,
  ImportSnapshotResult,
  SprintSnapshot,
} from '@/lib/storeSnapshot';
