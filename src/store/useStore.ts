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

const SNAPSHOT_APP = 'Cheese-TOEIC-Tracker';
const SNAPSHOT_VERSION = 2;
const STORAGE_VERSION = 6;

type SnapshotMeta = {
  schema: 'cheese-toeic-snapshot';
  snapshotVersion: number;
  exportedFromStorageVersion: number;
  minimumReaderVersion: number;
};

export type SprintSnapshot = {
  app: typeof SNAPSHOT_APP;
  version: number;
  meta: SnapshotMeta;
  exportedAt: string;
  data: {
    sessions: SessionRecord[];
    activeSessionId: string;
    locale: AppLocale;
    examDate: string;
    historicalScores: HistoricalScoreRecord[];
  };
};

export type ImportSnapshotResult = {
  source: 'snapshot' | 'state' | 'persisted-state' | 'legacy-records';
  importedVersion: number | 'legacy';
  migrated: boolean;
  futureVersion: boolean;
};

export type HistoricalScoreSource = 'manual' | 'estimated';

export type HistoricalScoreRecord = {
  id: string;
  date: string;
  listening: number;
  reading: number;
  total: number;
  source: HistoricalScoreSource;
  note?: string;
};

type SnapshotLike = {
  app?: string;
  version?: number;
  meta?: Partial<SnapshotMeta>;
  data?: {
    sessions?: unknown;
    activeSessionId?: string;
    locale?: AppLocale;
    examDate?: string;
    historicalScores?: unknown;
    records?: LegacyRecord[];
  };
  state?: {
    sessions?: unknown;
    activeSessionId?: string;
    locale?: AppLocale;
    examDate?: string;
    historicalScores?: unknown;
    records?: LegacyRecord[];
  };
  sessions?: unknown;
  activeSessionId?: string;
  locale?: AppLocale;
  examDate?: string;
  historicalScores?: unknown;
  records?: LegacyRecord[];
};

type ParsedImportSnapshot = {
  sessions: SessionRecord[];
  activeSessionId: string;
  locale: AppLocale;
  examDate: string;
  historicalScores: HistoricalScoreRecord[];
  result: ImportSnapshotResult;
};

const DEFAULT_EXAM_DATE = '2026-05-24';
const EXAM_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  exportSnapshot: () => SprintSnapshot;
  importSnapshot: (snapshot: unknown) => ImportSnapshotResult;
  resetProgress: () => void;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLocale(value: unknown): value is AppLocale {
  return value === 'zh' || value === 'en';
}

