'use client';

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getCopy, translatePart } from '@/lib/i18n';
import {
  READING_PARTS,
  READING_LAP_SEGMENTS,
  formatClock,
  formatMinutes,
  getTargetDurationMs,
  hasResolvedUnfinished,
  inferReadingUnfinishedDistribution,
  normalizeReadingPartDistribution,
  sumReadingPartDistribution,
  type ReadingPartKey,
  type ReadingLapKey,
  type SessionRecord,
  type UnfinishedByPartMeta,
} from '@/lib/toeic';
import { trackUXEvent } from '@/lib/uxEvent';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

type PendingSubmit = {
  forcedSubmit: boolean;
  timedOut: boolean;
};

type InitialTimerState = {
  timeLeft: number;
  isRunning: boolean;
  readingLapTimes: Partial<Record<ReadingLapKey, number>>;
  currentLapIndex: number;
  unfinishedQuestions: string;
  unfinishedByPartDraft: Partial<Record<ReadingPartKey, number>>;
  pendingSubmit: PendingSubmit | null;
  startedAtMs: number | null;
  lapStartedAtMs: number | null;
  isOvertime: boolean;
  overtimeStartedAtMs: number | null;
  overtimeElapsedMs: number;
  showTimeoutDialog: boolean;
};

const getNow = () => Date.now();

/** Mirrors the running clock into the tab title so it stays visible while the user is in the test PDF. */
function useDocumentTitleClock(label: string | null) {
  useEffect(() => {
    if (!label) return;
    const prefix = `${label} · `;
    document.title = `${prefix}${document.title}`;
    return () => {
      // Strip only our prefix so a title set by a route change in the meantime survives.
      if (document.title.startsWith(prefix)) {
        document.title = document.title.slice(prefix.length);
      }
    };
  }, [label]);
}

/** Keeps a phone screen awake while a timed attempt runs; re-acquired when the tab becomes visible again. */
function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void next.release();
          return;
        }
        sentinel = next;
      } catch {
        // Denied (battery saver, unsupported context) — the timer still works without it.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Two-step confirm for destructive taps: first call arms it, second call within the window runs it. */
function useArmedConfirm(timeoutMs = 3000) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), timeoutMs);
    return () => window.clearTimeout(id);
  }, [armed, timeoutMs]);

  const trigger = (action: () => void) => {
    if (armed) {
      setArmed(false);
      action();
      return;
    }
    setArmed(true);
  };

  return { armed, trigger };
}

