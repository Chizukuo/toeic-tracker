import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  type MistakeKey,
  type ReadingLapKey,
  type SessionRecord,
  type SessionStatus,
  createInitialSessions,
  mergeSessionWithDefaults,
} from '@/lib/toeic';
import type { Locale as AppLocale } from '@/lib/i18n';

type LegacyRecord = {
  day?: number;
  type?: 'L' | 'R';
  status?: 'todo' | 'ongoing' | 'completed';
  totalTimeMs?: number;
  laps?: Array<{ part?: string; timeSpentMs?: number }>;
  mistakes?: Partial<Record<MistakeKey, number>>;
  reasons?: string[];
};

export type SprintSnapshot = {
  app: 'Cheese-TOEIC-Tracker';
  version: 1;
  exportedAt: string;
  data: {
    sessions: SessionRecord[];
    activeSessionId: string;
    locale: AppLocale;
  };
};

type SnapshotLike = {
  data?: {
    sessions?: unknown;
    activeSessionId?: string;
    locale?: AppLocale;
  };
  sessions?: unknown;
  activeSessionId?: string;
  locale?: AppLocale;
};

interface AppState {
  sessions: SessionRecord[];
  activeSessionId: string;
  locale: AppLocale;
  ensureInitialized: () => void;
  selectSession: (sessionId: string) => void;
  setLocale: (locale: AppLocale) => void;
  patchSession: (sessionId: string, data: Partial<SessionRecord>) => void;
  saveDiagnostics: (
    sessionId: string,
    payload: {
      mistakes: Partial<Record<MistakeKey, number>>;
      reasons: string[];
      status?: SessionStatus;
    }
  ) => void;
  exportSnapshot: () => SprintSnapshot;
  importSnapshot: (snapshot: unknown) => void;
  resetProgress: () => void;
}

function isLocale(value: unknown): value is AppLocale {
  return value === 'zh' || value === 'en';
}

function normalizeSessions(incoming: unknown): SessionRecord[] {
  const defaults = createInitialSessions();
  if (!Array.isArray(incoming)) {
    return defaults;
  }

  const merged = defaults.map((session) => {
    const match = incoming.find(
      (item): item is Partial<SessionRecord> & Pick<SessionRecord, 'id'> =>
        typeof item === 'object' && item !== null && 'id' in item && item.id === session.id
    );

    return match ? mergeSessionWithDefaults(match) : session;
  });

  return merged;
}

function migrateLegacyRecords(records: LegacyRecord[] | undefined) {
  const sessions = createInitialSessions();
  if (!Array.isArray(records)) {
    return sessions;
  }

  for (const record of records) {
    if (!record.day || !record.type || record.day > 10) {
      continue;
    }

    const sessionId = `${record.type}${record.day}`;
    const index = sessions.findIndex((session) => session.id === sessionId);
    if (index === -1) {
      continue;
    }

    const readingLapTimes: Partial<Record<ReadingLapKey, number>> = {};
    for (const lap of record.laps ?? []) {
      if (
        lap.part === 'Part 5 (10m)' ||
        lap.part === 'Part 6 (8m)' ||
        lap.part === 'Part 7 Single (25m)' ||
        lap.part === 'Part 7 Multiple (32m)'
      ) {
        const normalizedKey = lap.part.replace(/ \(.+\)/, '') as ReadingLapKey;
        readingLapTimes[normalizedKey] = lap.timeSpentMs ?? 0;
      }
    }

    sessions[index] = {
      ...sessions[index],
      status:
        record.status === 'completed'
          ? 'debugged'
          : record.status === 'ongoing'
            ? 'in-progress'
            : 'not-started',
      mistakes: record.mistakes ?? {},
      reasons: record.reasons ?? [],
      readingLapTimes,
      timerSummary: record.totalTimeMs
        ? {
            totalElapsedMs: record.totalTimeMs,
            forcedSubmit: false,
            timedOut: false,
            unfinishedQuestions: 0,
            completedAt: new Date().toISOString(),
          }
        : undefined,
    };
  }

  return sessions;
}

function parseImportSnapshot(snapshot: unknown) {
  if (typeof snapshot !== 'object' || snapshot === null) {
    throw new Error('Invalid snapshot payload');
  }

  const candidate = snapshot as SnapshotLike;
  const source = candidate.data ?? candidate;
  const sessions = normalizeSessions(source.sessions);

  if (!Array.isArray(source.sessions)) {
    throw new Error('Snapshot does not contain session data');
  }

  const activeSessionId =
    typeof source.activeSessionId === 'string' && sessions.some((session) => session.id === source.activeSessionId)
      ? source.activeSessionId
      : 'L1';

  return {
    sessions,
    activeSessionId,
    locale: isLocale(source.locale) ? source.locale : 'zh',
  };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      sessions: createInitialSessions(),
      activeSessionId: 'L1',
      locale: 'zh',
      ensureInitialized: () =>
        set((state) => ({
          sessions: normalizeSessions(state.sessions),
          activeSessionId:
            state.sessions.some((session) => session.id === state.activeSessionId)
              ? state.activeSessionId
              : 'L1',
        })),
      selectSession: (sessionId) => set({ activeSessionId: sessionId }),
      setLocale: (locale) => set({ locale }),
      patchSession: (sessionId, data) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  ...data,
                  mistakes: data.mistakes ?? session.mistakes,
                  reasons: data.reasons ?? session.reasons,
                  readingLapTimes: data.readingLapTimes ?? session.readingLapTimes,
                  updatedAt: new Date().toISOString(),
                }
              : session
          ),
        })),
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
      exportSnapshot: () => {
        const state = get();

        return {
          app: 'Cheese-TOEIC-Tracker',
          version: 1,
          exportedAt: new Date().toISOString(),
          data: {
            sessions: state.sessions,
            activeSessionId: state.activeSessionId,
            locale: state.locale,
          },
        };
      },
      importSnapshot: (snapshot) => {
        const next = parseImportSnapshot(snapshot);
        set(next);
      },
      resetProgress: () =>
        set((state) => ({
          sessions: createInitialSessions(),
          activeSessionId: 'L1',
          locale: state.locale,
        })),
    }),
    {
      name: 'cheese-toeic-storage',
      version: 3,
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        locale: state.locale,
      }),
      migrate: (persistedState: unknown, version) => {
        const persisted = persistedState as {
          sessions?: unknown;
          activeSessionId?: string;
          locale?: AppLocale;
          records?: LegacyRecord[];
          activeDay?: number;
          activeType?: 'L' | 'R';
        };

        if (version < 2 && persisted?.records) {
          const activeSessionId =
            persisted.activeDay && persisted.activeType && persisted.activeDay <= 10
              ? `${persisted.activeType}${persisted.activeDay}`
              : 'L1';

          return {
            sessions: migrateLegacyRecords(persisted.records),
            activeSessionId,
            locale: 'zh' as AppLocale,
          };
        }

        return {
          sessions: normalizeSessions(persisted?.sessions),
          activeSessionId: persisted?.activeSessionId ?? 'L1',
          locale: persisted?.locale ?? 'zh',
        };
      },
    }
  )
);

export type { SessionRecord } from '@/lib/toeic';
