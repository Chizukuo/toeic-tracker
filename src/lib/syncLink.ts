import { deflateSync, inflateSync, strFromU8, strToU8, unzlibSync } from 'fflate';

import {
  SNAPSHOT_APP,
  SNAPSHOT_VERSION,
  STORAGE_VERSION,
  type HistoricalScoreRecord,
  type SprintSnapshot,
} from '@/lib/storeSnapshot';
import {
  LISTENING_PARTS,
  LISTENING_TAGS,
  READING_LAP_SEGMENTS,
  READING_PARTS,
  READING_TAGS,
  type VocabularyEntry,
  createInitialSessions,
} from '@/lib/toeic';

export const SYNC_HASH_PREFIX = 'sync=v1.';
export const MAX_SYNC_URL_LENGTH = 3200;

const LEGACY_SYNC_COMPACT_FORMAT_VERSION = 1;
const SYNC_COMPACT_FORMAT_VERSION = 4;
const PREVIOUS_SYNC_COMPACT_FORMAT_VERSION = 3;
const OLDER_SYNC_COMPACT_FORMAT_VERSION = 2;
const SESSION_DEFAULTS = createInitialSessions();
const SESSION_INDEX = new Map(SESSION_DEFAULTS.map((session, index) => [session.id, index]));
const STATUS_CODES = ['not-started', 'in-progress', 'debugged'] as const;
const LOCALE_CODES = ['zh', 'en'] as const;
const MISTAKE_KEYS = [...LISTENING_PARTS, ...READING_PARTS] as const;
const REASON_KEYS = [...LISTENING_TAGS, ...READING_TAGS] as const;
const LAP_KEYS = READING_LAP_SEGMENTS.map((segment) => segment.key);

const SESSION_FLAG_STATUS = 1;
const SESSION_FLAG_MISTAKES = 2;
const SESSION_FLAG_REASONS = 4;
const SESSION_FLAG_LAP_TIMES = 8;
const SESSION_FLAG_TIMER_SUMMARY = 16;
const SESSION_FLAG_TIMER_RUNTIME = 32;
const SESSION_FLAG_UPDATED_AT = 64;
const SESSION_FLAG_OVERTIME_MISTAKES = 128;

const TIMER_RUNTIME_FLAG_LAP_STARTED_AT = 1;
const TIMER_RUNTIME_FLAG_LAP_TIMES = 2;
const TIMER_RUNTIME_FLAG_PENDING_SUBMIT = 4;
const TIMER_RUNTIME_FLAG_UNFINISHED_DRAFT = 8;
const TIMER_RUNTIME_FLAG_TIME_LEFT = 16;
const TIMER_RUNTIME_FLAG_IS_OVERTIME = 32;
const TIMER_RUNTIME_FLAG_OVERTIME_STARTED_AT = 64;
const TIMER_RUNTIME_FLAG_OVERTIME_ELAPSED = 128;

const METADATA_FLAG_OVERRIDE = 1;
const DEFAULT_MINIMUM_READER_VERSION = 1;

type StatusCode = 0 | 1 | 2;
type LocaleCode = 0 | 1;

type CompactTimerSummary = [number, number, number, string, number?, number?];
type CompactTimerRuntime = [string, number, number, ...(string | number | number[])[]];
type CompactSessionDelta = [number, number, ...(number | number[] | CompactTimerSummary | CompactTimerRuntime | string)[]];
type CompactHistoricalScore = [string, number, number, number, number, string, string?];
type LegacyCompactVocabularyEntry = [
  string,
  string,
  number,
  string,
  string,
  string?,
  string?,
  string?,
  string?,
  string?,
  string[]?,
  string[]?
];
type CompactVocabularyEntry = [
  string,
  string,
  number,
  string,
  string,
  string[]?,
  string[]?
];

type LegacyCompactSyncSnapshot = {
  f: typeof LEGACY_SYNC_COMPACT_FORMAT_VERSION;
  a: string;
  v: number;
  m: [number, number];
  t: string;
  d: {
    s: CompactSessionDelta[];
    a: number;
    l: LocaleCode;
    e: string;
    h: CompactHistoricalScore[];
  };
};

type CompactSyncSnapshot = [
  number,
  string,
  [CompactSessionDelta[], number, LocaleCode, string, CompactHistoricalScore[], (string[] | CompactVocabularyEntry[] | LegacyCompactVocabularyEntry[])?],
  [number, string, number, number, number]?
];

export type SyncPreview = {
  app: string;
  version: number;
  exportedAt: string;
  sessionCount: number;
  historyCount: number;
  vocabularyCount: number;
  activeSessionId: string;
  locale: 'zh' | 'en';
};

