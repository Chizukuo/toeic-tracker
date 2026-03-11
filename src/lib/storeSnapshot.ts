import {
  type MistakeKey,
  type ReadingLapKey,
  type SessionRecord,
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

export const SNAPSHOT_APP = 'Cheese-TOEIC-Tracker';
export const SNAPSHOT_VERSION = 2;
export const STORAGE_VERSION = 6;
export const DEFAULT_EXAM_DATE = '2026-05-24';
export const EXAM_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type SnapshotMeta = {
  schema: 'cheese-toeic-snapshot';
  snapshotVersion: number;
  exportedFromStorageVersion: number;
  minimumReaderVersion: number;
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

export type ParsedImportSnapshot = {
  sessions: SessionRecord[];
  activeSessionId: string;
  locale: AppLocale;
  examDate: string;
  historicalScores: HistoricalScoreRecord[];
  result: ImportSnapshotResult;
};

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLocale(value: unknown): value is AppLocale {
  return value === 'zh' || value === 'en';
}

export function getPersistStorage() {
  if (typeof window === 'undefined') {
    return noopStorage;
  }

  return window.localStorage;
}

export function clampScore(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value / 5) * 5));
}

export function normalizeExamDate(value: unknown) {
  return typeof value === 'string' && EXAM_DATE_PATTERN.test(value) ? value : DEFAULT_EXAM_DATE;
}

export function normalizeHistoricalScores(incoming: unknown): HistoricalScoreRecord[] {
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

export function normalizeSessions(incoming: unknown): SessionRecord[] {
  const defaults = createInitialSessions();
  if (!Array.isArray(incoming)) {
    return defaults;
  }

  return defaults.map((session) => {
    const match = incoming.find(
      (item): item is Partial<SessionRecord> & Pick<SessionRecord, 'id'> =>
        typeof item === 'object' && item !== null && 'id' in item && item.id === session.id
    );

    return match ? mergeSessionWithDefaults(match) : session;
  });
}

export function migrateLegacyRecords(records: LegacyRecord[] | undefined) {
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
            resolvedUnfinished: true,
            completedAt: new Date().toISOString(),
          }
        : undefined,
    };
  }

  return sessions;
}

export function parseImportSnapshot(snapshot: unknown) {
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

export function createSnapshot(state: {
  sessions: SessionRecord[];
  activeSessionId: string;
  locale: AppLocale;
  examDate: string;
  historicalScores: HistoricalScoreRecord[];
}): SprintSnapshot {
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
}

export function migratePersistedState(
  persistedState: unknown,
  version: number
): {
  sessions: SessionRecord[];
  activeSessionId: string;
  locale: AppLocale;
  examDate: string;
  historicalScores: HistoricalScoreRecord[];
} {
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
      locale: 'zh',
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
}