function normalizeHistoricalScores(incoming: unknown): HistoricalScoreRecord[] {
  if (!Array.isArray(incoming)) {
    return [];
  }

  return incoming
    .filter((item): item is Partial<HistoricalScoreRecord> => typeof item === 'object' && item !== null)
    .map((item, index) => {
      const listening = typeof item.listening === 'number' ? clampScore(item.listening, 5, 495) : 5;
      const reading = typeof item.reading === 'number' ? clampScore(item.reading, 5, 495) : 5;
      const total = typeof item.total === 'number' ? clampScore(item.total, 10, 990) : clampScore(listening + reading, 10, 990);
      const source: HistoricalScoreSource = item.source === 'estimated' ? 'estimated' : 'manual';
      const note = typeof item.note === 'string' && item.note.trim() ? item.note.trim() : undefined;

      return {
        id: typeof item.id === 'string' && item.id ? item.id : `score-${index}-${Date.now()}`,
        date: typeof item.date === 'string' && EXAM_DATE_PATTERN.test(item.date) ? item.date : DEFAULT_EXAM_DATE,
        listening,
        reading,
        total,
        source,
        note,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function clampScore(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value / 5) * 5));
}

function normalizeExamDate(value: unknown) {
  return typeof value === 'string' && EXAM_DATE_PATTERN.test(value) ? value : DEFAULT_EXAM_DATE;
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
  if (!isObjectRecord(snapshot)) {
    throw new Error('Invalid snapshot payload');
  }

  const candidate = snapshot as SnapshotLike;
  const source = isObjectRecord(candidate.data)
    ? candidate.data
    : isObjectRecord(candidate.state)
      ? candidate.state
      : candidate;
  const snapshotVersion =
    typeof candidate.version === 'number'
      ? candidate.version
      : typeof candidate.meta?.snapshotVersion === 'number'
        ? candidate.meta.snapshotVersion
        : undefined;
  const futureVersion = typeof snapshotVersion === 'number' && snapshotVersion > SNAPSHOT_VERSION;

  if (Array.isArray(source.records) || Array.isArray(candidate.records)) {
    const sessions = migrateLegacyRecords((source.records ?? candidate.records) as LegacyRecord[]);
    const activeSessionId =
      typeof source.activeSessionId === 'string' && sessions.some((session) => session.id === source.activeSessionId)
        ? source.activeSessionId
        : 'L1';

    return {
      sessions,
      activeSessionId,
      locale: isLocale(source.locale) ? source.locale : 'zh',
      examDate: normalizeExamDate(source.examDate),
      historicalScores: normalizeHistoricalScores(source.historicalScores),
      result: {
        source: 'legacy-records',
        importedVersion: typeof snapshotVersion === 'number' ? snapshotVersion : 'legacy',
        migrated: true,
        futureVersion,
      },
    } satisfies ParsedImportSnapshot;
  }

  if (!Array.isArray(source.sessions)) {
    throw new Error('Snapshot does not contain session data');
  }

  const sessions = normalizeSessions(source.sessions);

  const activeSessionId =
    typeof source.activeSessionId === 'string' && sessions.some((session) => session.id === source.activeSessionId)
      ? source.activeSessionId
      : 'L1';

  return {
    sessions,
    activeSessionId,
    locale: isLocale(source.locale) ? source.locale : 'zh',
    examDate: normalizeExamDate(source.examDate),
    historicalScores: normalizeHistoricalScores(source.historicalScores),
    result: {
      source: isObjectRecord(candidate.data) ? 'snapshot' : isObjectRecord(candidate.state) ? 'persisted-state' : 'state',
      importedVersion: typeof snapshotVersion === 'number' ? snapshotVersion : 'legacy',
      migrated:
        Boolean(isObjectRecord(candidate.state)) ||
        !isObjectRecord(candidate.data) ||
        !candidate.meta ||
        (typeof snapshotVersion === 'number' && snapshotVersion < SNAPSHOT_VERSION),
      futureVersion,
    },
  } satisfies ParsedImportSnapshot;
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
          app: SNAPSHOT_APP,
          version: SNAPSHOT_VERSION,
          meta: {
            schema: 'cheese-toeic-snapshot',
            snapshotVersion: SNAPSHOT_VERSION,
            exportedFromStorageVersion: STORAGE_VERSION,
            minimumReaderVersion: 1,
          },
          exportedAt: new Date().toISOString(),
          data: {
            sessions: state.sessions,
            activeSessionId: state.activeSessionId,
            locale: state.locale,
            examDate: state.examDate,
            historicalScores: state.historicalScores,
          },
        };
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
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        locale: state.locale,
        examDate: state.examDate,
        historicalScores: state.historicalScores,
      }),
      migrate: (persistedState: unknown, version) => {
        const persisted = persistedState as {
          sessions?: unknown;
          activeSessionId?: string;
          locale?: AppLocale;
          examDate?: string;
          historicalScores?: unknown;
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
            examDate: DEFAULT_EXAM_DATE,
            historicalScores: [],
          };
        }

        return {
          sessions: normalizeSessions(persisted?.sessions),
          activeSessionId: persisted?.activeSessionId ?? 'L1',
          locale: persisted?.locale ?? 'zh',
          examDate: persisted?.examDate ?? DEFAULT_EXAM_DATE,
          historicalScores: normalizeHistoricalScores(persisted?.historicalScores),
        };
      },
    }
  )
);

export type { SessionRecord } from '@/lib/toeic';