export type SyncPayloadOptions = {
  includeVocabulary?: boolean;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toDayCount(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
}

function encodeNumericToken(value: number, anchor?: number) {
  const absolute = `~${value.toString(36)}`;

  if (anchor === undefined) {
    return absolute;
  }

  const relative = `.${(value - anchor).toString(36)}`;
  return relative.length < absolute.length ? relative : absolute;
}

function decodeNumericToken(value: string, anchor?: number) {
  if (value.startsWith('.')) {
    const delta = Number.parseInt(value.slice(1), 36);
    return anchor === undefined || Number.isNaN(delta) ? null : anchor + delta;
  }

  if (!value.startsWith('~')) {
    return null;
  }

  const absolute = Number.parseInt(value.slice(1), 36);
  return Number.isNaN(absolute) ? null : absolute;
}

function encodeDate(value: string, anchor?: string) {
  const dayCount = toDayCount(value);

  if (dayCount === null) {
    return value;
  }

  const anchorDayCount = anchor ? toDayCount(anchor) ?? undefined : undefined;
  return encodeNumericToken(dayCount, anchorDayCount);
}

function decodeDate(value: string, anchor?: string) {
  const anchorDayCount = anchor ? toDayCount(anchor) ?? undefined : undefined;
  const dayCount = decodeNumericToken(value, anchorDayCount);

  if (dayCount === null) {
    return value;
  }

  return new Date(dayCount * 86400000).toISOString().slice(0, 10);
}

function encodeInstant(value?: string, anchor?: string) {
  if (!value) {
    return '';
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  const anchorTimestamp = anchor ? Date.parse(anchor) : Number.NaN;
  return encodeNumericToken(timestamp, Number.isNaN(anchorTimestamp) ? undefined : anchorTimestamp);
}

function decodeInstant(value?: string, anchor?: string) {
  if (!value) {
    return undefined;
  }

  const anchorTimestamp = anchor ? Date.parse(anchor) : Number.NaN;
  const timestamp = decodeNumericToken(value, Number.isNaN(anchorTimestamp) ? undefined : anchorTimestamp);

  if (timestamp === null) {
    return value;
  }

  return new Date(timestamp).toISOString();
}

function encodeScoreId(value: string, anchor?: string) {
  const match = value.match(/^score-(\d+)$/);

  if (!match) {
    return value;
  }

  const numericId = Number(match[1]);
  const anchorTimestamp = anchor ? Date.parse(anchor) : Number.NaN;

  return encodeNumericToken(numericId, Number.isNaN(anchorTimestamp) ? undefined : anchorTimestamp);
}

function decodeScoreId(value: string, anchor?: string) {
  const anchorTimestamp = anchor ? Date.parse(anchor) : Number.NaN;
  const numericId = decodeNumericToken(value, Number.isNaN(anchorTimestamp) ? undefined : anchorTimestamp);

  if (numericId === null) {
    return value;
  }

  return `score-${numericId}`;
}

function isLegacyCompactSyncSnapshot(value: unknown): value is LegacyCompactSyncSnapshot {
  return isObjectRecord(value) && value.f === LEGACY_SYNC_COMPACT_FORMAT_VERSION && isObjectRecord(value.d);
}

function isCompactSyncSnapshot(value: unknown): value is CompactSyncSnapshot {
  if (!Array.isArray(value) || !Array.isArray(value[2])) {
    return false;
  }

  return (
    value[0] === OLDER_SYNC_COMPACT_FORMAT_VERSION ||
    value[0] === PREVIOUS_SYNC_COMPACT_FORMAT_VERSION ||
    value[0] === SYNC_COMPACT_FORMAT_VERSION
  );
}

function encodeNumberPairs<T extends string>(
  source: Partial<Record<T, number>>,
  keys: readonly T[]
) {
  const pairs: number[] = [];

  keys.forEach((key, index) => {
    const value = source[key];

    if (typeof value === 'number' && value !== 0) {
      pairs.push(index, value);
    }
  });

  return pairs;
}

function decodeNumberPairs<T extends string>(pairs: number[] | undefined, keys: readonly T[]) {
  const record: Partial<Record<T, number>> = {};

  if (!pairs) {
    return record;
  }

  for (let index = 0; index < pairs.length; index += 2) {
    const key = keys[pairs[index]];
    const value = pairs[index + 1];

    if (key !== undefined && typeof value === 'number') {
      record[key] = value;
    }
  }

  return record;
}

function encodeReasons(reasons: string[]) {
  return reasons
    .map((reason) => REASON_KEYS.indexOf(reason as (typeof REASON_KEYS)[number]))
    .filter((index) => index >= 0);
}

function decodeReasons(indexes: number[] | undefined) {
  if (!indexes) {
    return [];
  }

  return indexes
    .map((index) => REASON_KEYS[index])
    .filter((reason): reason is (typeof REASON_KEYS)[number] => reason !== undefined);
}

function encodeTimerSummary(snapshot: SprintSnapshot['data']['sessions'][number]['timerSummary'], anchor: string) {
  if (!snapshot) {
    return undefined;
  }

  return [
    snapshot.totalElapsedMs,
    (snapshot.forcedSubmit ? 1 : 0) |
      (snapshot.timedOut ? 2 : 0) |
      (snapshot.resolvedUnfinished ? 4 : 0),
    snapshot.unfinishedQuestions,
    encodeInstant(snapshot.completedAt, anchor),
    snapshot.overtimeElapsedMs,
  ] satisfies CompactTimerSummary;
}

function decodeTimerSummary(summary: CompactTimerSummary | undefined, anchor: string) {
  if (!summary) {
    return undefined;
  }

  return {
    totalElapsedMs: summary[0],
    forcedSubmit: Boolean(summary[1] & 1),
    timedOut: Boolean(summary[1] & 2),
    unfinishedQuestions: summary[2],
    resolvedUnfinished: Boolean(summary[1] & 4),
    completedAt: decodeInstant(summary[3], anchor) ?? new Date(0).toISOString(),
    ...(typeof summary[4] === 'number' ? { overtimeElapsedMs: summary[4] } : {}),
  };
}

function encodeTimerRuntime(snapshot: SprintSnapshot['data']['sessions'][number]['timerRuntime'], anchor: string) {
  if (!snapshot) {
    return undefined;
  }

  let flags = 0;
  const payload: Array<string | number | number[]> = [
    encodeInstant(snapshot.startedAt, anchor),
    snapshot.currentLapIndex,
  ];

  if (snapshot.lapStartedAt) {
    flags |= TIMER_RUNTIME_FLAG_LAP_STARTED_AT;
    payload.push(encodeInstant(snapshot.lapStartedAt, anchor));
  }

  const lapTimes = encodeNumberPairs(snapshot.readingLapTimes, LAP_KEYS);
  if (lapTimes.length > 0) {
    flags |= TIMER_RUNTIME_FLAG_LAP_TIMES;
    payload.push(lapTimes);
  }

  if (snapshot.pendingSubmit) {
    flags |= TIMER_RUNTIME_FLAG_PENDING_SUBMIT;
    payload.push((snapshot.pendingSubmit.forcedSubmit ? 1 : 0) | (snapshot.pendingSubmit.timedOut ? 2 : 0));
  }

  if (snapshot.unfinishedQuestionsDraft) {
    flags |= TIMER_RUNTIME_FLAG_UNFINISHED_DRAFT;
    payload.push(snapshot.unfinishedQuestionsDraft);
  }

  if (snapshot.timeLeftMs !== undefined) {
    flags |= TIMER_RUNTIME_FLAG_TIME_LEFT;
    payload.push(snapshot.timeLeftMs);
  }

  if (snapshot.isOvertime) {
    flags |= TIMER_RUNTIME_FLAG_IS_OVERTIME;
  }

  if (snapshot.overtimeStartedAt) {
    flags |= TIMER_RUNTIME_FLAG_OVERTIME_STARTED_AT;
    payload.push(encodeInstant(snapshot.overtimeStartedAt, anchor));
  }

  if (snapshot.overtimeElapsedMs !== undefined) {
    flags |= TIMER_RUNTIME_FLAG_OVERTIME_ELAPSED;
    payload.push(snapshot.overtimeElapsedMs);
  }

  return [payload[0] as string, payload[1] as number, flags, ...payload.slice(2)] satisfies CompactTimerRuntime;
}

function decodeTimerRuntime(runtime: CompactTimerRuntime | undefined, anchor: string) {
  if (!runtime) {
    return undefined;
  }

  let cursor = 3;
  const flags = runtime[2] ?? 0;
  const nextString = () => {
    const value = runtime[cursor];
    cursor += 1;
    return typeof value === 'string' ? value : '';
  };
  const nextNumber = () => {
    const value = runtime[cursor];
    cursor += 1;
    return typeof value === 'number' ? value : 0;
  };
  const nextNumberArray = () => {
    const value = runtime[cursor];
    cursor += 1;
    return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : [];
  };

  const decoded: NonNullable<SprintSnapshot['data']['sessions'][number]['timerRuntime']> = {
    startedAt: decodeInstant(runtime[0], anchor) ?? new Date(0).toISOString(),
    currentLapIndex: runtime[1] ?? 0,
    readingLapTimes: {} as ReturnType<typeof decodeNumberPairs>,
  };

  if (flags & TIMER_RUNTIME_FLAG_LAP_STARTED_AT) {
    decoded.lapStartedAt = decodeInstant(nextString(), anchor) ?? new Date(0).toISOString();
  }

  if (flags & TIMER_RUNTIME_FLAG_LAP_TIMES) {
    decoded.readingLapTimes = decodeNumberPairs(nextNumberArray(), LAP_KEYS);
  }

  if (flags & TIMER_RUNTIME_FLAG_PENDING_SUBMIT) {
    const pendingValue = nextNumber();
    decoded.pendingSubmit = {
      forcedSubmit: Boolean(pendingValue & 1),
      timedOut: Boolean(pendingValue & 2),
    };
  }

  if (flags & TIMER_RUNTIME_FLAG_UNFINISHED_DRAFT) {
    decoded.unfinishedQuestionsDraft = nextString() || undefined;
  }

  if (flags & TIMER_RUNTIME_FLAG_TIME_LEFT) {
    decoded.timeLeftMs = nextNumber();
  }

  if (flags & TIMER_RUNTIME_FLAG_IS_OVERTIME) {
    decoded.isOvertime = true;
  }

  if (flags & TIMER_RUNTIME_FLAG_OVERTIME_STARTED_AT) {
    decoded.overtimeStartedAt = decodeInstant(nextString(), anchor) ?? new Date(0).toISOString();
  }

  if (flags & TIMER_RUNTIME_FLAG_OVERTIME_ELAPSED) {
    decoded.overtimeElapsedMs = nextNumber();
  }

  return decoded;
}

function decodeLegacyTimerSummary(summary: CompactTimerSummary | undefined) {
  if (!summary) {
    return undefined;
  }

  return {
    totalElapsedMs: summary[0],
    forcedSubmit: Boolean(summary[1] & 1),
    timedOut: Boolean(summary[1] & 2),
    unfinishedQuestions: summary[2],
    resolvedUnfinished: false,
    completedAt: decodeInstant(summary[3]) ?? new Date(0).toISOString(),
  };
}

function decodeLegacyTimerRuntime(runtime: [string, string, number, number[], number, string, number] | undefined) {
  if (!runtime) {
    return undefined;
  }

  const pendingFlags = runtime[4] ?? 0;
  const timeLeftMs = runtime[6];

  return {
    startedAt: decodeInstant(runtime[0]) ?? new Date(0).toISOString(),
    lapStartedAt: decodeInstant(runtime[1]),
    currentLapIndex: runtime[2] ?? 0,
    readingLapTimes: decodeNumberPairs(Array.isArray(runtime[3]) ? runtime[3] : undefined, LAP_KEYS),
    pendingSubmit:
      pendingFlags === 0
        ? undefined
        : {
            forcedSubmit: Boolean(pendingFlags & 1),
            timedOut: Boolean(pendingFlags & 2),
          },
    unfinishedQuestionsDraft: runtime[5] || undefined,
    timeLeftMs: typeof timeLeftMs === 'number' && timeLeftMs >= 0 ? timeLeftMs : undefined,
  };
}

function decodeLegacySessions(compactSessions: LegacyCompactSyncSnapshot['d']['s']) {
  const decoded = SESSION_DEFAULTS.map((session) => ({
    ...session,
    mistakes: { ...session.mistakes },
    reasons: [...session.reasons],
    readingLapTimes: { ...session.readingLapTimes },
  }));

  for (const compact of compactSessions) {
    const sessionIndex = compact[0];
    const base = decoded[sessionIndex];

    if (!base) {
      continue;
    }

    const statusCode = compact[1];
    const nextStatus = typeof statusCode === 'number' ? STATUS_CODES[statusCode as StatusCode] : undefined;
    const timerSummary = Array.isArray(compact[5]) ? decodeLegacyTimerSummary(compact[5] as CompactTimerSummary) : undefined;
    const timerRuntime = Array.isArray(compact[6])
      ? decodeLegacyTimerRuntime(compact[6] as [string, string, number, number[], number, string, number])
      : undefined;
    const updatedAt = typeof compact[7] === 'string' ? decodeInstant(compact[7]) : undefined;

    const nextSession: SprintSnapshot['data']['sessions'][number] = {
      ...base,
      status: nextStatus ?? base.status,
      mistakes: decodeNumberPairs(Array.isArray(compact[2]) ? (compact[2] as number[]) : undefined, MISTAKE_KEYS),
      reasons: decodeReasons(
        Array.isArray(compact[3])
          ? (compact[3].filter((item): item is number => typeof item === 'number') as number[])
          : undefined
      ),
      readingLapTimes: decodeNumberPairs(Array.isArray(compact[4]) ? (compact[4] as number[]) : undefined, LAP_KEYS),
    };

    if (timerSummary) {
      nextSession.timerSummary = timerSummary;
    }

    if (timerRuntime) {
      nextSession.timerRuntime = timerRuntime;
    }

    if (updatedAt) {
      nextSession.updatedAt = updatedAt;
    }

    decoded[sessionIndex] = nextSession;
  }

  return decoded;
}

function hasSessionDelta(session: SprintSnapshot['data']['sessions'][number], index: number) {
  const base = SESSION_DEFAULTS[index];

  if (!base) {
    return true;
  }

  return (
    session.status !== base.status ||
    Object.keys(session.mistakes).length > 0 ||
    Object.keys(session.overtimeMistakes ?? {}).length > 0 ||
    session.reasons.length > 0 ||
    Object.keys(session.readingLapTimes).length > 0 ||
    Boolean(session.timerSummary) ||
    Boolean(session.timerRuntime) ||
    Boolean(session.updatedAt)
  );
}

function encodeSessions(snapshot: SprintSnapshot) {
  return snapshot.data.sessions.flatMap((session) => {
    const sessionIndex = SESSION_INDEX.get(session.id);

    if (sessionIndex === undefined || !hasSessionDelta(session, sessionIndex)) {
      return [];
    }

    const statusCode = STATUS_CODES.indexOf(session.status);
    const mistakes = encodeNumberPairs(session.mistakes, MISTAKE_KEYS);
    const reasons = encodeReasons(session.reasons);
    const lapTimes = encodeNumberPairs(session.readingLapTimes, LAP_KEYS);
    const overtimeMistakes = encodeNumberPairs(session.overtimeMistakes ?? {}, MISTAKE_KEYS);
    let flags = 0;
    const payload: Array<number | number[] | CompactTimerSummary | CompactTimerRuntime | string> = [];

    if (statusCode >= 0 && session.status !== SESSION_DEFAULTS[sessionIndex].status) {
      flags |= SESSION_FLAG_STATUS;
      payload.push(statusCode);
    }

    if (mistakes.length > 0) {
      flags |= SESSION_FLAG_MISTAKES;
      payload.push(mistakes);
    }

    if (reasons.length > 0) {
      flags |= SESSION_FLAG_REASONS;
      payload.push(reasons);
    }

    if (lapTimes.length > 0) {
      flags |= SESSION_FLAG_LAP_TIMES;
      payload.push(lapTimes);
    }

    if (session.timerSummary) {
      flags |= SESSION_FLAG_TIMER_SUMMARY;
      payload.push(encodeTimerSummary(session.timerSummary, snapshot.exportedAt)!);
    }

    if (session.timerRuntime) {
      flags |= SESSION_FLAG_TIMER_RUNTIME;
      payload.push(encodeTimerRuntime(session.timerRuntime, snapshot.exportedAt)!);
    }

    if (overtimeMistakes.length > 0) {
      flags |= SESSION_FLAG_OVERTIME_MISTAKES;
      payload.push(overtimeMistakes);
    }

    if (session.updatedAt) {
      flags |= SESSION_FLAG_UPDATED_AT;
      payload.push(encodeInstant(session.updatedAt, snapshot.exportedAt));
    }

    return [[sessionIndex, flags, ...payload] satisfies CompactSessionDelta];
  });
}

function decodeSessions(compactSessions: CompactSessionDelta[], anchor: string) {
  const decoded: SprintSnapshot['data']['sessions'] = SESSION_DEFAULTS.map((session) => ({
    ...session,
    mistakes: { ...session.mistakes },
    ...(session.overtimeMistakes ? { overtimeMistakes: { ...session.overtimeMistakes } } : {}),
    reasons: [...session.reasons],
    readingLapTimes: { ...session.readingLapTimes },
  }));

  for (const compact of compactSessions) {
    const sessionIndex = compact[0];
    const base = decoded[sessionIndex];

    if (!base) {
      continue;
    }

    let cursor = 2;
    const flags = compact[1] ?? 0;
    const nextValue = () => {
      const value = compact[cursor];
      cursor += 1;
      return value;
    };
    const statusCode = flags & SESSION_FLAG_STATUS ? nextValue() : undefined;
    const nextStatus = typeof statusCode === 'number' ? STATUS_CODES[statusCode as StatusCode] : undefined;
    const mistakes = flags & SESSION_FLAG_MISTAKES ? nextValue() : undefined;
    const reasons = flags & SESSION_FLAG_REASONS ? nextValue() : undefined;
    const lapTimes = flags & SESSION_FLAG_LAP_TIMES ? nextValue() : undefined;
    const timerSummary = flags & SESSION_FLAG_TIMER_SUMMARY ? nextValue() : undefined;
    const timerRuntime = flags & SESSION_FLAG_TIMER_RUNTIME ? nextValue() : undefined;
    const overtimeMistakes = flags & SESSION_FLAG_OVERTIME_MISTAKES ? nextValue() : undefined;
    const updatedAt = flags & SESSION_FLAG_UPDATED_AT ? nextValue() : undefined;

    const decodedOvertimeMistakes = Array.isArray(overtimeMistakes)
      ? decodeNumberPairs(overtimeMistakes as number[], MISTAKE_KEYS)
      : undefined;

    const nextSession: SprintSnapshot['data']['sessions'][number] = {
      ...base,
      status: nextStatus ?? base.status,
      mistakes: Array.isArray(mistakes) ? decodeNumberPairs(mistakes as number[], MISTAKE_KEYS) : {},
      reasons: Array.isArray(reasons) ? decodeReasons(reasons.filter((item): item is number => typeof item === 'number') as number[]) : [],
      readingLapTimes: Array.isArray(lapTimes) ? decodeNumberPairs(lapTimes as number[], LAP_KEYS) : {},
      ...(decodedOvertimeMistakes && Object.keys(decodedOvertimeMistakes).length > 0
        ? { overtimeMistakes: decodedOvertimeMistakes }
        : {}),
    };

    const nextTimerSummary = Array.isArray(timerSummary) ? decodeTimerSummary(timerSummary as CompactTimerSummary, anchor) : undefined;
    const nextTimerRuntime = Array.isArray(timerRuntime) ? decodeTimerRuntime(timerRuntime as CompactTimerRuntime, anchor) : undefined;
    const nextUpdatedAt = typeof updatedAt === 'string' ? decodeInstant(updatedAt, anchor) : undefined;

    if (nextTimerSummary) {
      nextSession.timerSummary = nextTimerSummary;
    }

    if (nextTimerRuntime) {
      nextSession.timerRuntime = nextTimerRuntime;
    }

    if (nextUpdatedAt) {
      nextSession.updatedAt = nextUpdatedAt;
    }

    decoded[sessionIndex] = nextSession;
  }

  return decoded;
}

function encodeHistoricalScores(scores: HistoricalScoreRecord[], examDate: string, exportedAt: string): CompactHistoricalScore[] {
  return scores.map(
    (score) => {
      const base: [string, number, number, number, number, string] = [
        encodeDate(score.date, examDate),
        score.listening,
        score.reading,
        score.total,
        score.source === 'estimated' ? 1 : 0,
        encodeScoreId(score.id, exportedAt),
      ];

      return (score.note ? [...base, score.note] : base) as CompactHistoricalScore;
    }
  );
}

function decodeHistoricalScores(scores: CompactHistoricalScore[], examDate: string, exportedAt?: string) {
  return scores.map((score) => ({
    date: decodeDate(score[0], examDate),
    listening: score[1],
    reading: score[2],
    total: score[3],
    source: score[4] === 1 ? 'estimated' : 'manual',
    id: decodeScoreId(score[5], exportedAt),
    note: score[6],
  } satisfies HistoricalScoreRecord));
}

function extractVocabularyWords(snapshot: SprintSnapshot) {
  const words = new Set<string>();

  for (const entry of snapshot.data.vocabularyEntries ?? []) {
    const text = entry.text.trim();

    if (text) {
      words.add(text);
    }
  }

  return [...words].sort((left, right) => left.localeCompare(right));
}

function encodeVocabularyEntries(snapshot: SprintSnapshot): CompactVocabularyEntry[] {
  const entries = snapshot.data.vocabularyEntries ?? [];

  return entries.flatMap((entry, index) => {
    const text = entry.text.trim();

    if (!text) {
      return [];
    }

    return [[
      entry.id || `sync-vocab-${index}-${Date.now()}`,
      text,
      typeof entry.encounterCount === 'number' && entry.encounterCount >= 1
        ? Math.floor(entry.encounterCount)
        : 1,
      encodeInstant(entry.createdAt, snapshot.exportedAt) || '',
      encodeInstant(entry.updatedAt, snapshot.exportedAt) || '',
      Array.isArray(entry.sessionIds) && entry.sessionIds.length > 0
        ? entry.sessionIds.filter((sessionId): sessionId is string => typeof sessionId === 'string')
        : undefined,
      Array.isArray(entry.tags) && entry.tags.length > 0
        ? entry.tags.filter((tag): tag is string => typeof tag === 'string')
        : undefined,
    ] satisfies CompactVocabularyEntry];
  });
}

function decodeVocabularyEntries(entries: Array<CompactVocabularyEntry | LegacyCompactVocabularyEntry>, anchor: string): VocabularyEntry[] {
  const now = new Date().toISOString();

  return entries
    .map((entry, index) => {
      const text = typeof entry[1] === 'string' ? entry[1].trim() : '';
      const sessionIds = Array.isArray(entry[5])
        ? entry[5].filter((sessionId): sessionId is string => typeof sessionId === 'string')
        : Array.isArray(entry[10])
          ? entry[10].filter((sessionId): sessionId is string => typeof sessionId === 'string')
          : [];
      const tags = Array.isArray(entry[6])
        ? entry[6].filter((tag): tag is string => typeof tag === 'string')
        : Array.isArray(entry[11])
          ? entry[11].filter((tag): tag is string => typeof tag === 'string')
          : [];
      const legacyReading = typeof entry[5] === 'string' && entry[5].trim() ? entry[5].trim() : undefined;
      const legacyDefinition = typeof entry[6] === 'string' && entry[6].trim() ? entry[6].trim() : undefined;
      const legacyEnDefinition = typeof entry[7] === 'string' && entry[7].trim() ? entry[7].trim() : undefined;
      const legacyPartOfSpeech = typeof entry[8] === 'string' && entry[8].trim() ? entry[8].trim() : undefined;
      const legacyExampleSentence = typeof entry[9] === 'string' && entry[9].trim() ? entry[9].trim() : undefined;

      return {
        id: typeof entry[0] === 'string' && entry[0] ? entry[0] : `sync-vocab-${index}-${Date.now()}`,
        text,
        encounterCount: typeof entry[2] === 'number' && entry[2] >= 1 ? Math.floor(entry[2]) : 1,
        createdAt: decodeInstant(entry[3], anchor) ?? now,
        updatedAt: decodeInstant(entry[4], anchor) ?? now,
        reading: legacyReading,
        definition: legacyDefinition,
        enDefinition: legacyEnDefinition,
        partOfSpeech: legacyPartOfSpeech,
        exampleSentence: legacyExampleSentence,
        sessionIds,
        tags,
      } satisfies VocabularyEntry;
    })
    .filter((entry) => entry.text.length > 0);
}

function createVocabularyEntriesFromWords(words: string[]) {
  const now = new Date().toISOString();

  return words.map((word, index) => ({
    id: `sync-vocab-${index}-${Date.now()}`,
    text: word,
    encounterCount: 1,
    sessionIds: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
  }));
}

function expandCompactSnapshotV1(compact: LegacyCompactSyncSnapshot): SprintSnapshot {
  const locale = LOCALE_CODES[compact.d.l] ?? 'zh';
  const activeSessionId = SESSION_DEFAULTS[compact.d.a]?.id ?? 'L1';
  const exportedAt = decodeInstant(compact.t) ?? new Date(0).toISOString();
  const examDate = decodeDate(compact.d.e);

  return {
    app: SNAPSHOT_APP,
    version: compact.v,
    meta: {
      schema: 'cheese-toeic-snapshot',
      snapshotVersion: compact.v,
      exportedFromStorageVersion: compact.m[0],
      minimumReaderVersion: compact.m[1],
    },
    exportedAt,
    data: {
      sessions: decodeLegacySessions(compact.d.s),
      activeSessionId,
      locale,
      examDate,
      historicalScores: decodeHistoricalScores(compact.d.h, examDate),
    },
  };
}

function getMetadataOverride(snapshot: SprintSnapshot) {
  const isCanonical =
    snapshot.app === SNAPSHOT_APP &&
    snapshot.version === SNAPSHOT_VERSION &&
    snapshot.meta.exportedFromStorageVersion === STORAGE_VERSION &&
    snapshot.meta.minimumReaderVersion === DEFAULT_MINIMUM_READER_VERSION;

  return isCanonical
    ? undefined
    : [
        METADATA_FLAG_OVERRIDE,
        snapshot.app,
        snapshot.version,
        snapshot.meta.exportedFromStorageVersion,
        snapshot.meta.minimumReaderVersion,
      ] as [number, string, number, number, number];
}

function compactSnapshot(snapshot: SprintSnapshot, options?: SyncPayloadOptions): CompactSyncSnapshot {
  const localeCode = LOCALE_CODES.indexOf(snapshot.data.locale) as LocaleCode;
  const activeSessionIndex = SESSION_INDEX.get(snapshot.data.activeSessionId) ?? 0;
  const compactVocabularyEntries = options?.includeVocabulary ? encodeVocabularyEntries(snapshot) : undefined;
  const compactData: [CompactSessionDelta[], number, LocaleCode, string, CompactHistoricalScore[], (string[] | CompactVocabularyEntry[])?] = [
    encodeSessions(snapshot),
    activeSessionIndex,
    localeCode >= 0 ? localeCode : 0,
    encodeDate(snapshot.data.examDate),
    encodeHistoricalScores(snapshot.data.historicalScores, snapshot.data.examDate, snapshot.exportedAt),
  ];

  if (compactVocabularyEntries && compactVocabularyEntries.length > 0) {
    compactData[5] = compactVocabularyEntries;
  }

  const base: CompactSyncSnapshot = [
    SYNC_COMPACT_FORMAT_VERSION,
    encodeInstant(snapshot.exportedAt),
    compactData,
  ];
  const metadata = getMetadataOverride(snapshot);

  if (metadata) {
    base.push(metadata);
  }

  return base;
}

function expandCompactSnapshot(compact: CompactSyncSnapshot): SprintSnapshot {
  const exportedAt = decodeInstant(compact[1]) ?? new Date(0).toISOString();
  const data = compact[2];
  const metadata = compact[3];
  const locale = LOCALE_CODES[data[2]] ?? 'zh';
  const examDate = decodeDate(data[3]);
  const vocabularyPayload = data[5];
  const vocabularyWords = Array.isArray(vocabularyPayload) && typeof vocabularyPayload[0] === 'string'
    ? vocabularyPayload.filter((word): word is string => typeof word === 'string' && word.trim().length > 0)
    : [];
  const vocabularyEntries = Array.isArray(vocabularyPayload) && Array.isArray(vocabularyPayload[0])
    ? decodeVocabularyEntries(vocabularyPayload as Array<CompactVocabularyEntry | LegacyCompactVocabularyEntry>, exportedAt)
    : [];

  return {
    app: SNAPSHOT_APP,
    version: metadata?.[0] === METADATA_FLAG_OVERRIDE ? metadata[2] : SNAPSHOT_VERSION,
    meta: {
      schema: 'cheese-toeic-snapshot',
      snapshotVersion: metadata?.[0] === METADATA_FLAG_OVERRIDE ? metadata[2] : SNAPSHOT_VERSION,
      exportedFromStorageVersion: metadata?.[0] === METADATA_FLAG_OVERRIDE ? metadata[3] : STORAGE_VERSION,
      minimumReaderVersion: metadata?.[0] === METADATA_FLAG_OVERRIDE ? metadata[4] : DEFAULT_MINIMUM_READER_VERSION,
    },
    exportedAt,
    data: {
      sessions: decodeSessions(data[0], exportedAt),
      activeSessionId: SESSION_DEFAULTS[data[1]]?.id ?? 'L1',
      locale,
      examDate,
      historicalScores: decodeHistoricalScores(data[4], examDate, exportedAt),
      ...(vocabularyEntries.length > 0
        ? { vocabularyEntries }
        : vocabularyWords.length > 0
        ? { vocabularyEntries: createVocabularyEntriesFromWords(vocabularyWords) }
        : {}),
    },
  };
}

function toBase64Url(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function encodeSnapshotToSyncPayload(snapshot: SprintSnapshot, options?: SyncPayloadOptions) {
  const json = JSON.stringify(compactSnapshot(snapshot, options));
  const compressed = deflateSync(strToU8(json), { level: 9 });

  return toBase64Url(compressed);
}

export function decodeSnapshotFromSyncPayload(payload: string) {
  try {
    const compressed = fromBase64Url(payload);
    const json = strFromU8(inflateSync(compressed));
    const parsed = JSON.parse(json) as unknown;

    if (isCompactSyncSnapshot(parsed)) {
      return expandCompactSnapshot(parsed);
    }

    if (isLegacyCompactSyncSnapshot(parsed)) {
      return expandCompactSnapshotV1(parsed);
    }

    return parsed as SprintSnapshot;
  } catch {
    try {
      const compressed = fromBase64Url(payload);
      const json = strFromU8(unzlibSync(compressed));
      const parsed = JSON.parse(json) as unknown;

      if (isLegacyCompactSyncSnapshot(parsed)) {
        return expandCompactSnapshotV1(parsed);
      }

      return parsed as SprintSnapshot;
    } catch {
      throw new Error('Invalid sync payload');
    }
  }
}

export function buildSyncHash(snapshot: SprintSnapshot, options?: SyncPayloadOptions) {
  return `#${SYNC_HASH_PREFIX}${encodeSnapshotToSyncPayload(snapshot, options)}`;
}

export function buildSyncUrl(snapshot: SprintSnapshot, currentUrl: string, options?: SyncPayloadOptions) {
  const baseUrl = currentUrl.split('#')[0];
  return `${baseUrl}${buildSyncHash(snapshot, options)}`;
}

export function extractSyncPayloadFromHash(hash: string) {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;

  if (!normalized.startsWith(SYNC_HASH_PREFIX)) {
    return null;
  }

  return normalized.slice(SYNC_HASH_PREFIX.length);
}

export function getSyncPreview(snapshot: SprintSnapshot): SyncPreview {
  return {
    app: snapshot.app,
    version: snapshot.version,
    exportedAt: snapshot.exportedAt,
    sessionCount: snapshot.data.sessions.length,
    historyCount: snapshot.data.historicalScores.length,
    vocabularyCount: extractVocabularyWords(snapshot).length,
    activeSessionId: snapshot.data.activeSessionId,
    locale: snapshot.data.locale,
  };
}