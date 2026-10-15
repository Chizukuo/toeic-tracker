import { describe, expect, it } from 'vitest';

import {
  AUTO_BACKUP_KEY_PREFIX,
  AUTO_BACKUP_MAX,
  createAutoBackup,
  createSnapshot,
  getAutoBackups,
  migratePersistedState,
  parseImportSnapshot,
  STORAGE_VERSION,
} from '@/lib/storeSnapshot';
import { createInitialSessions, SPRINT_DEFAULT_CONFIG } from '@/lib/toeic';

class MemoryStorage implements Storage {
  private items = new Map<string, string>();

  get length() {
    return this.items.size;
  }

  clear() {
    this.items.clear();
  }

  getItem(key: string) {
    return this.items.get(key) ?? null;
  }

  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.items.delete(key);
  }

  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

function makeState(overrides: Partial<Parameters<typeof createSnapshot>[0]> = {}) {
  return {
    sessions: createInitialSessions(),
    activeSessionId: 'L1',
    locale: 'zh' as const,
    examDate: '2026-05-24',
    historicalScores: [],
    sprintConfig: SPRINT_DEFAULT_CONFIG,
    vocabularyEntries: [],
    targetScore: 850,
    unlockedAchievements: [],
    achievementUnlocks: {},
    ...overrides,
  };
}

describe('auto backups', () => {
  it('skips throttled backups inside the minimum interval but always honours forced ones', () => {
    const storage = new MemoryStorage();
    const state = makeState();

    expect(createAutoBackup(state, storage, { now: 1_000_000 })).toBe(true);
    expect(createAutoBackup(state, storage, { now: 1_000_500, minIntervalMs: 60_000 })).toBe(false);
    expect(createAutoBackup(state, storage, { now: 1_000_600 })).toBe(true);
    expect(createAutoBackup(state, storage, { now: 1_100_000, minIntervalMs: 60_000 })).toBe(true);

    expect(getAutoBackups(storage)).toHaveLength(3);
  });

  it('keeps only the newest backups', () => {
    const storage = new MemoryStorage();
    storage.setItem('unrelated', 'x');

    for (let index = 0; index < AUTO_BACKUP_MAX + 2; index++) {
      createAutoBackup(makeState(), storage, { now: 2_000_000 + index });
    }

    const backups = getAutoBackups(storage);
    expect(backups).toHaveLength(AUTO_BACKUP_MAX);
    expect(backups[0].key).toBe(`${AUTO_BACKUP_KEY_PREFIX}${2_000_000 + AUTO_BACKUP_MAX + 1}`);
    expect(storage.getItem('unrelated')).toBe('x');
  });
});

describe('target score and achievement round-trips', () => {
  it('imports the target score from a snapshot and leaves it unset when absent', () => {
    const snapshot = createSnapshot(makeState({ targetScore: 905 }));
    expect(parseImportSnapshot(snapshot, makeState()).targetScore).toBe(905);

    const withoutTarget = { ...snapshot, data: { ...snapshot.data, targetScore: undefined } };
    expect(parseImportSnapshot(withoutTarget, makeState()).targetScore).toBeUndefined();
  });

  it('keeps target score and achievement dates through a storage migration', () => {
    const migrated = migratePersistedState(
      {
        sessions: createInitialSessions(),
        targetScore: 903,
        unlockedAchievements: ['first-session'],
        achievementUnlocks: { 'first-session': '2026-03-01T00:00:00.000Z' },
      },
      STORAGE_VERSION - 1
    );

    expect(migrated.targetScore).toBe(905);
    expect(migrated.unlockedAchievements).toEqual(['first-session']);
    expect(migrated.achievementUnlocks).toEqual({ 'first-session': '2026-03-01T00:00:00.000Z' });
  });
});
