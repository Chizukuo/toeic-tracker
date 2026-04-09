import {
  type MistakeKey,
  type ReadingLapKey,
  type SessionRecord,
  type VocabularyEntry,
  type SprintConfig,
  SPRINT_DEFAULT_CONFIG,
  createInitialSessions,
  mergeSessionWithDefaults,
  buildSprintBlueprints,
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
export const SNAPSHOT_VERSION = 3;
export const STORAGE_VERSION = 7;
export const DEFAULT_EXAM_DATE = '2026-05-24';
export const EXAM_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const AUTO_BACKUP_KEY_PREFIX = 'cheese-toeic-backup-';
export const AUTO_BACKUP_MAX = 3;;

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
    sprintConfig?: SprintConfig;
    vocabularyEntries?: VocabularyEntry[];
    targetScore?: number;
    unlockedAchievements?: string[];
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
    sprintConfig?: unknown;
    vocabularyEntries?: unknown;
  };
  state?: {
    sessions?: unknown;
    activeSessionId?: string;
    locale?: AppLocale;
    examDate?: string;
    historicalScores?: unknown;
    records?: LegacyRecord[];
    sprintConfig?: unknown;
    vocabularyEntries?: unknown;
  };
  sessions?: unknown;
  activeSessionId?: string;
  locale?: AppLocale;
  examDate?: string;
  historicalScores?: unknown;
  records?: LegacyRecord[];
  sprintConfig?: unknown;
  vocabularyEntries?: unknown;
};

export type ParsedImportSnapshot = {
  sessions: SessionRecord[];
  activeSessionId: string;
  locale: AppLocale;
  examDate: string;
  historicalScores: HistoricalScoreRecord[];
  sprintConfig: SprintConfig;
  vocabularyEntries: VocabularyEntry[];
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

export function normalizeSessions(incoming: unknown, config?: SprintConfig): SessionRecord[] {
  const defaults = createInitialSessions(config);
  if (!Array.isArray(incoming)) {
    return defaults;
  }

  const defaultMap = new Map(defaults.map((s) => [s.id, s]));

  // Merge known sessions from defaults, then append any extra sessions from incoming that fit the id pattern
  const merged = defaults.map((session) => {
    const match = incoming.find(
      (item): item is Partial<SessionRecord> & Pick<SessionRecord, 'id'> =>
        typeof item === 'object' && item !== null && 'id' in item && item.id === session.id
    );
    return match ? mergeSessionWithDefaults(match) : session;
  });

  // Append sessions from incoming that aren't in defaults (i.e., from larger sprint configs)
  for (const item of incoming) {
    if (typeof item !== 'object' || item === null || !('id' in item)) continue;
    const id = (item as { id: unknown }).id;
    if (typeof id !== 'string') continue;
    if (defaultMap.has(id) || merged.some((s) => s.id === id)) continue;
    // Only accept well-formed session ids: L{n} or R{n}
    if (!/^[LR]\d+$/.test(id)) continue;
    try {
      merged.push(mergeSessionWithDefaults(item as Partial<SessionRecord> & Pick<SessionRecord, 'id'>));
    } catch {
      // skip unknown ids
    }
  }

  return merged;
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
      sprintConfig: SPRINT_DEFAULT_CONFIG,
      vocabularyEntries: [],
      result: {
        source: 'legacy-records' as const,
        importedVersion: typeof snapshotVersion === 'number' ? snapshotVersion : 'legacy',
        migrated: true,
        futureVersion,
      },
    } satisfies ParsedImportSnapshot;
  }

  if (!Array.isArray(source.sessions)) {
    throw new Error('Snapshot does not contain session data');
  }

  const sessions = normalizeSessions(source.sessions, normalizeSprintConfig(source.sprintConfig));
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
    sprintConfig: normalizeSprintConfig(source.sprintConfig),
    vocabularyEntries: normalizeVocabularyEntries(source.vocabularyEntries),
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
  sprintConfig: SprintConfig;
  vocabularyEntries: VocabularyEntry[];
  targetScore: number;
  unlockedAchievements: string[];
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
      sprintConfig: state.sprintConfig,
      vocabularyEntries: state.vocabularyEntries,
      targetScore: state.targetScore,
      unlockedAchievements: state.unlockedAchievements,
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
  sprintConfig: SprintConfig;
  vocabularyEntries: VocabularyEntry[];
  targetScore: number;
  unlockedAchievements: string[];
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
    sprintConfig?: unknown;
    vocabularyEntries?: unknown;
    targetScore?: unknown;
    unlockedAchievements?: unknown;
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
      sprintConfig: SPRINT_DEFAULT_CONFIG,
      vocabularyEntries: [],
      targetScore: 850,
      unlockedAchievements: [],
    };
  }

  const sprintConfig = normalizeSprintConfig(persisted?.sprintConfig);

  return {
    sessions: normalizeSessions(persisted?.sessions, sprintConfig),
    activeSessionId: persisted?.activeSessionId ?? 'L1',
    locale: persisted?.locale ?? 'zh',
    examDate: persisted?.examDate ?? DEFAULT_EXAM_DATE,
    historicalScores: normalizeHistoricalScores(persisted?.historicalScores),
    sprintConfig,
    vocabularyEntries: normalizeVocabularyEntries(persisted?.vocabularyEntries),
    targetScore: typeof persisted?.targetScore === 'number' ? clampScore(persisted.targetScore, 10, 990) : 850,
    unlockedAchievements: Array.isArray(persisted?.unlockedAchievements) ? persisted.unlockedAchievements.filter((a): a is string => typeof a === 'string') : [],
  };
}

// ─── New Normalizers ──────────────────────────────────────────────────────────

