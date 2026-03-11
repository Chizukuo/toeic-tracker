import { strFromU8, strToU8, zlibSync, unzlibSync } from 'fflate';

import type { SprintSnapshot } from '@/lib/storeSnapshot';

export const SYNC_HASH_PREFIX = 'sync=v1.';
export const MAX_SYNC_URL_LENGTH = 3200;

export type SyncPreview = {
  app: string;
  version: number;
  exportedAt: string;
  sessionCount: number;
  historyCount: number;
  activeSessionId: string;
  locale: 'zh' | 'en';
};

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

export function encodeSnapshotToSyncPayload(snapshot: SprintSnapshot) {
  const json = JSON.stringify(snapshot);
  const compressed = zlibSync(strToU8(json), { level: 9 });

  return toBase64Url(compressed);
}

export function decodeSnapshotFromSyncPayload(payload: string) {
  try {
    const compressed = fromBase64Url(payload);
    const json = strFromU8(unzlibSync(compressed));

    return JSON.parse(json) as SprintSnapshot;
  } catch {
    throw new Error('Invalid sync payload');
  }
}

export function buildSyncHash(snapshot: SprintSnapshot) {
  return `#${SYNC_HASH_PREFIX}${encodeSnapshotToSyncPayload(snapshot)}`;
}

export function buildSyncUrl(snapshot: SprintSnapshot, currentUrl: string) {
  const baseUrl = currentUrl.split('#')[0];
  return `${baseUrl}${buildSyncHash(snapshot)}`;
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
    activeSessionId: snapshot.data.activeSessionId,
    locale: snapshot.data.locale,
  };
}