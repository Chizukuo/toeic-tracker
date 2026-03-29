export type UXEventType =
  | 'timer_started'
  | 'strict_attempt_saved'
  | 'review_saved'
  | 'review_undone'
  | 'overtime_saved'
  | 'auto_advance_triggered'
  | 'listening_start'
  | 'listening_complete';

export type UXEvent = {
  id: string;
  at: string;
  type: UXEventType;
  sessionId?: string;
};

const STORAGE_KEY = 'toeic-ux-events';
const MAX_EVENTS = 240;

function readEvents(): UXEvent[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as UXEvent[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => item && typeof item.type === 'string' && typeof item.at === 'string');
  } catch {
    return [];
  }
}

function writeEvents(events: UXEvent[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
}

export function trackUXEvent(type: UXEventType, sessionIdOrExtra?: string | { sessionId?: string; [key: string]: unknown }) {
  const events = readEvents();
  const sessionId = typeof sessionIdOrExtra === 'string' ? sessionIdOrExtra : sessionIdOrExtra?.sessionId;
  events.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    type,
    sessionId,
  });
  writeEvents(events);
}

export function getUXEvents() {
  return readEvents();
}