function toValidTime(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getInitialTimerState(session: SessionRecord, totalDurationMs: number): InitialTimerState {
  const runtime = session.timerRuntime;
  const unresolvedBacklog = session.type === 'R'
    && (session.timerSummary?.unfinishedQuestions ?? 0) > 0
    && !hasResolvedUnfinished(session);
  const unfinishedDraft = runtime?.unfinishedQuestionsDraft ?? (session.timerSummary?.unfinishedQuestions ? String(session.timerSummary.unfinishedQuestions) : '');
  const summaryDistribution = normalizeReadingPartDistribution(session.timerSummary?.unfinishedByPart);
  const runtimeDistribution = normalizeReadingPartDistribution(runtime?.unfinishedByPartDraft);
  const inferredDistribution = unresolvedBacklog && sumReadingPartDistribution(summaryDistribution) === 0
    ? inferReadingUnfinishedDistribution(session, session.timerSummary?.unfinishedQuestions ?? 0).distribution
    : {};
  const unfinishedByPartDraft = sumReadingPartDistribution(runtimeDistribution) > 0
    ? runtimeDistribution
    : sumReadingPartDistribution(summaryDistribution) > 0
      ? summaryDistribution
      : inferredDistribution;

  if (!runtime) {
    return {
      timeLeft: unresolvedBacklog ? 0 : totalDurationMs,
      isRunning: false,
      readingLapTimes: {},
      currentLapIndex: 0,
      unfinishedQuestions: unfinishedDraft,
      unfinishedByPartDraft,
      pendingSubmit: null,
      startedAtMs: null,
      lapStartedAtMs: null,
      isOvertime: false,
      overtimeStartedAtMs: null,
      overtimeElapsedMs: session.timerSummary?.overtimeElapsedMs ?? 0,
      showTimeoutDialog: false,
    };
  }

  const startedAtMs = toValidTime(runtime.startedAt) ?? Date.now();
  const lapStartedAtMs = toValidTime(runtime.lapStartedAt) ?? startedAtMs;

  if (runtime.isOvertime) {
    const overtimeStartedAtMs = toValidTime(runtime.overtimeStartedAt) ?? Date.now();
    const overtimeElapsedMs = (runtime.overtimeElapsedMs ?? 0) + Math.max(Date.now() - overtimeStartedAtMs, 0);

    return {
      timeLeft: 0,
      isRunning: true,
      readingLapTimes: runtime.readingLapTimes,
      currentLapIndex: runtime.currentLapIndex,
      unfinishedQuestions: unfinishedDraft,
      unfinishedByPartDraft,
      pendingSubmit: null,
      startedAtMs,
      lapStartedAtMs,
      isOvertime: true,
      overtimeStartedAtMs,
      overtimeElapsedMs,
      showTimeoutDialog: false,
    };
  }

  const restoredTimeLeft = typeof runtime.timeLeftMs === 'number'
    ? Math.max(runtime.timeLeftMs, 0)
    : Math.max(totalDurationMs - (getNow() - startedAtMs), 0);
  const pendingSubmit = runtime.pendingSubmit ?? (session.type === 'R' && restoredTimeLeft <= 0
    ? { forcedSubmit: true, timedOut: true }
    : null);

  return {
    timeLeft: restoredTimeLeft,
    isRunning: restoredTimeLeft > 0 && !pendingSubmit,
    readingLapTimes: runtime.readingLapTimes,
    currentLapIndex: runtime.currentLapIndex,
    unfinishedQuestions: unfinishedDraft,
    unfinishedByPartDraft,
    pendingSubmit,
    startedAtMs,
    lapStartedAtMs,
    isOvertime: false,
    overtimeStartedAtMs: null,
    overtimeElapsedMs: runtime.overtimeElapsedMs ?? session.timerSummary?.overtimeElapsedMs ?? 0,
    showTimeoutDialog: Boolean(pendingSubmit?.timedOut),
  };
}

// ─── Listening Session — Calm Stopwatch Flow ───────────────────────────────

function ListeningFlow({
  session,
  onStrictAttemptSaved,
}: {
  session: SessionRecord;
  onStrictAttemptSaved?: (sessionId: string) => void;
}) {
  const patchSession = useStore((state) => state.patchSession);
  const locale = useStore((state) => state.locale);

  // Elapsed stopwatch (informational only, no pressure)
  const [elapsedMs, setElapsedMs] = useState(() => {
    const runtime = session.timerRuntime;
    if (!runtime?.startedAt) return 0;
    const startMs = toValidTime(runtime.startedAt);
    return startMs ? Math.max(getNow() - startMs, 0) : 0;
  });
  const [isActive, setIsActive] = useState(() => {
    const runtime = session.timerRuntime;
    return Boolean(runtime?.startedAt && !session.timerSummary);
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startedAtRef = useRef<number | null>(
    (() => {
      const runtime = session.timerRuntime;
      if (!runtime?.startedAt) return null;
      return toValidTime(runtime.startedAt);
    })()
  );

  // Start stopwatch
  const handleStart = useCallback(() => {
    const now = getNow();
    startedAtRef.current = now;
    setIsActive(true);
    setElapsedMs(0);
    patchSession(session.id, {
      status: 'in-progress',
      timerRuntime: {
        startedAt: new Date(now).toISOString(),
        lapStartedAt: new Date(now).toISOString(),
        currentLapIndex: 0,
        readingLapTimes: {},
        isOvertime: false,
        overtimeStartedAt: undefined,
        overtimeElapsedMs: 0,
        pendingSubmit: undefined,
      },
    });
    trackUXEvent('listening_start', { sessionId: session.id });
  }, [session.id, patchSession]);

  // Mark complete
  const handleComplete = useCallback(() => {
    setIsSubmitting(true);
    const totalElapsedMs = elapsedMs;
    patchSession(session.id, {
      timerSummary: {
        totalElapsedMs,
        forcedSubmit: false,
        timedOut: false,
        unfinishedQuestions: 0,
        resolvedUnfinished: true,
        completedAt: new Date().toISOString(),
      },
      timerRuntime: undefined,
    });
    trackUXEvent('listening_complete', { sessionId: session.id, totalElapsedMs });
    onStrictAttemptSaved?.(session.id);
  }, [session.id, elapsedMs, patchSession, onStrictAttemptSaved]);

  const handleContinueToReview = useCallback(() => {
    onStrictAttemptSaved?.(session.id);
  }, [session.id, onStrictAttemptSaved]);

  // Tick
  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => {
      const start = startedAtRef.current;
      setElapsedMs(start ? getNow() - start : 0);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isActive]);

  const elapsedFormatted = formatClock(elapsedMs);
  useDocumentTitleClock(isActive ? elapsedFormatted : null);
  useScreenWakeLock(isActive);
  const hasPrevious = Boolean(session.timerSummary);
  const previousTime = hasPrevious ? session.timerSummary!.totalElapsedMs : 0;

  return (
    <div className="space-y-6">
      {/* Mode badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-(--separator) bg-(--surface-grouped) px-4 py-2">
          <div className={cn(
            'size-2 rounded-full',
            isActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-600'
          )} />
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-(--label-secondary)">
            {isActive
              ? (locale === 'zh' ? '正在计时' : 'Timing')
              : (locale === 'zh' ? '听力 · 约 45 分钟' : 'Listening · about 45 min')}
          </span>
        </div>
        {hasPrevious && (
          <div className="text-xs text-(--label-tertiary)">
            {locale === 'zh' ? `上次 ${formatClock(previousTime)}` : `Last ${formatClock(previousTime)}`}
          </div>
        )}
      </div>

      {/* Elapsed clock — large, calm, no pressure color */}
      <div className="flex flex-col items-center py-8 sm:py-12">
        <motion.div
          key={isActive ? 'active' : 'idle'}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
          className="tabular-nums text-[4.5rem] font-bold tracking-tight leading-none text-(--label-primary) sm:text-[6rem]"
        >
          {elapsedFormatted}
        </motion.div>
        <p className="mt-4 text-sm text-(--label-tertiary) text-center max-w-xs leading-relaxed">
          {locale === 'zh'
            ? '播放听力音频时点「开始计时」，做完点「做完了」去对答案。计时只是记录用时，不会自动停止。'
            : 'Start the timer with the audio, and tap "Done" when you finish to check answers. It only records time; it never stops you.'}
        </p>
      </div>

      {/* Action */}
      {!isActive && !hasPrevious && (
        <motion.button
          type="button"
          onClick={handleStart}
          whileTap={{ scale: 0.97 }}
          className="flex w-full items-center justify-center gap-2.5 rounded-full bg-(--cheese-gold) px-8 py-4 text-sm font-bold text-white shadow-[0_4px_14px_rgba(217,119,6,0.30)] transition-all hover:shadow-[0_6px_20px_rgba(217,119,6,0.40)] hover:brightness-110 dark:text-zinc-900"
        >
          <Play className="size-4" />
          {locale === 'zh' ? '开始计时（可选）' : 'Start Stopwatch (optional)'}
        </motion.button>
      )}

      {isActive && (
        <motion.button
          type="button"
          onClick={handleComplete}
          disabled={isSubmitting}
          whileTap={{ scale: 0.97 }}
          className="flex w-full items-center justify-center gap-2.5 rounded-full bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-[0_4px_14px_rgba(16,185,129,0.30)] transition-all hover:shadow-[0_6px_20px_rgba(16,185,129,0.40)] hover:brightness-110 disabled:opacity-60"
        >
          <CheckCircle2 className="size-4" />
          {locale === 'zh' ? '做完了，去对答案' : 'Done — check answers'}
        </motion.button>
      )}

      {!isActive && hasPrevious && (
        <motion.button
          type="button"
          onClick={handleContinueToReview}
          disabled={isSubmitting}
          whileTap={{ scale: 0.97 }}
          className="flex w-full items-center justify-center gap-2.5 rounded-full bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-[0_4px_14px_rgba(16,185,129,0.30)] transition-all hover:shadow-[0_6px_20px_rgba(16,185,129,0.40)] hover:brightness-110 disabled:opacity-60"
        >
          <CheckCircle2 className="size-4" />
          {locale === 'zh' ? '去对答案' : 'Check answers'}
        </motion.button>
      )}

      {!isActive && !hasPrevious && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleComplete}
            className="text-xs text-(--label-tertiary) underline-offset-2 hover:underline hover:text-(--label-secondary) transition-colors"
          >
            {locale === 'zh' ? '已经做完了？直接去对答案' : 'Already done? Go straight to checking answers'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── LapTimer main export ───────────────────────────────────────────────

export function LapTimer({
  session,
  onFocusModeChange,
  onStrictAttemptSaved,
  onBacklogSkipped,
}: {
  session: SessionRecord;
  onFocusModeChange?: (enabled: boolean) => void;
  onStrictAttemptSaved?: (sessionId: string) => void;
  /** Called when the user chooses not to finish leftover reading questions. */
  onBacklogSkipped?: (sessionId: string) => void;
}) {
  // Route listening sessions to the simplified flow
  if (session.type === 'L') {
    return <ListeningFlow session={session} onStrictAttemptSaved={onStrictAttemptSaved} />;
  }

  return (
    <ReadingTimer
      session={session}
      onFocusModeChange={onFocusModeChange}
      onStrictAttemptSaved={onStrictAttemptSaved}
      onBacklogSkipped={onBacklogSkipped}
    />
  );
}

function ReadingTimer({
  session,
  onFocusModeChange,
  onStrictAttemptSaved,
  onBacklogSkipped,
}: {
  session: SessionRecord;
  onFocusModeChange?: (enabled: boolean) => void;
  onStrictAttemptSaved?: (sessionId: string) => void;
  onBacklogSkipped?: (sessionId: string) => void;
}) {
  const patchSession = useStore((state) => state.patchSession);
  const saveOvertimeDiagnostics = useStore((state) => state.saveOvertimeDiagnostics);
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);
  const isListening = session.type === 'L';
  const totalDurationMs = getTargetDurationMs(session.type);
  const initialState = getInitialTimerState(session, totalDurationMs);

  const [timeLeft, setTimeLeft] = useState(initialState.timeLeft);
  const [isRunning, setIsRunning] = useState(initialState.isRunning);
  const [readingLapTimes, setReadingLapTimes] = useState<Partial<Record<ReadingLapKey, number>>>(initialState.readingLapTimes);
  const [currentLapIndex, setCurrentLapIndex] = useState(initialState.currentLapIndex);
  const [unfinishedQuestions, setUnfinishedQuestions] = useState(initialState.unfinishedQuestions);
  const [unfinishedByPartDraft, setUnfinishedByPartDraft] = useState<Partial<Record<ReadingPartKey, number>>>(initialState.unfinishedByPartDraft);
  const [pendingSubmit, setPendingSubmit] = useState<PendingSubmit | null>(initialState.pendingSubmit);
  const [isOvertime, setIsOvertime] = useState(initialState.isOvertime);
  const [overtimeElapsedMs, setOvertimeElapsedMs] = useState(initialState.overtimeElapsedMs);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(initialState.showTimeoutDialog);
  // Time spent in the active part since it was last entered; refreshed by the 1s tick.
  const [currentLapLiveMs, setCurrentLapLiveMs] = useState(() =>
    initialState.isRunning && initialState.lapStartedAtMs ? Math.max(Date.now() - initialState.lapStartedAtMs, 0) : 0
  );

  const startedAtRef = useRef<number | null>(initialState.startedAtMs);
  const lapStartedAtRef = useRef<number | null>(initialState.lapStartedAtMs);
  const overtimeStartedAtRef = useRef<number | null>(initialState.overtimeStartedAtMs);

  const completedLapCount = useMemo(
    () => READING_LAP_SEGMENTS.filter((segment) => readingLapTimes[segment.key] !== undefined).length,
    [readingLapTimes]
  );

  const overtimeMode = isOvertime && Boolean(session.timerRuntime?.isOvertime);
  const timerRunning = isRunning && (!isOvertime || overtimeMode);
  const currentSegment = READING_LAP_SEGMENTS[currentLapIndex];

  const warning = !overtimeMode && (isListening || timeLeft <= 5 * 60 * 1000);
  const restartConfirm = useArmedConfirm();
  const [showByPart, setShowByPart] = useState(() => sumReadingPartDistribution(initialState.unfinishedByPartDraft) > 0);
  const backlogCount = session.timerSummary?.unfinishedQuestions ?? 0;
  useDocumentTitleClock(
    timerRunning ? (overtimeMode ? `+${formatClock(overtimeElapsedMs)}` : formatClock(timeLeft)) : null
  );
  useScreenWakeLock(timerRunning);
  const progressValue = overtimeMode ? 100 : ((totalDurationMs - timeLeft) / totalDurationMs) * 100;
  const unresolvedBacklog = session.type === 'R' && (session.timerSummary?.unfinishedQuestions ?? 0) > 0 && !hasResolvedUnfinished(session);
  const unfinishedByPartTotal = useMemo(() => sumReadingPartDistribution(unfinishedByPartDraft), [unfinishedByPartDraft]);

  function buildInferenceRecord(): SessionRecord {
    return {
      ...session,
      readingLapTimes,
      timerRuntime: {
        ...session.timerRuntime,
        startedAt: session.timerRuntime?.startedAt ?? new Date(startedAtRef.current ?? getNow()).toISOString(),
        currentLapIndex: currentLapIndex,
        readingLapTimes,
      },
    };
  }

  function applySmartUnfinishedDistribution(target?: number) {
    const parsed = typeof target === 'number' ? target : Number(unfinishedQuestions);
    const unfinishedCount = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    if (unfinishedCount <= 0) {
      setUnfinishedByPartDraft({});
      setUnfinishedQuestions('0');
      return;
    }

    const inferred = inferReadingUnfinishedDistribution(buildInferenceRecord(), unfinishedCount);
    const normalized = normalizeReadingPartDistribution(inferred.distribution);
    const normalizedTotal = sumReadingPartDistribution(normalized);
    setUnfinishedByPartDraft(normalized);
    setUnfinishedQuestions(String(normalizedTotal > 0 ? normalizedTotal : unfinishedCount));
  }

  function updateUnfinishedByPart(part: ReadingPartKey, value: string) {
    const parsed = Number(value);
    const safe = Number.isNaN(parsed) ? 0 : Math.max(0, Math.floor(parsed));

    setUnfinishedByPartDraft((current) => {
      const next = { ...current };
      if (safe > 0) {
        next[part] = safe;
      } else {
        delete next[part];
      }

      const total = sumReadingPartDistribution(next);
      setUnfinishedQuestions(String(total));
      return next;
    });
  }

  function updateUnfinishedQuestionsInput(value: string) {
    setUnfinishedQuestions(value);

    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setUnfinishedByPartDraft({});
    }
  }

  function deriveUnfinishedSubmission(unfinishedCountInput: number): {
    unfinishedCount: number;
    unfinishedByPart?: Partial<Record<ReadingPartKey, number>>;
    unfinishedByPartMeta?: UnfinishedByPartMeta;
  } {
    const requested = Math.max(0, Math.floor(unfinishedCountInput));
    const manualDistribution = normalizeReadingPartDistribution(unfinishedByPartDraft);
    const manualTotal = sumReadingPartDistribution(manualDistribution);

    if (manualTotal > 0) {
      return {
        unfinishedCount: manualTotal,
        unfinishedByPart: manualDistribution,
        unfinishedByPartMeta: {
          source: 'manual',
          confidence: 1,
        },
      };
    }

    if (requested <= 0) {
      return {
        unfinishedCount: 0,
      };
    }

    const inferred = inferReadingUnfinishedDistribution(buildInferenceRecord(), requested);
    return {
      unfinishedCount: requested,
      unfinishedByPart: normalizeReadingPartDistribution(inferred.distribution),
      unfinishedByPartMeta: {
        source: inferred.source,
        confidence: inferred.confidence,
      },
    };
  }

  function selectActiveLap(index: number) {
    if (index === currentLapIndex || (!timerRunning && isRunning)) {
      if (!isRunning) setCurrentLapIndex(index);
      return;
    }

    if (!timerRunning || !currentSegment || !lapStartedAtRef.current) {
      setCurrentLapIndex(index);
      return;
    }

    const now = getNow();
    const elapsed = Math.max(now - lapStartedAtRef.current, 0);
    const nextLapTimes = elapsed > 0
      ? {
          ...readingLapTimes,
          [currentSegment.key]: (readingLapTimes[currentSegment.key] ?? 0) + elapsed,
        }
      : readingLapTimes;

    if (elapsed > 0) {
      setReadingLapTimes(nextLapTimes);
    }
    
    lapStartedAtRef.current = now;
    setCurrentLapLiveMs(0);
    setCurrentLapIndex(index);

    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes: nextLapTimes,
      timerRuntime: {
        ...session.timerRuntime,
        startedAt: new Date(startedAtRef.current ?? now).toISOString(),
        lapStartedAt: new Date(now).toISOString(),
        currentLapIndex: index,
        readingLapTimes: nextLapTimes,
        unfinishedQuestionsDraft: unfinishedQuestions,
        unfinishedByPartDraft,
        timeLeftMs: Math.max(timeLeft, 0),
      },
    });
  }

  function stopAndFlushLapTime() {
    if (!lapStartedAtRef.current || !currentSegment || !timerRunning) {
      return readingLapTimes;
    }
    const elapsed = Math.max(getNow() - lapStartedAtRef.current, 1);
    const nextTimes = {
      ...readingLapTimes,
      [currentSegment.key]: (readingLapTimes[currentSegment.key] ?? 0) + elapsed,
    };
    setReadingLapTimes(nextTimes);
    lapStartedAtRef.current = getNow();
    setCurrentLapLiveMs(0);
    return nextTimes;
  }

  function persistRuntime(next: Partial<NonNullable<SessionRecord['timerRuntime']>>, syncedTimes?: Partial<Record<ReadingLapKey, number>>) {
    const times = syncedTimes ?? readingLapTimes;
    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes: times,
      timerRuntime: {
        ...session.timerRuntime,
        startedAt: new Date(startedAtRef.current ?? getNow()).toISOString(),
        lapStartedAt: lapStartedAtRef.current ? new Date(lapStartedAtRef.current).toISOString() : undefined,
        currentLapIndex: currentLapIndex,
        readingLapTimes: times,
        unfinishedQuestionsDraft: unfinishedQuestions,
        unfinishedByPartDraft,
        timeLeftMs: Math.max(timeLeft, 0),
        ...next,
      },
    });
  }

  function resetLocalTimerState() {
    startedAtRef.current = null;
    lapStartedAtRef.current = null;
    overtimeStartedAtRef.current = null;
    setIsRunning(false);
    setPendingSubmit(null);
    setIsOvertime(false);
    setShowTimeoutDialog(false);
  }

  function commitStrictAttempt(options: PendingSubmit & {
    unfinishedCount: number;
    unfinishedByPart?: Partial<Record<ReadingPartKey, number>>;
    unfinishedByPartMeta?: UnfinishedByPartMeta;
    readingLapTimesOverride?: Partial<Record<ReadingLapKey, number>>;
    keepOvertimeRuntime?: boolean;
  }) {
    const nextReadingLapTimes = isListening ? session.readingLapTimes : (options.readingLapTimesOverride ?? readingLapTimes);
    const elapsedMs = options.timedOut
      ? totalDurationMs
      : startedAtRef.current
        ? Math.min(Math.max(getNow() - startedAtRef.current, 0), totalDurationMs)
        : totalDurationMs - timeLeft;

    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes: nextReadingLapTimes,
      timerSummary: {
        totalElapsedMs: Math.max(0, elapsedMs),
        forcedSubmit: options.forcedSubmit,
        timedOut: options.timedOut && options.unfinishedCount > 0,
        unfinishedQuestions: options.unfinishedCount,
        resolvedUnfinished: options.unfinishedCount === 0,
        unfinishedByPart: options.unfinishedByPart,
        unfinishedByPartMeta: options.unfinishedByPartMeta,
        overtimeElapsedMs: session.timerSummary?.overtimeElapsedMs,
        completedAt: new Date().toISOString(),
      },
      timerRuntime: options.keepOvertimeRuntime ? session.timerRuntime : undefined,
    });

    if (!options.keepOvertimeRuntime) {
      resetLocalTimerState();
      setTimeLeft(totalDurationMs);
      setUnfinishedQuestions(options.unfinishedCount > 0 ? String(options.unfinishedCount) : '');
      setUnfinishedByPartDraft(options.unfinishedByPart ?? {});
      onStrictAttemptSaved?.(session.id);
      trackUXEvent('strict_attempt_saved', session.id);
    }
  }

  useEffect(() => {
    onFocusModeChange?.(timerRunning && !overtimeMode);
  }, [onFocusModeChange, overtimeMode, timerRunning]);

  const handleTimeoutReached = useEffectEvent(() => {
    if (isListening) {
      commitStrictAttempt({ forcedSubmit: true, timedOut: false, unfinishedCount: 0 });
      return;
    }

    const finalTimes = stopAndFlushLapTime();
    const nextPending = { forcedSubmit: true, timedOut: true } satisfies PendingSubmit;
    navigator.vibrate?.([200, 120, 200]);
    setIsRunning(false);
    setPendingSubmit(nextPending);
    setShowTimeoutDialog(true);
    setTimeLeft(0);
    persistRuntime({ pendingSubmit: nextPending, timeLeftMs: 0 }, finalTimes);
  });

  const syncPendingSubmitDraft = useEffectEvent(() => {
    const runtime = session.timerRuntime;
    if (!runtime) {
      return;
    }

    patchSession(session.id, {
      timerRuntime: {
        ...runtime,
        unfinishedQuestionsDraft: unfinishedQuestions,
        unfinishedByPartDraft,
        pendingSubmit: pendingSubmit ?? undefined,
      },
    });
  });

  useEffect(() => {
    if (!timerRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (overtimeMode) {
        if (!overtimeStartedAtRef.current) {
          return;
        }

        setOvertimeElapsedMs(Math.max(getNow() - overtimeStartedAtRef.current, 0));
        return;
      }

      if (!startedAtRef.current) {
        return;
      }

      const now = getNow();
      const remaining = Math.max(totalDurationMs - (now - startedAtRef.current), 0);
      setTimeLeft(remaining);
      setCurrentLapLiveMs(lapStartedAtRef.current ? Math.max(now - lapStartedAtRef.current, 0) : 0);

      if (remaining === 0) {
        window.clearInterval(intervalId);
        handleTimeoutReached();
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [overtimeMode, timerRunning, totalDurationMs]);

  useEffect(() => {
    if (!pendingSubmit || !session.timerRuntime) {
      return;
    }

    const runtimePending = session.timerRuntime.pendingSubmit;
    const sameDraft = session.timerRuntime.unfinishedQuestionsDraft === unfinishedQuestions;
    const runtimeByPartDraft = normalizeReadingPartDistribution(session.timerRuntime.unfinishedByPartDraft);
    const currentByPartDraft = normalizeReadingPartDistribution(unfinishedByPartDraft);
    const sameByPartDraft = READING_PARTS.every((part) => runtimeByPartDraft[part] === currentByPartDraft[part]);
    const samePending =
      runtimePending?.forcedSubmit === pendingSubmit.forcedSubmit &&
      runtimePending?.timedOut === pendingSubmit.timedOut;

    if (sameDraft && samePending && sameByPartDraft) {
      return;
    }

    syncPendingSubmitDraft();
  }, [pendingSubmit, session.timerRuntime, unfinishedByPartDraft, unfinishedQuestions]);

  const startTimer = () => {
    const now = getNow();

    startedAtRef.current = now;
    lapStartedAtRef.current = now;
    overtimeStartedAtRef.current = null;
    setTimeLeft(totalDurationMs);
    setCurrentLapLiveMs(0);
    setIsRunning(true);
    setReadingLapTimes({});
    setPendingSubmit(null);
    setShowTimeoutDialog(false);
    setIsOvertime(false);
    setOvertimeElapsedMs(0);
    setUnfinishedQuestions('');
    setUnfinishedByPartDraft({});

    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes: {},
      timerSummary: undefined,
      timerRuntime: {
        startedAt: new Date(now).toISOString(),
        lapStartedAt: new Date(now).toISOString(),
        currentLapIndex: currentLapIndex,
        readingLapTimes: {},
        unfinishedQuestionsDraft: '',
        unfinishedByPartDraft: {},
      },
    });

    trackUXEvent('timer_started', session.id);
  };

  const startBacklogResolutionTimer = () => {
    const now = getNow();
    const lockedUnfinished = Math.max(session.timerSummary?.unfinishedQuestions ?? 0, 0);
    const summaryDistribution = normalizeReadingPartDistribution(session.timerSummary?.unfinishedByPart);
    const inferredDistribution = sumReadingPartDistribution(summaryDistribution) > 0
      ? summaryDistribution
      : inferReadingUnfinishedDistribution(buildInferenceRecord(), lockedUnfinished).distribution;
    const lockedDistribution = normalizeReadingPartDistribution(inferredDistribution);
    const effectiveLockedUnfinished = Math.max(
      lockedUnfinished,
      sumReadingPartDistribution(lockedDistribution)
    );

    startedAtRef.current = toValidTime(session.timerSummary?.completedAt) ?? now;
    lapStartedAtRef.current = now;
      overtimeStartedAtRef.current = now;

    setTimeLeft(0);
    setIsRunning(true);
    setIsOvertime(true);
    setOvertimeElapsedMs(0);
    setPendingSubmit(null);
    setShowTimeoutDialog(false);
    setUnfinishedQuestions(String(effectiveLockedUnfinished));
    setUnfinishedByPartDraft(lockedDistribution);

    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes,
      timerRuntime: {
        startedAt: new Date(startedAtRef.current).toISOString(),
        lapStartedAt: new Date(now).toISOString(),
        currentLapIndex: currentLapIndex,
        readingLapTimes,
        unfinishedQuestionsDraft: String(effectiveLockedUnfinished),
        unfinishedByPartDraft: lockedDistribution,
        timeLeftMs: 0,
        isOvertime: true,
        overtimeStartedAt: new Date(now).toISOString(),
        overtimeElapsedMs: 0,
      },
    });

    trackUXEvent('overtime_start', session.id);
  };

  const submitForced = () => {
    if (isListening) {
      commitStrictAttempt({ forcedSubmit: true, timedOut: false, unfinishedCount: 0 });
      return;
    }

    const finalTimes = stopAndFlushLapTime();
    const nextPending = { forcedSubmit: true, timedOut: false } satisfies PendingSubmit;
    setIsRunning(false);
    setPendingSubmit(nextPending);
    persistRuntime({ pendingSubmit: nextPending, timeLeftMs: timeLeft }, finalTimes);
  };

  const strictSubmitFromPending = () => {
    if (!pendingSubmit) {
      return;
    }

    const inputCount = Number(unfinishedQuestions);
    if (Number.isNaN(inputCount) || inputCount < 0) {
      return;
    }

    const unresolved = deriveUnfinishedSubmission(inputCount);
    setUnfinishedQuestions(String(unresolved.unfinishedCount));
    setUnfinishedByPartDraft(unresolved.unfinishedByPart ?? {});

    commitStrictAttempt({
      ...pendingSubmit,
      unfinishedCount: unresolved.unfinishedCount,
      unfinishedByPart: unresolved.unfinishedByPart,
      unfinishedByPartMeta: unresolved.unfinishedByPartMeta,
    });
  };

  const startOvertime = () => {
    const inputCount = Number(unfinishedQuestions);
    if (Number.isNaN(inputCount) || inputCount < 0) {
      return;
    }

    const unresolved = deriveUnfinishedSubmission(inputCount);
    setUnfinishedQuestions(String(unresolved.unfinishedCount));
    setUnfinishedByPartDraft(unresolved.unfinishedByPart ?? {});

    const now = getNow();
    const strictSummary = {
      totalElapsedMs: totalDurationMs,
      forcedSubmit: true,
      timedOut: unresolved.unfinishedCount > 0,
      unfinishedQuestions: unresolved.unfinishedCount,
      resolvedUnfinished: unresolved.unfinishedCount === 0,
      unfinishedByPart: unresolved.unfinishedByPart,
      unfinishedByPartMeta: unresolved.unfinishedByPartMeta,
      completedAt: new Date().toISOString(),
    };

    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes,
      timerSummary: strictSummary,
      timerRuntime: {
        startedAt: new Date(startedAtRef.current ?? now).toISOString(),
        lapStartedAt: new Date(now).toISOString(),
        currentLapIndex: currentLapIndex,
        readingLapTimes,
        unfinishedQuestionsDraft: String(unresolved.unfinishedCount),
        unfinishedByPartDraft: unresolved.unfinishedByPart,
        timeLeftMs: 0,
        isOvertime: true,
        overtimeStartedAt: new Date(now).toISOString(),
        overtimeElapsedMs: 0,
      },
    });

    lapStartedAtRef.current = now;
    overtimeStartedAtRef.current = now;
    setIsOvertime(true);
    setIsRunning(true);
    setPendingSubmit(null);
    setShowTimeoutDialog(false);
    setTimeLeft(0);
    setOvertimeElapsedMs(0);
  };

  // Not finishing the leftovers: count them as wrong in the "with enough time" score as well, so it stays honest.
  const skipBacklog = () => {
    const summaryDistribution = normalizeReadingPartDistribution(session.timerSummary?.unfinishedByPart);
    const leftovers = sumReadingPartDistribution(summaryDistribution) > 0
      ? summaryDistribution
      : normalizeReadingPartDistribution(inferReadingUnfinishedDistribution(session, backlogCount).distribution);

    saveOvertimeDiagnostics(session.id, {
      overtimeMistakes: leftovers,
      resolvedUnfinished: true,
      overtimeElapsedMs: 0,
      status: 'debugged',
    });
    trackUXEvent('overtime_skipped', session.id);
    onBacklogSkipped?.(session.id);
  };

  const stopOvertimeTimer = () => {
    const finalElapsed = overtimeStartedAtRef.current
      ? Math.max(getNow() - overtimeStartedAtRef.current, 0)
      : overtimeElapsedMs;

    const finalLapTimes = stopAndFlushLapTime();

    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes: finalLapTimes,
      timerSummary: session.timerSummary
        ? {
            ...session.timerSummary,
            overtimeElapsedMs: finalElapsed,
          }
        : session.timerSummary,
      timerRuntime: undefined,
    });

    overtimeStartedAtRef.current = null;
    setIsRunning(false);
    setIsOvertime(false);
    setPendingSubmit(null);
    setShowTimeoutDialog(false);
    setTimeLeft(0);
    setOvertimeElapsedMs(finalElapsed);
    onStrictAttemptSaved?.(session.id);
    trackUXEvent('overtime_stopped', session.id);
  };

  // Optional per-Part breakdown of unanswered questions; collapsed by default since most people skip it.
  const renderUnfinishedByPart = (scope: 'pending' | 'dialog') => {
    if (!showByPart) {
      return (
        <button
          type="button"
          onClick={() => setShowByPart(true)}
          className="text-xs text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {locale === 'zh' ? '知道没做的题分别在哪个 Part？点这里细分（可选）' : 'Know which Parts they were in? Break it down (optional)'}
        </button>
      );
    }

    return (
      <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/60">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            {locale === 'zh' ? '没做的题在哪个 Part（不填会自动估算）' : 'Which Parts were unanswered (estimated if blank)'}
          </div>
          <button
            type="button"
            onClick={() => applySmartUnfinishedDistribution()}
            className="rounded-full border border-zinc-200/80 bg-white px-3 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            {locale === 'zh' ? '自动估算' : 'Estimate'}
          </button>
        </div>
        <div className={cn('grid grid-cols-2 gap-2', scope === 'pending' && 'sm:grid-cols-4')}>
          {READING_PARTS.map((part) => (
            <label key={`${scope}-${part}`} className="rounded-xl border border-zinc-200/80 bg-white/90 px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-900/90">
              <div className="mb-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">{translatePart(locale, part)}</div>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={unfinishedByPartDraft[part] ?? ''}
                onChange={(event) => updateUnfinishedByPart(part, event.target.value)}
                className="h-9 border-zinc-200/80 bg-white/80 text-center text-base font-semibold dark:border-zinc-700 dark:bg-zinc-950/80"
                placeholder="0"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          {locale === 'zh' ? `合计 ${unfinishedByPartTotal} 题` : `${unfinishedByPartTotal} in total`}
        </p>
      </div>
    );
  };

  const handleLapShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;

    const lastIndex = READING_LAP_SEGMENTS.length - 1;
    let targetIndex: number | null = null;
    if (event.key === ' ' || event.key === 'ArrowRight') {
      targetIndex = Math.min(currentLapIndex + 1, lastIndex);
    } else if (event.key === 'ArrowLeft') {
      targetIndex = Math.max(currentLapIndex - 1, 0);
    } else if (/^[1-4]$/.test(event.key)) {
      targetIndex = Number(event.key) - 1;
    }

    if (targetIndex === null) return;
    event.preventDefault();
    if (targetIndex !== currentLapIndex) {
      selectActiveLap(targetIndex);
    }
  });

  useEffect(() => {
    if (!timerRunning || overtimeMode) return;
    const onKeyDown = (event: KeyboardEvent) => handleLapShortcut(event);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [overtimeMode, timerRunning]);

  return (
    <div className="space-y-6">
      <motion.div
        layout
        className={cn(
          'relative overflow-hidden rounded-[36px] border p-6 sm:p-8 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]',
          timerRunning && !overtimeMode && (warning ? 'border-red-400/40 bg-red-50/60 dark:border-red-900/40 dark:bg-red-900/20' : 'border-amber-400/40 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/20'),
          overtimeMode
            ? 'border-red-500/40 bg-red-50/80 dark:border-red-900/50 dark:bg-red-900/30'
            : !timerRunning && !warning
              ? 'border-zinc-200/50 bg-white/60 dark:border-white/10 dark:bg-zinc-900/60'
              : ''
        )}
      >
        <div className="flex items-center justify-between gap-2 relative z-10">
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {timerRunning && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className={cn(
                    'flex size-2.5 rounded-full',
                    overtimeMode ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse'
                  )}
                />
              )}
            </AnimatePresence>
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.26em] text-zinc-500 dark:text-zinc-400">
              {overtimeMode
                ? locale === 'zh'
                  ? '补做没做完的题'
                  : 'Reading Overtime'
                : isListening
                  ? copy.strictListeningMode
                  : copy.strictReadingMode}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {timerRunning && (
              <motion.span 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] shadow-sm',
                  overtimeMode
                    ? 'border-red-200 bg-red-100 text-red-600 dark:border-red-900/50 dark:bg-red-900/50 dark:text-red-400'
                    : 'border-emerald-200 bg-emerald-100 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-900/50 dark:text-emerald-400'
                )}>
                {overtimeMode ? (locale === 'zh' ? '补做中' : 'Finishing') : copy.runningNow}
              </motion.span>
            )}
          </div>
        </div>

        {/* With leftovers waiting for a decision, a frozen red 00:00 only reads as an error, so hide it. */}
        {!(unresolvedBacklog && !timerRunning) && (
        <motion.div
          layout
          className={cn(
            'mt-6 font-mono text-[5.5rem] font-bold tracking-tighter tabular-nums leading-none text-center',
            overtimeMode
              ? 'text-red-500 dark:text-red-400'
              : warning
                ? 'text-red-500 dark:text-red-400'
                : 'text-zinc-900 dark:text-zinc-50'
          )}
        >
          {overtimeMode ? `+${formatClock(overtimeElapsedMs)}` : formatClock(timeLeft)}
        </motion.div>
        )}

        <div className="mt-8 flex flex-col items-center gap-4 relative z-10">
          {!timerRunning && !pendingSubmit && !overtimeMode && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Button
                onClick={
                  unresolvedBacklog
                    ? startBacklogResolutionTimer
                    : session.timerSummary
                      ? () => restartConfirm.trigger(startTimer)
                      : startTimer
                }
                size="lg"
                className={cn(
                  'h-14 rounded-full px-8 text-base font-semibold shadow-xl transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96]',
                  unresolvedBacklog
                    ? 'bg-amber-500 text-white hover:bg-amber-600 dark:text-zinc-950'
                    : isListening
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200'
                )}
              >
                {unresolvedBacklog ? <Clock3 className="mr-2 size-5" /> : <Play className="mr-2 size-5 fill-current" />}
                {unresolvedBacklog
                  ? (locale === 'zh' ? `继续做完这 ${backlogCount} 题` : `Finish these ${backlogCount}`)
                  : session.timerSummary
                    ? restartConfirm.armed
                      ? (locale === 'zh' ? '再点一次：覆盖上次计时' : 'Tap again to overwrite last run')
                      : copy.restartStrictAttempt
                    : copy.startStrictAttempt}
              </Button>
              {unresolvedBacklog && (
                <button
                  type="button"
                  onClick={skipBacklog}
                  className="mt-3 block w-full text-center text-sm text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {locale === 'zh' ? '跳过，不补做了' : 'Skip, I won\'t finish them'}
                </button>
              )}
            </motion.div>
          )}

          {timerRunning && !overtimeMode && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex w-full sm:w-auto items-center justify-center">
                              <Button
                 variant="outline"
                 size="lg"
                 id="submit-test-btn"
                 onClick={submitForced}
                 className="h-16 px-10 rounded-full border-red-200 bg-white/70 text-red-600 shadow-[0_8px_24px_rgba(239,68,68,0.15)] backdrop-blur-md hover:bg-white dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96]"
               >
                 <CheckCircle2 className="mr-2 size-5" />
                 <span className="font-bold text-lg tracking-wide">{locale === 'zh' ? '交卷' : 'Submit Test'}</span>
               </Button>
            </motion.div>
          )}

          {timerRunning && overtimeMode && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex w-full sm:w-auto items-center justify-center">
              <Button
                size="lg"
                onClick={stopOvertimeTimer}
                className="h-14 rounded-full bg-red-500 text-white hover:bg-red-600 px-8 text-base font-semibold shadow-xl transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96]"
              >
                <CheckCircle2 className="mr-2 size-5" />
                {locale === 'zh' ? '做完了' : 'Done'}
              </Button>
            </motion.div>
          )}
        </div>

        {/* Ambient progress indicator in background */}
        {timerRunning && (
          <div className="absolute inset-0 pointer-events-none z-0 opacity-10 overflow-hidden rounded-[36px]">
             <div 
               className={cn("h-full w-full bg-linear-to-t transition-all duration-1000 ease-linear", overtimeMode ? "from-red-500 to-transparent" : warning ? "from-red-500 to-transparent" : "from-amber-400 to-transparent")}
               style={{ transform: `translateY(${100 - progressValue}%)` }}
             />
          </div>
        )}
      </motion.div>

      {!isListening && !unresolvedBacklog && !overtimeMode && (
        <div className="rounded-[32px] border border-zinc-200/50 bg-white/40 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/40">
          <div className="flex items-start justify-between gap-3">
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              {copy.readingLapSequence}
            </div>
            <div className="rounded-full bg-zinc-100 px-3 py-1 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {copy.doneCount(completedLapCount, 4)}
            </div>
          </div>
          <div className="mt-2.5 text-[12px] text-zinc-500 dark:text-zinc-400 mb-5">
            {locale === 'zh'
              ? timerRunning
                ? '点击卡片或按 空格 / → 切到下一题型，1–4 直接跳转；系统自动累计耗时，完成后点“交卷”。'
                : pendingSubmit
                  ? '各 Part 的用时已记录。'
                  : '一般从 Part 5 开始。习惯先做别的 Part？先点那张卡片，再点「开始计时」。'
              : timerRunning
                ? 'Tap a card or press Space / → for the next part, 1–4 to jump. Time accrues automatically; tap Submit when done.'
                : pendingSubmit
                  ? 'Time per Part has been recorded.'
                  : 'Most people start with Part 5. Prefer another order? Tap that card first, then Start.'}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {READING_LAP_SEGMENTS.map((segment, index) => {
              const completed = readingLapTimes[segment.key] !== undefined;
              const active = timerRunning && !overtimeMode && currentLapIndex === index;
              const preselected = !timerRunning && !overtimeMode && !pendingSubmit && currentLapIndex === index;
              const stored = session.readingLapTimes[segment.key];
              const liveLapMs = (readingLapTimes[segment.key] ?? 0) + (active ? currentLapLiveMs : 0);

              return (
                                <button
                  type="button"
                  key={segment.key}
                  id={`segment-btn-${index}`}
                  onClick={(event) => {
                    selectActiveLap(index);
                    // Hand focus back to the page so Space advances via the shortcut, not by re-clicking this card.
                    if (timerRunning) event.currentTarget.blur();
                  }}
                  aria-pressed={active || preselected}

                  className={cn(
                    'relative overflow-hidden rounded-[24px] border p-4 transition-all duration-300 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50/50 dark:focus-visible:ring-offset-zinc-900',
                    completed
                      ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-900/10 focus-visible:ring-emerald-400/50'
                      : active
                        ? 'border-amber-400/50 bg-amber-50 shadow-md scale-[1.02] dark:border-amber-500/30 dark:bg-amber-900/20 focus-visible:ring-amber-400/50'
                        : preselected
                          ? 'border-sky-300/70 bg-sky-50/70 dark:border-sky-700/70 dark:bg-sky-900/20 focus-visible:ring-sky-400/50'
                        : 'border-zinc-200/50 bg-white/50 dark:border-white/5 dark:bg-zinc-900/50 opacity-70 hover:opacity-100 hover:border-zinc-300/70 hover:dark:border-white/15 focus-visible:ring-zinc-400/50 focus-visible:opacity-100'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className={cn("font-mono text-[10px] font-semibold tracking-wider", completed ? "text-emerald-600 dark:text-emerald-400" : active ? "text-amber-600 dark:text-amber-400" : preselected ? "text-sky-600 dark:text-sky-400" : "text-zinc-400 dark:text-zinc-500")}>{segment.shortLabel}</div>
                    <div className="flex items-center gap-1.5">
                      {(active || preselected) && (
                        <span className={cn(
                          'rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider',
                          active
                            ? 'border-amber-300/70 bg-amber-100/80 text-amber-700 dark:border-amber-700/70 dark:bg-amber-900/40 dark:text-amber-200'
                            : 'border-sky-300/70 bg-sky-100/80 text-sky-700 dark:border-sky-700/70 dark:bg-sky-900/40 dark:text-sky-200'
                        )}>
                          {active
                            ? (locale === 'zh' ? '当前' : 'Now')
                            : (locale === 'zh' ? '起点' : 'Start')}
                        </span>
                      )}
                      <div className="font-mono text-[10px] text-zinc-400">
                        {segment.baselineMinutes}m
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">{translatePart(locale, segment.key)}</div>
                  <div className={cn(
                    'mt-3 font-mono text-[11px] font-medium',
                    active
                      ? liveLapMs > segment.baselineMinutes * 60_000
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-amber-700 dark:text-amber-300'
                      : completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'
                  )}>
                    {active
                      ? `${formatClock(liveLapMs)} / ${segment.baselineMinutes}:00`
                      : completed
                      ? copy.thisRun(formatMinutes(readingLapTimes[segment.key]))
                      : stored !== undefined
                        ? copy.lastRun(formatMinutes(stored))
                        : copy.awaitingCapture}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {pendingSubmit && !showTimeoutDialog && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[32px] border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-900/30 dark:bg-red-900/10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400">
              <AlertTriangle className="size-6" />
            </div>
            <div className="flex-1">
              <div className="text-base font-semibold text-red-800 dark:text-red-300">
                {pendingSubmit.timedOut ? copy.timeoutFrozen : copy.forcedEnded}
              </div>
              <p className="mt-1 text-sm text-red-600/80 dark:text-red-400/80">
                {copy.pendingSubmitBody}
              </p>
            </div>
            <div className="flex w-full sm:w-auto items-center gap-2 bg-white dark:bg-zinc-950 p-1.5 rounded-full shadow-sm border border-zinc-200 dark:border-zinc-800">
              <Input
                type="number"
                min="0"
                inputMode="numeric"
                aria-label={locale === 'zh' ? '未完题数' : 'Unfinished count'}
                value={unfinishedQuestions}
                onChange={(event) => updateUnfinishedQuestionsInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    strictSubmitFromPending();
                  }
                }}
                className="h-11 w-24 border-0 bg-transparent text-center text-lg font-semibold focus-visible:ring-0"
                placeholder={copy.unfinishedPlaceholder}
              />
              <Button size="lg" onClick={strictSubmitFromPending} className="rounded-full bg-red-500 text-white hover:bg-red-600">
                {copy.saveSubmitData}
              </Button>
            </div>
          </div>

          <div className="mt-4">{renderUnfinishedByPart('pending')}</div>
        </motion.div>
      )}

      {(overtimeMode || unresolvedBacklog) && (
        <div className="rounded-[32px] border border-amber-300/50 bg-amber-50/60 p-6 backdrop-blur-sm dark:border-amber-900/40 dark:bg-amber-900/10">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              <Clock3 className="size-5" />
            </div>
            <div>
              <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {overtimeMode
                  ? (locale === 'zh' ? `正在补做剩下的 ${backlogCount} 题` : `Finishing the remaining ${backlogCount}`)
                  : (locale === 'zh' ? `还有 ${backlogCount} 题没做完` : `${backlogCount} questions left unanswered`)}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {overtimeMode
                  ? (locale === 'zh'
                    ? '做完点「做完了」，再填补做的题错了几题。这段时间不影响按考试规则算的分数。'
                    : 'Tap "Done" when finished, then enter how many of them were wrong. This does not change your score under real test rules.')
                  : (locale === 'zh'
                    ? '按考试规则，它们已经算作错题。想知道时间够的话能拿几分，可以继续做完（单独计时）；不想补也可以跳过。'
                    : 'Under real test rules they already count as wrong. To see your score with enough time, finish them on a separate clock — or just skip.')}
              </p>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showTimeoutDialog} onOpenChange={setShowTimeoutDialog}>
        <DialogContent showCloseButton={false} className="max-w-md rounded-[36px] border border-white/40 bg-white/95 p-0 shadow-[0_32px_120px_rgba(0,0,0,0.15)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/95 dark:shadow-[0_32px_120px_rgba(0,0,0,0.5)] overflow-hidden">
          <DialogHeader className="px-8 pt-8 text-center flex flex-col items-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400">
              <AlertTriangle className="size-8" />
            </div>
            <DialogTitle className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {locale === 'zh' ? '时间到！' : 'Time is up!'}
            </DialogTitle>
            <DialogDescription className="mt-3 text-base text-zinc-500 dark:text-zinc-400">
              {locale === 'zh'
                ? '还有几题没来得及做？全部做完就填 0。'
                : 'How many questions did you not get to? Enter 0 if you finished.'}
            </DialogDescription>
          </DialogHeader>

          <div className="px-8 pb-8 pt-6">
            <div className="mx-auto flex max-w-50 flex-col items-center">
               <Input
                 type="number"
                 min="0"
                 inputMode="numeric"
                 aria-label={locale === 'zh' ? '未完题数' : 'Unfinished count'}
                 value={unfinishedQuestions}
                 onChange={(event) => updateUnfinishedQuestionsInput(event.target.value)}
                 onKeyDown={(event) => {
                   if (event.key === 'Enter') {
                     event.preventDefault();
                     strictSubmitFromPending();
                   }
                 }}
                 className="h-16 text-center text-3xl font-semibold bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border-zinc-200 dark:border-zinc-800"
                 placeholder="0"
                 autoFocus
               />
               <span className="mt-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">{locale === 'zh' ? '未完题数' : 'Unfinished Count'}</span>
            </div>

            <div className="mt-5">{renderUnfinishedByPart('dialog')}</div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-zinc-200/50 dark:bg-zinc-800/50 border-t border-zinc-200/50 dark:border-zinc-800/50">
            <button
              type="button"
              onClick={strictSubmitFromPending}
              className="bg-white/80 py-5 text-base font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {locale === 'zh' ? '交卷' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={startOvertime}
              className="bg-white/80 py-5 text-base font-semibold text-red-600 transition-colors hover:bg-red-50 dark:bg-zinc-900/80 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {locale === 'zh' ? '继续做完（单独计时）' : 'Keep going (timed separately)'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}