'use client';

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Flag, Play, ShieldAlert } from 'lucide-react';
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
  READING_LAP_SEGMENTS,
  formatClock,
  formatMinutes,
  getTargetDurationMs,
  hasResolvedUnfinished,
  type ReadingLapKey,
  type SessionRecord,
} from '@/lib/toeic';
import { trackUXEvent } from '@/lib/uxEvent';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

type PendingSubmit = {
  forcedSubmit: boolean;
  timedOut: boolean;
};

type LapUndoState = {
  previousLapTimes: Partial<Record<ReadingLapKey, number>>;
  previousLapIndex: number;
  previousLapStartedAtMs: number;
  capturedLapKey: ReadingLapKey;
};

type InitialTimerState = {
  timeLeft: number;
  isRunning: boolean;
  readingLapTimes: Partial<Record<ReadingLapKey, number>>;
  currentLapIndex: number;
  unfinishedQuestions: string;
  pendingSubmit: PendingSubmit | null;
  startedAtMs: number | null;
  lapStartedAtMs: number | null;
  isOvertime: boolean;
  overtimeStartedAtMs: number | null;
  overtimeElapsedMs: number;
  showTimeoutDialog: boolean;
};

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

  if (!runtime) {
    return {
      timeLeft: unresolvedBacklog ? 0 : totalDurationMs,
      isRunning: false,
      readingLapTimes: {},
      currentLapIndex: 0,
      unfinishedQuestions: unfinishedDraft,
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
    : Math.max(totalDurationMs - (Date.now() - startedAtMs), 0);
  const pendingSubmit = runtime.pendingSubmit ?? (session.type === 'R' && restoredTimeLeft <= 0
    ? { forcedSubmit: true, timedOut: true }
    : null);

  return {
    timeLeft: restoredTimeLeft,
    isRunning: restoredTimeLeft > 0 && !pendingSubmit,
    readingLapTimes: runtime.readingLapTimes,
    currentLapIndex: runtime.currentLapIndex,
    unfinishedQuestions: unfinishedDraft,
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
    return startMs ? Math.max(Date.now() - startMs, 0) : 0;
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
    const now = Date.now();
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

  // Tick
  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => {
      const start = startedAtRef.current;
      setElapsedMs(start ? Date.now() - start : 0);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isActive]);

  const elapsedFormatted = formatClock(elapsedMs);
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
              ? (locale === 'zh' ? '跟着音频走' : 'Follow the audio')
              : (locale === 'zh' ? '听力模式' : 'Listening Mode')}
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
            ? '以音频为节奏，不需要严格计时。完成后点击下方按钮进入复盘。'
            : 'Let the audio set the pace. No strict timing needed. Tap below when done.'}
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
          {locale === 'zh' ? '标记完成，进入复盘' : 'Mark Complete — Go to Review'}
        </motion.button>
      )}

      {!isActive && hasPrevious && (
        <motion.button
          type="button"
          onClick={handleComplete}
          disabled={isSubmitting}
          whileTap={{ scale: 0.97 }}
          className="flex w-full items-center justify-center gap-2.5 rounded-full bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-[0_4px_14px_rgba(16,185,129,0.30)] transition-all hover:shadow-[0_6px_20px_rgba(16,185,129,0.40)] hover:brightness-110 disabled:opacity-60"
        >
          <CheckCircle2 className="size-4" />
          {locale === 'zh' ? '继续进入复盘' : 'Continue to Review'}
        </motion.button>
      )}

      {!isActive && !hasPrevious && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleComplete}
            className="text-xs text-(--label-tertiary) underline-offset-2 hover:underline hover:text-(--label-secondary) transition-colors"
          >
            {locale === 'zh' ? '跳过计时，直接进入复盘' : 'Skip stopwatch and go to review'}
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
}: {
  session: SessionRecord;
  onFocusModeChange?: (enabled: boolean) => void;
  onStrictAttemptSaved?: (sessionId: string) => void;
}) {
  // Route listening sessions to the simplified flow
  if (session.type === 'L') {
    return <ListeningFlow session={session} onStrictAttemptSaved={onStrictAttemptSaved} />;
  }

  return <ReadingTimer session={session} onFocusModeChange={onFocusModeChange} onStrictAttemptSaved={onStrictAttemptSaved} />;
}

