'use client';

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Clock3, Flag, Hourglass, Play, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { getCopy, translatePart } from '@/lib/i18n';
import {
  READING_LAP_SEGMENTS,
  formatClock,
  formatMinutes,
  getTargetDurationMs,
  hasResolvedUnfinished,
  sumReadingLapTimes,
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
  const unfinishedDraft = runtime?.unfinishedQuestionsDraft ?? (session.timerSummary?.unfinishedQuestions ? String(session.timerSummary.unfinishedQuestions) : '');

  if (!runtime) {
    return {
      timeLeft: totalDurationMs,
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

export function LapTimer({
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
  const lastReadingTotal = sumReadingLapTimes(session);

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
  const [awaitingFinalConfirm, setAwaitingFinalConfirm] = useState(false);

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
  const lastAttemptText = session.timerSummary
    ? `${formatMinutes(session.timerSummary.totalElapsedMs)} / ${copy.unfinished(session.timerSummary.unfinishedQuestions)}`
    : isListening
      ? copy.noListeningAttempt
      : lastReadingTotal > 0
        ? copy.savedReadingTime(formatMinutes(lastReadingTotal))
        : copy.noReadingAttempt;

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
    setAwaitingFinalConfirm(false);
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
    setAwaitingFinalConfirm(false);

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

  const captureLap = () => {
    if (!currentSegment || !lapStartedAtRef.current) {
      return;
    }

    if (currentLapIndex === READING_LAP_SEGMENTS.length - 1 && !awaitingFinalConfirm) {
      setAwaitingFinalConfirm(true);
      return;
    }

    const now = Date.now();
    const lapElapsed = now - lapStartedAtRef.current;
    const nextLapTimes = {
      ...readingLapTimes,
      [currentSegment.key]: lapElapsed,
    };

    setAwaitingFinalConfirm(false);

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
    setAwaitingFinalConfirm(false);

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

  const cancelFinalLapConfirm = () => {
    setAwaitingFinalConfirm(false);
  };

  const submitForced = () => {
    if (isListening) {
      commitStrictAttempt({ forcedSubmit: true, timedOut: false, unfinishedCount: 0 });
      return;
    }

    const nextPending = { forcedSubmit: true, timedOut: false } satisfies PendingSubmit;
    setIsRunning(false);
    setLapUndo(null);
    setAwaitingFinalConfirm(false);
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
    setAwaitingFinalConfirm(false);
    setPendingSubmit(null);
    setShowTimeoutDialog(false);
    setTimeLeft(0);
    setOvertimeElapsedMs(0);
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'relative overflow-hidden rounded-[26px] border p-5 transition-all duration-300 sm:p-6',
          timerRunning && !overtimeMode && (warning ? 'timer-glow-red' : 'timer-glow-amber'),
          overtimeMode
            ? 'border-red-500/30 bg-red-500/8 dark:bg-red-500/10'
            : warning
              ? 'border-red-500/25 bg-red-500/5 dark:bg-red-500/8'
              : 'border-amber-400/25 bg-amber-400/5 dark:bg-amber-400/8'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-500 dark:text-zinc-400">
            <span
              className={cn(
                'inline-block size-1.5 rounded-full transition-colors',
                timerRunning ? 'animate-pulse bg-emerald-400' : 'bg-zinc-400 dark:bg-zinc-600'
              )}
            />
            {overtimeMode
              ? locale === 'zh'
                ? '阅读加时赛'
                : 'Reading Overtime'
              : isListening
                ? copy.strictListeningMode
                : copy.strictReadingMode}
          </div>
          <div className="flex items-center gap-2">
            <span className="deck-pill px-2 py-0.5 text-[9px] tracking-[0.2em]">
              {overtimeMode ? (locale === 'zh' ? 'Overtime' : 'Overtime') : 'No Pause'}
            </span>
            {timerRunning && (
              <span className={cn(
                'rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em]',
                overtimeMode
                  ? 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300'
                  : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-600 dark:text-emerald-400'
              )}>
                {overtimeMode ? (locale === 'zh' ? '补录中' : 'Resolving') : copy.runningNow}
              </span>
            )}
          </div>
        </div>

        <div className={cn(
          'mt-4 font-mono text-6xl font-bold tracking-tight tabular-nums sm:text-7xl',
          overtimeMode
            ? 'text-red-500 dark:text-red-300'
            : warning
              ? 'text-red-500 dark:text-red-400'
              : 'text-amber-500 dark:text-amber-300'
        )}>
          {overtimeMode ? `+${formatClock(overtimeElapsedMs)}` : formatClock(timeLeft)}
        </div>

        <Progress
          value={progressValue}
          className={cn(
            'mt-4 h-1.5 [&>div]:rounded-full [&>div]:transition-all [&>div]:duration-300',
            overtimeMode
              ? '[&>div]:bg-red-500'
              : warning
                ? '[&>div]:bg-red-500'
                : '[&>div]:bg-amber-400'
          )}
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-start">
          <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            {overtimeMode
              ? locale === 'zh'
                ? '严格模考分已经锁定。现在继续做题只会记录你的补录错题和额外耗时，用来估算潜力分。'
                : 'The strict mock score is already locked. Continue working only to record overtime mistakes and extra time for the potential score.'
              : isListening
                ? copy.listeningTimerBody
                : copy.readingTimerBody}
          </p>
          <div className="deck-surface-strong p-3 text-left sm:text-right">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">{copy.latestCapture}</div>
            <div className="mt-0.5 font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300">{lastAttemptText}</div>
            <div className="mt-1 text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">
              {overtimeMode
                ? locale === 'zh'
                  ? '右侧复盘面板已切换到补录模式。'
                  : 'The review panel on the right is now in overtime-entry mode.'
                : session.timerSummary?.timedOut
                  ? copy.timedOutSaved
                  : session.timerSummary
                    ? copy.savedAttempt
                    : locale === 'zh'
                      ? '尚未写入本套严格模拟数据。'
                      : 'No strict attempt has been written for this set yet.'}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {!timerRunning && !pendingSubmit && !overtimeMode && (
            <Button
              onClick={startTimer}
              size="sm"
              className={cn(
                'font-mono text-xs font-semibold uppercase tracking-[0.18em] shadow-sm',
                isListening
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-amber-400 text-zinc-950 hover:bg-amber-500'
              )}
            >
              <Play className="mr-1.5 size-3.5" />
              {session.timerSummary ? copy.restartStrictAttempt : copy.startStrictAttempt}
            </Button>
          )}

          {!isListening && timerRunning && !overtimeMode && currentSegment && (
            <Button
              variant="outline"
              size="sm"
              onClick={captureLap}
              className={cn(
                'border-amber-400/40 font-mono text-xs uppercase tracking-[0.16em] text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-400/10',
                awaitingFinalConfirm && currentLapIndex === READING_LAP_SEGMENTS.length - 1
                  ? 'border-red-500/40 text-red-600 hover:bg-red-500/8 dark:text-red-300'
                  : ''
              )}
            >
              <Flag className="mr-1.5 size-3.5" />
              {awaitingFinalConfirm && currentLapIndex === READING_LAP_SEGMENTS.length - 1
                ? locale === 'zh'
                  ? '确认完成最后分段并提交成绩'
                  : 'Confirm Final Lap & Submit'
                : copy.lapAction(currentSegment.shortLabel)}
            </Button>
          )}

          {awaitingFinalConfirm && !isListening && currentLapIndex === READING_LAP_SEGMENTS.length - 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelFinalLapConfirm}
              className="border border-zinc-300/70 font-mono text-xs uppercase tracking-[0.16em] text-zinc-600 hover:bg-zinc-200/40 dark:border-white/12 dark:text-zinc-300 dark:hover:bg-white/8"
            >
              {locale === 'zh' ? '返回最后分段' : 'Back To Final Lap'}
            </Button>
          )}

          {timerRunning && !overtimeMode && !(awaitingFinalConfirm && !isListening && currentLapIndex === READING_LAP_SEGMENTS.length - 1) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={submitForced}
              className="border border-red-500/20 font-mono text-xs uppercase tracking-[0.16em] text-red-600 hover:bg-red-500/8 dark:text-red-400"
            >
              <ShieldAlert className="mr-1.5 size-3.5" />
              {copy.forceSubmit}
            </Button>
          )}
        </div>

        {lapUndo && !isListening && timerRunning && !overtimeMode && (
          <div className="mt-3 rounded-[18px] border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] leading-5 text-zinc-700 dark:text-zinc-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {locale === 'zh'
                  ? `刚刚记录了 ${translatePart(locale, lapUndo.capturedLapKey)}。如误触，可撤销。`
                  : `Recorded ${translatePart(locale, lapUndo.capturedLapKey)}. Undo if this was a mistap.`}
              </span>
              <button
                type="button"
                onClick={undoLastLapCapture}
                className="rounded-full border border-amber-500/30 bg-white/75 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-700 transition-colors hover:bg-amber-50 dark:bg-zinc-950/75 dark:text-amber-300"
              >
                {locale === 'zh' ? '撤销打点' : 'Undo Lap'}
              </button>
            </div>
          </div>
        )}

        {awaitingFinalConfirm && !isListening && currentLapIndex === READING_LAP_SEGMENTS.length - 1 && (
          <div className="mt-3 rounded-[18px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] leading-5 text-red-700 dark:text-red-300">
            {locale === 'zh'
              ? '这是“完成最后分段后提交整套成绩”，不是提前交卷。请再次确认。'
              : 'This action submits the full attempt after final-lap completion, not an early submit. Confirm to continue.'}
          </div>
        )}
      </div>

      {!isListening && (
        <div className="deck-surface-soft p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              {copy.readingLapSequence}
            </div>
            <div className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 font-mono text-[10px] dark:border-zinc-700 dark:bg-zinc-950">
              {copy.doneCount(completedLapCount, 4)}
            </div>
          </div>
          <div className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            {copy.currentCheckpoint(currentSegment ? translatePart(locale, currentSegment.key) : copy.allLapsCompleted)}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-4">
            {READING_LAP_SEGMENTS.map((segment, index) => {
              const completed = readingLapTimes[segment.key] !== undefined;
              const active = timerRunning && !overtimeMode && currentLapIndex === index;
              const stored = session.readingLapTimes[segment.key];

              return (
                <div
                  key={segment.key}
                  className={cn(
                    'rounded-2xl border p-3 transition-colors',
                    completed
                      ? 'border-emerald-500/30 bg-emerald-500/8'
                      : active
                        ? 'border-amber-400/40 bg-amber-400/8'
                        : 'border-zinc-200/80 bg-white/80 dark:border-white/8 dark:bg-zinc-950/78'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">{segment.shortLabel}</div>
                    <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                      {copy.baseline} {segment.baselineMinutes}m
                    </div>
                  </div>
                  <div className="mt-1 text-xs font-medium text-zinc-800 dark:text-zinc-200">{translatePart(locale, segment.key)}</div>
                  <div className={cn('mt-2 font-mono text-[10px] leading-5', completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500')}>
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
        <div className="rounded-[24px] border border-red-500/25 bg-red-500/8 p-4 text-sm dark:bg-red-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-red-700 dark:text-red-300">
                {pendingSubmit.timedOut ? copy.timeoutFrozen : copy.forcedEnded}
              </div>
              <p className="mt-1.5 text-xs leading-6 text-zinc-600 dark:text-zinc-300">
                {copy.pendingSubmitBody}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="number"
                  min="0"
                  value={unfinishedQuestions}
                  onChange={(event) => setUnfinishedQuestions(event.target.value)}
                  className="h-9 w-full bg-white/80 text-sm sm:w-44 dark:bg-black/20"
                  placeholder={copy.unfinishedPlaceholder}
                />
                <Button size="sm" onClick={strictSubmitFromPending} className="bg-red-500 text-white hover:bg-red-600">
                  <Hourglass className="mr-1.5 size-3.5" />
                  {copy.saveSubmitData}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(overtimeMode || unresolvedBacklog) && (
        <div className="rounded-[24px] border border-red-500/20 bg-red-500/8 p-4 dark:bg-red-500/10">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 size-4 shrink-0 text-red-500" />
            <div>
              <div className="text-sm font-semibold text-red-700 dark:text-red-300">
                {locale === 'zh' ? '未完成补录模式已开启' : 'Overtime resolution mode is active'}
              </div>
              <p className="mt-1.5 text-xs leading-6 text-zinc-600 dark:text-zinc-300">
                {locale === 'zh'
                  ? '严格分已经按照未完成题锁定。继续补做只会影响潜力分，不再反向污染严格模考分。'
                  : 'The strict score is already locked from the unfinished count. Any continued work now only affects the potential score, not the strict mock score.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showTimeoutDialog} onOpenChange={setShowTimeoutDialog}>
        <DialogContent showCloseButton={false} className="max-w-lg rounded-[28px] border border-white/65 bg-white/92 p-0 shadow-[0_24px_90px_-50px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-zinc-950/92 overflow-hidden">
          <DialogHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
              <AlertTriangle className="size-5" />
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {locale === 'zh' ? '时间到，还有几题没做完？' : 'Time is up. How many items are unfinished?'}
            </DialogTitle>
            <DialogDescription className="text-sm leading-7">
              {locale === 'zh'
                ? '严格模考分会先按未完成题锁定。你可以直接严格交卷，也可以开启加时赛继续补做，额外时间和错题会单独记录到潜力分。'
                : 'The strict mock score will be locked first from the unfinished count. You can submit now or open overtime mode to continue, with extra time and mistakes tracked separately for the potential score.'}
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            <Input
              type="number"
              min="0"
              value={unfinishedQuestions}
              onChange={(event) => setUnfinishedQuestions(event.target.value)}
              className="h-11 bg-white/90 text-sm dark:bg-zinc-950/80"
              placeholder={copy.unfinishedPlaceholder}
            />
          </div>

          <DialogFooter className="mx-0! mb-0! rounded-b-[28px] border-white/60 bg-white/70 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] dark:border-white/8 dark:bg-white/4 sm:px-6">
            <Button variant="outline" onClick={strictSubmitFromPending} className="w-full sm:w-auto">
              {locale === 'zh' ? '严格交卷' : 'Submit Strict Score'}
            </Button>
            <Button onClick={startOvertime} className="w-full bg-red-500 text-white hover:bg-red-600 sm:w-auto">
              {locale === 'zh' ? '开启加时赛' : 'Start Overtime'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}