export function normalizeSprintConfig(incoming: unknown): SprintConfig {
  if (typeof incoming !== 'object' || incoming === null) return SPRINT_DEFAULT_CONFIG;
  const raw = incoming as Record<string, unknown>;
  const listeningCount = Number(raw.listeningCount);
  const readingCount = Number(raw.readingCount);
  if (!Number.isFinite(listeningCount) || listeningCount < 1 || listeningCount > 30) return SPRINT_DEFAULT_CONFIG;
  if (!Number.isFinite(readingCount) || readingCount < 1 || readingCount > 30) return SPRINT_DEFAULT_CONFIG;
  return { listeningCount: Math.floor(listeningCount), readingCount: Math.floor(readingCount) };
}

export function normalizeVocabularyEntries(incoming: unknown): VocabularyEntry[] {
  if (!Array.isArray(incoming)) return [];
  return incoming
    .filter((item): item is Partial<VocabularyEntry> => typeof item === 'object' && item !== null)
    .map((item, idx) => {
      const definition = typeof item.definition === 'string' && item.definition.trim() ? item.definition.trim() : undefined;
      const rawEnDefinition = typeof item.enDefinition === 'string' ? item.enDefinition.trim() : '';
      const enDefinition = rawEnDefinition && !['-', '--', '—', 'n/a', 'na'].includes(rawEnDefinition.toLowerCase())
        ? rawEnDefinition
        : undefined;

      return {
        id: typeof item.id === 'string' && item.id ? item.id : `vocab-${idx}-${Date.now()}`,
        text: typeof item.text === 'string' && item.text.trim() ? item.text.trim() : '',
        reading: typeof item.reading === 'string' ? item.reading : undefined,
        definition,
        enDefinition,
        partOfSpeech: typeof item.partOfSpeech === 'string' ? item.partOfSpeech : undefined,
        exampleSentence: typeof item.exampleSentence === 'string' ? item.exampleSentence : undefined,
        sessionIds: Array.isArray(item.sessionIds) ? item.sessionIds.filter((s): s is string => typeof s === 'string') : [],
        encounterCount: typeof item.encounterCount === 'number' && item.encounterCount >= 1 ? item.encounterCount : 1,
        tags: Array.isArray(item.tags) ? item.tags.filter((t): t is string => typeof t === 'string') : [],
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
      };
    })
    .filter((e) => e.text.length > 0);
}

// ─── SnapshotLike extension ─────────────────────────────────────────────────────────
// (extend SnapshotLike type to include new fields for parsing)
declare module '@/lib/storeSnapshot' {
  interface SnapshotLikeExtension {
    sprintConfig?: unknown;
    vocabularyEntries?: unknown;
  }
}

// ─── Auto-Backup Utilities ──────────────────────────────────────────────────────────

export type AutoBackupEntry = {
  key: string;
  exportedAt: string;
  sessionCount: number;
  debuggedCount: number;
};

export function createAutoBackup(
  state: Parameters<typeof createSnapshot>[0],
  storage: Storage
): void {
  const snapshot = createSnapshot(state);
  const key = `${AUTO_BACKUP_KEY_PREFIX}${Date.now()}`;
  try {
    storage.setItem(key, JSON.stringify(snapshot));
    // Prune old backups
    const allKeys = Object.keys(storage)
      .filter((k) => k.startsWith(AUTO_BACKUP_KEY_PREFIX))
      .sort();
    while (allKeys.length > AUTO_BACKUP_MAX) {
      const oldest = allKeys.shift()!;
      storage.removeItem(oldest);
    }
  } catch {
    // Ignore quota errors — backup is best-effort
  }
}

export function getAutoBackups(storage: Storage): AutoBackupEntry[] {
  return Object.keys(storage)
    .filter((k) => k.startsWith(AUTO_BACKUP_KEY_PREFIX))
    .sort()
    .reverse()
    .map((key) => {
      try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        const snap = JSON.parse(raw) as SprintSnapshot;
        return {
          key,
          exportedAt: snap.exportedAt,
          sessionCount: snap.data.sessions.length,
          debuggedCount: snap.data.sessions.filter((s) => s.status === 'debugged').length,
        } satisfies AutoBackupEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is AutoBackupEntry => e !== null);
}

// ─── Snapshot Diff ─────────────────────────────────────────────────────────────────────

export type SnapshotDiff = {
  sessionsWillChange: number;   // how many sessions have different status/mistakes
  sessionsAdded: number;        // sessions in incoming but not in current
  scoreHistoryDelta: number;    // historicalScores count change
  examDateChanges: boolean;
  vocabEntriesDelta: number;
};

export function diffSnapshots(
  current: { sessions: SessionRecord[]; historicalScores: HistoricalScoreRecord[]; examDate: string; vocabularyEntries: VocabularyEntry[] },
  incoming: SprintSnapshot
): SnapshotDiff {
  const incomingSessions = incoming.data.sessions ?? [];
  const incomingScores = incoming.data.historicalScores ?? [];
  const incomingVocab = incoming.data.vocabularyEntries ?? [];

  let sessionsWillChange = 0;
  let sessionsAdded = 0;

  for (const inc of incomingSessions) {
    const cur = current.sessions.find((s) => s.id === inc.id);
    if (!cur) {
      sessionsAdded++;
    } else if (cur.status !== inc.status || JSON.stringify(cur.mistakes) !== JSON.stringify(inc.mistakes)) {
      sessionsWillChange++;
    }
  }

  return {
    sessionsWillChange,
    sessionsAdded,
    scoreHistoryDelta: incomingScores.length - current.historicalScores.length,
    examDateChanges: incoming.data.examDate !== current.examDate,
    vocabEntriesDelta: incomingVocab.length - current.vocabularyEntries.length,
  };
}