function ReadingTimer({
  session,
  onFocusModeChange,
  onStrictAttemptSaved,
}: {
  session: SessionRecord;
  onFocusModeChange?: (enabled: boolean) => void;
  onStrictAttemptSaved?: (sessionId: string) => void;
}) {
  const patchSession = useStore((state) => state.patchSession);
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
  const [pendingSubmit, setPendingSubmit] = useState<PendingSubmit | null>(initialState.pendingSubmit);
  const [isOvertime, setIsOvertime] = useState(initialState.isOvertime);
  const [overtimeElapsedMs, setOvertimeElapsedMs] = useState(initialState.overtimeElapsedMs);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(initialState.showTimeoutDialog);
  const [lapUndo, setLapUndo] = useState<LapUndoState | null>(null);

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
  const progressValue = overtimeMode ? 100 : ((totalDurationMs - timeLeft) / totalDurationMs) * 100;
  const unresolvedBacklog = session.type === 'R' && (session.timerSummary?.unfinishedQuestions ?? 0) > 0 && !hasResolvedUnfinished(session);

  function persistRuntime(next: Partial<NonNullable<SessionRecord['timerRuntime']>>) {
    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes,
      timerRuntime: {
        startedAt: new Date(startedAtRef.current ?? Date.now()).toISOString(),
        lapStartedAt: lapStartedAtRef.current ? new Date(lapStartedAtRef.current).toISOString() : undefined,
        currentLapIndex,
        readingLapTimes,
        unfinishedQuestionsDraft: unfinishedQuestions,
        timeLeftMs: Math.max(timeLeft, 0),
        ...session.timerRuntime,
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
    setLapUndo(null);
  }

  function commitStrictAttempt(options: PendingSubmit & {
    unfinishedCount: number;
    readingLapTimesOverride?: Partial<Record<ReadingLapKey, number>>;
    keepOvertimeRuntime?: boolean;
  }) {
    const nextReadingLapTimes = isListening ? session.readingLapTimes : (options.readingLapTimesOverride ?? readingLapTimes);
    const elapsedMs = options.timedOut
      ? totalDurationMs
      : startedAtRef.current
        ? Math.min(Math.max(Date.now() - startedAtRef.current, 0), totalDurationMs)
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
        overtimeElapsedMs: session.timerSummary?.overtimeElapsedMs,
        completedAt: new Date().toISOString(),
      },
      timerRuntime: options.keepOvertimeRuntime ? session.timerRuntime : undefined,
    });

    if (!options.keepOvertimeRuntime) {
      resetLocalTimerState();
      setTimeLeft(totalDurationMs);
      setUnfinishedQuestions(options.unfinishedCount > 0 ? String(options.unfinishedCount) : '');
      onStrictAttemptSaved?.(session.id);
      trackUXEvent('strict_attempt_saved', session.id);
    }
  }

  useEffect(() => {
    onFocusModeChange?.(timerRunning && !overtimeMode);
  }, [onFocusModeChange, overtimeMode, timerRunning]);

  useEffect(() => {
    if (!lapUndo) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLapUndo(null);
    }, 6000);

    return () => window.clearTimeout(timeoutId);
  }, [lapUndo]);

  const handleTimeoutReached = useEffectEvent(() => {
    if (isListening) {
      commitStrictAttempt({ forcedSubmit: true, timedOut: false, unfinishedCount: 0 });
      return;
    }

    const nextPending = { forcedSubmit: true, timedOut: true } satisfies PendingSubmit;
    setIsRunning(false);
    setPendingSubmit(nextPending);
    setShowTimeoutDialog(true);
    setTimeLeft(0);
    persistRuntime({ pendingSubmit: nextPending, timeLeftMs: 0 });
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

        setOvertimeElapsedMs(Math.max(Date.now() - overtimeStartedAtRef.current, 0));
        return;
      }

      if (!startedAtRef.current) {
        return;
      }

      const remaining = Math.max(totalDurationMs - (Date.now() - startedAtRef.current), 0);
      setTimeLeft(remaining);

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
    const samePending =
      runtimePending?.forcedSubmit === pendingSubmit.forcedSubmit &&
      runtimePending?.timedOut === pendingSubmit.timedOut;

    if (sameDraft && samePending) {
      return;
    }

    syncPendingSubmitDraft();
  }, [pendingSubmit, session.timerRuntime, unfinishedQuestions]);

  const startTimer = () => {
    const now = Date.now();

    startedAtRef.current = now;
    lapStartedAtRef.current = now;
    overtimeStartedAtRef.current = null;
    setTimeLeft(totalDurationMs);
    setIsRunning(true);
    setReadingLapTimes({});
    setCurrentLapIndex(0);
    setPendingSubmit(null);
    setShowTimeoutDialog(false);
    setIsOvertime(false);
    setOvertimeElapsedMs(0);
    setUnfinishedQuestions('');
    setLapUndo(null);

    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes: {},
      timerSummary: undefined,
      timerRuntime: {
        startedAt: new Date(now).toISOString(),
        lapStartedAt: new Date(now).toISOString(),
        currentLapIndex: 0,
        readingLapTimes: {},
        unfinishedQuestionsDraft: '',
      },
    });

    trackUXEvent('timer_started', session.id);
  };

  const startBacklogResolutionTimer = () => {
    const now = Date.now();
    const lockedUnfinished = Math.max(session.timerSummary?.unfinishedQuestions ?? 0, 0);

    startedAtRef.current = toValidTime(session.timerSummary?.completedAt) ?? now;
    lapStartedAtRef.current = null;
    overtimeStartedAtRef.current = now;

    setTimeLeft(0);
    setIsRunning(true);
    setIsOvertime(true);
    setOvertimeElapsedMs(0);
    setPendingSubmit(null);
    setShowTimeoutDialog(false);
    setLapUndo(null);
    setUnfinishedQuestions(String(lockedUnfinished));

    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes,
      timerRuntime: {
        startedAt: new Date(startedAtRef.current).toISOString(),
        lapStartedAt: undefined,
        currentLapIndex,
        readingLapTimes,
        unfinishedQuestionsDraft: String(lockedUnfinished),
        timeLeftMs: 0,
        isOvertime: true,
        overtimeStartedAt: new Date(now).toISOString(),
        overtimeElapsedMs: 0,
      },
    });

    trackUXEvent('overtime_start', session.id);
  };

  const captureLap = () => {
    if (!currentSegment || !lapStartedAtRef.current) {
      return;
    }

    // Removed secondary confirmation for final lap to ensure precise timing
    /* if (currentLapIndex === READING_LAP_SEGMENTS.length - 1 && !awaitingFinalConfirm) {
      setAwaitingFinalConfirm(true);
      return;
    } */

    const now = Date.now();
    const lapElapsed = now - lapStartedAtRef.current;
    const nextLapTimes = {
      ...readingLapTimes,
      [currentSegment.key]: lapElapsed,
    };

    setReadingLapTimes(nextLapTimes);

    if (currentLapIndex === READING_LAP_SEGMENTS.length - 1) {
      setLapUndo(null);
      patchSession(session.id, {
        status: 'in-progress',
        readingLapTimes: nextLapTimes,
      });
      commitStrictAttempt({
        forcedSubmit: false,
        timedOut: false,
        unfinishedCount: 0,
        readingLapTimesOverride: nextLapTimes,
      });
      return;
    }

    setLapUndo({
      previousLapTimes: readingLapTimes,
      previousLapIndex: currentLapIndex,
      previousLapStartedAtMs: lapStartedAtRef.current,
      capturedLapKey: currentSegment.key,
    });

    lapStartedAtRef.current = now;
    setCurrentLapIndex((value) => value + 1);
    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes: nextLapTimes,
      timerRuntime: {
        startedAt: new Date(startedAtRef.current ?? now).toISOString(),
        lapStartedAt: new Date(now).toISOString(),
        currentLapIndex: currentLapIndex + 1,
        readingLapTimes: nextLapTimes,
        unfinishedQuestionsDraft: unfinishedQuestions,
      },
    });
  };

  const undoLastLapCapture = () => {
    if (!lapUndo || !timerRunning || overtimeMode) {
      return;
    }

    setReadingLapTimes(lapUndo.previousLapTimes);
    setCurrentLapIndex(lapUndo.previousLapIndex);
    lapStartedAtRef.current = lapUndo.previousLapStartedAtMs;
    setLapUndo(null);

    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes: lapUndo.previousLapTimes,
      timerRuntime: {
        startedAt: new Date(startedAtRef.current ?? Date.now()).toISOString(),
        lapStartedAt: new Date(lapUndo.previousLapStartedAtMs).toISOString(),
        currentLapIndex: lapUndo.previousLapIndex,
        readingLapTimes: lapUndo.previousLapTimes,
        unfinishedQuestionsDraft: unfinishedQuestions,
        timeLeftMs: Math.max(timeLeft, 0),
      },
    });
  };

  const submitForced = () => {
    if (isListening) {
      commitStrictAttempt({ forcedSubmit: true, timedOut: false, unfinishedCount: 0 });
      return;
    }

    const nextPending = { forcedSubmit: true, timedOut: false } satisfies PendingSubmit;
    setIsRunning(false);
    setLapUndo(null);
    setPendingSubmit(nextPending);
    persistRuntime({ pendingSubmit: nextPending, timeLeftMs: timeLeft });
  };

  const strictSubmitFromPending = () => {
    if (!pendingSubmit) {
      return;
    }

    const unfinishedCount = Number(unfinishedQuestions);
    if (Number.isNaN(unfinishedCount) || unfinishedCount < 0) {
      return;
    }

    commitStrictAttempt({ ...pendingSubmit, unfinishedCount });
  };

  const startOvertime = () => {
    const unfinishedCount = Number(unfinishedQuestions);
    if (Number.isNaN(unfinishedCount) || unfinishedCount < 0) {
      return;
    }

    const now = Date.now();
    const strictSummary = {
      totalElapsedMs: totalDurationMs,
      forcedSubmit: true,
      timedOut: unfinishedCount > 0,
      unfinishedQuestions: unfinishedCount,
      resolvedUnfinished: unfinishedCount === 0,
      completedAt: new Date().toISOString(),
    };

    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes,
      timerSummary: strictSummary,
      timerRuntime: {
        startedAt: new Date(startedAtRef.current ?? now).toISOString(),
        lapStartedAt: lapStartedAtRef.current ? new Date(lapStartedAtRef.current).toISOString() : undefined,
        currentLapIndex,
        readingLapTimes,
        unfinishedQuestionsDraft: String(unfinishedCount),
        timeLeftMs: 0,
        isOvertime: true,
        overtimeStartedAt: new Date(now).toISOString(),
        overtimeElapsedMs: 0,
      },
    });

    overtimeStartedAtRef.current = now;
    setIsOvertime(true);
    setIsRunning(true);
    setLapUndo(null);
    setPendingSubmit(null);
    setShowTimeoutDialog(false);
    setTimeLeft(0);
    setOvertimeElapsedMs(0);
  };

  const stopOvertimeTimer = () => {
    const finalElapsed = overtimeStartedAtRef.current
      ? Math.max(Date.now() - overtimeStartedAtRef.current, 0)
      : overtimeElapsedMs;

    patchSession(session.id, {
      status: 'in-progress',
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
    setLapUndo(null);
    onStrictAttemptSaved?.(session.id);
    trackUXEvent('overtime_stopped', session.id);
  };

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
                  ? '阅读加时赛'
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
                {overtimeMode ? (locale === 'zh' ? '补录中' : 'Resolving') : copy.runningNow}
              </motion.span>
            )}
          </div>
        </div>

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

        <div className="mt-8 flex flex-col items-center gap-4 relative z-10">
          {!timerRunning && !pendingSubmit && !overtimeMode && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Button
                onClick={unresolvedBacklog ? startBacklogResolutionTimer : startTimer}
                size="lg"
                className={cn(
                  'h-14 rounded-full px-8 text-base font-semibold shadow-xl transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96]',
                  unresolvedBacklog
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : isListening
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200'
                )}
              >
                {unresolvedBacklog ? <Clock3 className="mr-2 size-5" /> : <Play className="mr-2 size-5 fill-current" />}
                {unresolvedBacklog
                  ? (locale === 'zh' ? '开始补录计时' : 'Start Overtime Timer')
                  : session.timerSummary
                    ? copy.restartStrictAttempt
                    : copy.startStrictAttempt}
              </Button>
            </motion.div>
          )}

          {timerRunning && !overtimeMode && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
               {!isListening && currentSegment && (
                 <Button
                    size="lg"
                    onClick={captureLap}
                     className={cn(
                       'h-16 w-full sm:w-64 rounded-full text-lg font-semibold shadow-xl transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96]',
                       currentLapIndex === READING_LAP_SEGMENTS.length - 1
                         ? 'bg-amber-500 text-amber-950 hover:bg-amber-600'
                         : 'bg-amber-400 text-amber-950 hover:bg-amber-500'
                     )}
                 >
                    {currentLapIndex === READING_LAP_SEGMENTS.length - 1 ? (
                      <>
                        <CheckCircle2 className="mr-2 size-5" />
                        {copy.lapAction(currentSegment.shortLabel)}
                      </>
                    ) : (
                      <>
                        <Flag className="mr-2 size-5 fill-current" />
                        {copy.lapAction(currentSegment.shortLabel)}
                      </>
                    )}
                 </Button>
               )}
               
               <div className="flex gap-2">
                 
                 
                 <Button
                   variant="outline"
                   size="lg"
                   onClick={submitForced}
                   className="h-16 rounded-full border-red-200 bg-red-50/50 text-red-600 backdrop-blur-md hover:bg-red-100/80 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96]"
                 >
                   <ShieldAlert className="size-5 sm:mr-2" />
                   <span className="hidden sm:inline">{copy.forceSubmit}</span>
                 </Button>
               </div>
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
                {locale === 'zh' ? '结束补录计时' : 'Stop Overtime Timer'}
              </Button>
            </motion.div>
          )}
        </div>

        <AnimatePresence>
          {lapUndo && !isListening && timerRunning && !overtimeMode && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mt-6 mx-auto flex max-w-sm items-center justify-between rounded-full border border-amber-200 bg-amber-50/90 px-4 py-3 shadow-lg backdrop-blur-xl relative z-20 dark:border-amber-900/50 dark:bg-amber-900/80"
            >
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {locale === 'zh'
                  ? `已记录 ${translatePart(locale, lapUndo.capturedLapKey)}`
                  : `Recorded ${translatePart(locale, lapUndo.capturedLapKey)}`}
              </span>
              <button
                type="button"
                onClick={undoLastLapCapture}
                className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-amber-600 shadow-sm transition-transform hover:scale-105 active:scale-95 dark:bg-amber-950 dark:text-amber-300"
              >
                {locale === 'zh' ? '撤销' : 'Undo'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
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

      {!isListening && (
        <div className="rounded-[32px] border border-zinc-200/50 bg-white/40 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/40">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              {copy.readingLapSequence}
            </div>
            <div className="rounded-full bg-zinc-100 px-3 py-1 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {copy.doneCount(completedLapCount, 4)}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {READING_LAP_SEGMENTS.map((segment, index) => {
              const completed = readingLapTimes[segment.key] !== undefined;
              const active = timerRunning && !overtimeMode && currentLapIndex === index;
              const stored = session.readingLapTimes[segment.key];

              return (
                <div
                  key={segment.key}
                  className={cn(
                    'relative overflow-hidden rounded-[24px] border p-4 transition-all duration-300',
                    completed
                      ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-900/10'
                      : active
                        ? 'border-amber-400/50 bg-amber-50 shadow-md scale-[1.02] dark:border-amber-500/30 dark:bg-amber-900/20'
                        : 'border-zinc-200/50 bg-white/50 dark:border-white/5 dark:bg-zinc-900/50 opacity-70'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className={cn("font-mono text-[10px] font-semibold tracking-wider", completed ? "text-emerald-600 dark:text-emerald-400" : active ? "text-amber-600 dark:text-amber-400" : "text-zinc-400 dark:text-zinc-500")}>{segment.shortLabel}</div>
                    <div className="font-mono text-[10px] text-zinc-400">
                       {segment.baselineMinutes}m
                    </div>
                  </div>
                  <div className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">{translatePart(locale, segment.key)}</div>
                  <div className={cn('mt-3 font-mono text-[11px] font-medium', completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500')}>
                    {completed
                      ? copy.thisRun(formatMinutes(readingLapTimes[segment.key]))
                      : stored !== undefined
                        ? copy.lastRun(formatMinutes(stored))
                        : copy.awaitingCapture}
                  </div>
                </div>
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
                value={unfinishedQuestions}
                onChange={(event) => setUnfinishedQuestions(event.target.value)}
                className="h-11 w-24 border-0 bg-transparent text-center text-lg font-semibold focus-visible:ring-0"
                placeholder={copy.unfinishedPlaceholder}
              />
              <Button size="lg" onClick={strictSubmitFromPending} className="rounded-full bg-red-500 text-white hover:bg-red-600">
                {copy.saveSubmitData}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {(overtimeMode || unresolvedBacklog) && (
        <div className="rounded-[32px] border border-red-200 bg-red-50/50 p-6 backdrop-blur-sm dark:border-red-900/30 dark:bg-red-900/10">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400">
              <Clock3 className="size-5" />
            </div>
            <div>
              <div className="text-base font-semibold text-red-800 dark:text-red-300">
                {locale === 'zh' ? '未完成补录模式已开启' : 'Overtime resolution mode is active'}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-red-600/80 dark:text-red-400/80">
                {locale === 'zh'
                  ? '严格分已经按照未完成题锁定。继续补做只会影响潜力分，不再反向污染严格模考分。'
                  : 'The strict score is already locked from the unfinished count. Any continued work now only affects the potential score, not the strict mock score.'}
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
              {locale === 'zh' ? '时间到' : 'Time is up'}
            </DialogTitle>
            <DialogDescription className="mt-3 text-base text-zinc-500 dark:text-zinc-400">
              {locale === 'zh'
                ? '严格模考分已锁定。你还有几题没有做完？'
                : 'Strict mock score locked. How many items are unfinished?'}
            </DialogDescription>
          </DialogHeader>

          <div className="px-8 pb-8 pt-6">
            <div className="mx-auto flex max-w-50 flex-col items-center">
               <Input
                 type="number"
                 min="0"
                 value={unfinishedQuestions}
                 onChange={(event) => setUnfinishedQuestions(event.target.value)}
                 className="h-16 text-center text-3xl font-semibold bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border-zinc-200 dark:border-zinc-800"
                 placeholder="0"
                 autoFocus
               />
               <span className="mt-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">{locale === 'zh' ? '未完题数' : 'Unfinished Count'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-zinc-200/50 dark:bg-zinc-800/50 border-t border-zinc-200/50 dark:border-zinc-800/50">
            <button 
              onClick={strictSubmitFromPending} 
              className="bg-white/80 py-5 text-base font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {locale === 'zh' ? '直接交卷' : 'Submit Now'}
            </button>
            <button 
              onClick={startOvertime} 
              className="bg-white/80 py-5 text-base font-semibold text-red-600 transition-colors hover:bg-red-50 dark:bg-zinc-900/80 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {locale === 'zh' ? '开启加时赛' : 'Start Overtime'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}