'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Flag, Hourglass, Play, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { getCopy, translatePart } from '@/lib/i18n';
import {
  READING_LAP_SEGMENTS,
  formatClock,
  formatMinutes,
  getTargetDurationMs,
  sumReadingLapTimes,
  type ReadingLapKey,
  type SessionRecord,
} from '@/lib/toeic';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

type PendingSubmit = {
  forcedSubmit: boolean;
  timedOut: boolean;
};

export function LapTimer({ session }: { session: SessionRecord }) {
  const patchSession = useStore((state) => state.patchSession);
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);
  const isListening = session.type === 'L';
  const totalDurationMs = getTargetDurationMs(session.type);
  const lastReadingTotal = sumReadingLapTimes(session);

  const [timeLeft, setTimeLeft] = useState(totalDurationMs);
  const [isRunning, setIsRunning] = useState(false);
  const [readingLapTimes, setReadingLapTimes] = useState<Partial<Record<ReadingLapKey, number>>>({});
  const [currentLapIndex, setCurrentLapIndex] = useState(0);
  const [unfinishedQuestions, setUnfinishedQuestions] = useState(
    session.timerSummary ? String(session.timerSummary.unfinishedQuestions) : ''
  );
  const [pendingSubmit, setPendingSubmit] = useState<PendingSubmit | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const lapStartedAtRef = useRef<number | null>(null);

  const completedLapCount = useMemo(
    () => READING_LAP_SEGMENTS.filter((segment) => readingLapTimes[segment.key] !== undefined).length,
    [readingLapTimes]
  );

  const persistAttempt = useCallback(
    (options: PendingSubmit & { unfinishedCount: number }) => {
      const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : totalDurationMs - timeLeft;
      patchSession(session.id, {
        status: 'in-progress',
        readingLapTimes: isListening ? session.readingLapTimes : readingLapTimes,
        timerSummary: {
          totalElapsedMs: Math.min(totalDurationMs, Math.max(elapsed, 0)),
          forcedSubmit: options.forcedSubmit,
          timedOut: options.timedOut,
          unfinishedQuestions: options.unfinishedCount,
          completedAt: new Date().toISOString(),
        },
      });
      setPendingSubmit(null);
    },
    [isListening, patchSession, readingLapTimes, session.id, session.readingLapTimes, timeLeft, totalDurationMs]
  );

  const requestSubmit = useCallback(
    (options: PendingSubmit) => {
      if (!isListening && completedLapCount < READING_LAP_SEGMENTS.length) {
        setPendingSubmit(options);
        return;
      }

      persistAttempt({ ...options, unfinishedCount: 0 });
    },
    [completedLapCount, isListening, persistAttempt]
  );

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!startedAtRef.current) {
        return;
      }

      const elapsed = Date.now() - startedAtRef.current;
      const remaining = Math.max(totalDurationMs - elapsed, 0);
      setTimeLeft(remaining);

      if (remaining === 0) {
        setIsRunning(false);
        startedAtRef.current = null;
        lapStartedAtRef.current = null;
        requestSubmit({ forcedSubmit: true, timedOut: true });
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [isRunning, requestSubmit, totalDurationMs]);

  const startTimer = () => {
    setTimeLeft(totalDurationMs);
    setIsRunning(true);
    setReadingLapTimes({});
    setCurrentLapIndex(0);
    setPendingSubmit(null);
    setUnfinishedQuestions('');
    startedAtRef.current = Date.now();
    lapStartedAtRef.current = Date.now();

    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes: {},
      timerSummary: undefined,
    });
  };

  const captureLap = () => {
    const segment = READING_LAP_SEGMENTS[currentLapIndex];
    if (!segment || !lapStartedAtRef.current) {
      return;
    }

    const now = Date.now();
    const lapElapsed = now - lapStartedAtRef.current;
    const nextLapTimes = {
      ...readingLapTimes,
      [segment.key]: lapElapsed,
    };

    setReadingLapTimes(nextLapTimes);
    patchSession(session.id, {
      status: 'in-progress',
      readingLapTimes: nextLapTimes,
    });

    lapStartedAtRef.current = now;

    if (currentLapIndex === READING_LAP_SEGMENTS.length - 1) {
      setCurrentLapIndex((value) => value + 1);
      setIsRunning(false);
      persistAttempt({ forcedSubmit: false, timedOut: false, unfinishedCount: 0 });
      return;
    }

    setCurrentLapIndex((value) => value + 1);
  };

  const submitForced = () => {
    setIsRunning(false);
    requestSubmit({ forcedSubmit: true, timedOut: false });
  };

  const savePendingSubmit = () => {
    if (!pendingSubmit) {
      return;
    }

    const unfinishedCount = Number(unfinishedQuestions);
    if (Number.isNaN(unfinishedCount) || unfinishedCount < 0) {
      return;
    }

    persistAttempt({ ...pendingSubmit, unfinishedCount });
  };

  const warning = isListening || timeLeft <= 5 * 60 * 1000;
  const progressValue = ((totalDurationMs - timeLeft) / totalDurationMs) * 100;
  const currentSegment = READING_LAP_SEGMENTS[currentLapIndex];
  const lastAttemptText = session.timerSummary
    ? `${formatMinutes(session.timerSummary.totalElapsedMs)} / ${copy.unfinished(session.timerSummary.unfinishedQuestions)}`
    : isListening
      ? copy.noListeningAttempt
      : lastReadingTotal > 0
        ? copy.savedReadingTime(formatMinutes(lastReadingTotal))
        : copy.noReadingAttempt;

  return (
    <div className="space-y-4">
      <div className={cn(
        'relative overflow-hidden rounded-[26px] border p-5 transition-all duration-300 sm:p-6',
        isRunning && (warning ? 'timer-glow-red' : 'timer-glow-amber'),
        warning
          ? 'border-red-500/25 bg-red-500/5 dark:bg-red-500/8'
          : 'border-amber-400/25 bg-amber-400/5 dark:bg-amber-400/8'
      )}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-500 dark:text-zinc-400">
            <span className={cn(
              'inline-block size-1.5 rounded-full transition-colors',
              isRunning ? 'animate-pulse bg-emerald-400' : 'bg-zinc-400 dark:bg-zinc-600'
            )} />
            {isListening ? copy.strictListeningMode : copy.strictReadingMode}
          </div>
          <div className="flex items-center gap-2">
            <span className="deck-pill px-2 py-0.5 text-[9px] tracking-[0.2em]">
                No Pause
            </span>
            {isRunning && (
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                {copy.runningNow}
              </span>
            )}
          </div>
        </div>

        <div className={cn(
          'mt-4 font-mono text-6xl font-bold tracking-tight tabular-nums sm:text-7xl',
          warning ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-300'
        )}>
          {formatClock(timeLeft)}
        </div>

        <Progress
          value={progressValue}
          className={cn(
            'mt-4 h-1.5 [&>div]:rounded-full [&>div]:transition-all [&>div]:duration-300',
            warning ? '[&>div]:bg-red-500' : '[&>div]:bg-amber-400'
          )}
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-start">
          <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            {isListening ? copy.listeningTimerBody : copy.readingTimerBody}
          </p>
          <div className="deck-surface-strong p-3 text-left sm:text-right">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">{copy.latestCapture}</div>
            <div className="mt-0.5 font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300">{lastAttemptText}</div>
            <div className="mt-1 text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">
              {session.timerSummary?.timedOut
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
          {!isRunning && !pendingSubmit && (
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

          {!isListening && isRunning && currentSegment && (
            <Button
              variant="outline"
              size="sm"
              onClick={captureLap}
              className="border-amber-400/40 font-mono text-xs uppercase tracking-[0.16em] text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-400/10"
            >
              <Flag className="mr-1.5 size-3.5" />
              {copy.lapAction(currentSegment.shortLabel)}
            </Button>
          )}

          {isRunning && (
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
              const active = isRunning && currentLapIndex === index;
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

      {pendingSubmit && (
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
                <Button size="sm" onClick={savePendingSubmit} className="bg-red-500 text-white hover:bg-red-600">
                  <Hourglass className="mr-1.5 size-3.5" />
                  {copy.saveSubmitData}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
