'use client';

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Check, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getCopy, translatePart, translateReason } from '@/lib/i18n';
import {
  hasResolvedUnfinished,
  READING_LAP_SEGMENTS,
  formatMinutes,
  getPartsForType,
  getReasonsForType,
  sumMistakes,
  type MistakeKey,
  type SessionRecord,
} from '@/lib/toeic';
import { trackUXEvent } from '@/lib/uxEvent';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

function sameStringArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameNumberRecord<T extends string>(
  left: Partial<Record<T, number>>,
  right: Partial<Record<T, number>>
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key as T] === right[key as T]);
}

export function DebugForm({
  activeSession,
  autoFocusToken = 0,
  onReviewSaved,
  onReviewUndone,
}: {
  activeSession: SessionRecord;
  autoFocusToken?: number;
  onReviewSaved?: (nextStep: 'unfinished' | 'analytics') => void;
  onReviewUndone?: () => void;
}) {
  const saveDiagnostics = useStore((state) => state.saveDiagnostics);
  const saveOvertimeDiagnostics = useStore((state) => state.saveOvertimeDiagnostics);
  const patchSession = useStore((state) => state.patchSession);
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);
  const parts = useMemo(() => getPartsForType(activeSession.type), [activeSession.type]);
  const reasonOptions = useMemo(() => getReasonsForType(activeSession.type), [activeSession.type]);

  const [mistakes, setMistakes] = useState<Partial<Record<MistakeKey, number>>>(activeSession.mistakes);
  const [overtimeMistakes, setOvertimeMistakes] = useState<Partial<Record<MistakeKey, number>>>(activeSession.overtimeMistakes ?? {});
  const [reasons, setReasons] = useState<string[]>(activeSession.reasons);
  const [saved, setSaved] = useState(false);
  const [overtimeSaved, setOvertimeSaved] = useState(false);
  const [undoVisible, setUndoVisible] = useState(false);
  const undoTimerRef = useRef<number | null>(null);
  const undoPayloadRef = useRef<{
    mistakes: Partial<Record<MistakeKey, number>>;
    reasons: string[];
    status: SessionRecord['status'];
  } | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const unresolvedBacklog = activeSession.type === 'R'
    && (activeSession.timerSummary?.unfinishedQuestions ?? 0) > 0
    && !hasResolvedUnfinished(activeSession);

  const totalMistakes = useMemo(
    () => sumMistakes({ ...activeSession, mistakes }),
    [activeSession, mistakes]
  );

  const totalOvertimeMistakes = useMemo(
    () => Object.values(overtimeMistakes).reduce((sum, value) => sum + (value ?? 0), 0),
    [overtimeMistakes]
  );

  const dirtyReview = useMemo(() => {
    return (
      !sameNumberRecord<MistakeKey>(mistakes, activeSession.mistakes) ||
      !sameStringArray(reasons, activeSession.reasons)
    );
  }, [activeSession.mistakes, activeSession.reasons, mistakes, reasons]);

  const dirtyOvertime = useMemo(() => {
    return !sameNumberRecord<MistakeKey>(overtimeMistakes, activeSession.overtimeMistakes ?? {});
  }, [activeSession.overtimeMistakes, overtimeMistakes]);

  const updateMistake = (part: MistakeKey, value: string) => {
    const parsed = Number(value);
    setMistakes((current) => ({
      ...current,
      [part]: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
    }));
  };

  const focusInputAt = useCallback((index: number) => {
    if (index < 0 || index >= parts.length) {
      return;
    }

    const input = inputRefs.current[index];
    if (!input) {
      return;
    }

    input.focus();
    input.select();
  }, [parts.length]);

  const handleMistakeInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Enter' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusInputAt(Math.min(index + 1, parts.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusInputAt(Math.max(index - 1, 0));
    }
  };

  const updateOvertimeMistake = (part: MistakeKey, value: string) => {
    const parsed = Number(value);
    setOvertimeMistakes((current) => ({
      ...current,
      [part]: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
    }));
  };

  const toggleReason = (reason: string) => {
    setReasons((current) =>
      current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]
    );
  };

  const fillEmptyMistakesWithZero = () => {
    setMistakes((current) => {
      const next = { ...current };
      for (const part of parts) {
        if (next[part] === undefined || next[part] === null) {
          next[part] = 0;
        }
      }
      return next;
    });
  };

  const resetReviewDraft = () => {
    setMistakes(activeSession.mistakes);
    setReasons(activeSession.reasons);
  };

  const resetOvertimeDraft = () => {
    setOvertimeMistakes(activeSession.overtimeMistakes ?? {});
  };

  const handleSave = () => {
    undoPayloadRef.current = {
      mistakes: activeSession.mistakes,
      reasons: activeSession.reasons,
      status: activeSession.status,
    };

    saveDiagnostics(activeSession.id, {
      mistakes,
      reasons,
      status: 'debugged',
    });
    setSaved(true);
    setUndoVisible(true);
    window.setTimeout(() => setSaved(false), 1600);

    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }

    undoTimerRef.current = window.setTimeout(() => {
      setUndoVisible(false);
      undoPayloadRef.current = null;
    }, 5000);

    trackUXEvent('review_saved', activeSession.id);
    onReviewSaved?.(activeSession.type === 'R' ? 'unfinished' : 'analytics');
  };

  const handleUndoSave = () => {
    const previous = undoPayloadRef.current;
    if (!previous) {
      return;
    }

    saveDiagnostics(activeSession.id, {
      mistakes: previous.mistakes,
      reasons: previous.reasons,
      status: previous.status,
    });

    patchSession(activeSession.id, {
      status: previous.status,
    });

    setUndoVisible(false);
    undoPayloadRef.current = null;

    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    trackUXEvent('review_undone', activeSession.id);
    onReviewUndone?.();
  };

  const handleSaveOvertime = () => {
    const overtimeStartedAt = activeSession.timerRuntime?.overtimeStartedAt
      ? new Date(activeSession.timerRuntime.overtimeStartedAt).getTime()
      : undefined;
    const overtimeElapsedMs = activeSession.timerSummary?.overtimeElapsedMs
      ?? (overtimeStartedAt ? Math.max(Date.now() - overtimeStartedAt, 0) : undefined);

    saveOvertimeDiagnostics(activeSession.id, {
      overtimeMistakes,
      resolvedUnfinished: true,
      overtimeElapsedMs,
      status: 'debugged',
    });
    setOvertimeSaved(true);
    window.setTimeout(() => setOvertimeSaved(false), 1600);
    trackUXEvent('overtime_saved', activeSession.id);
    onReviewSaved?.('analytics');
  };

  const handleShortcutSave = useEffectEvent((withShift: boolean) => {
    if (withShift && unresolvedBacklog && dirtyOvertime) {
      handleSaveOvertime();
      return;
    }

    if (dirtyReview) {
      handleSave();
    }
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!((event.ctrlKey || event.metaKey) && event.key === 'Enter')) {
        return;
      }

      event.preventDefault();
      handleShortcutSave(event.shiftKey);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (autoFocusToken <= 0) {
      return;
    }

    window.setTimeout(() => focusInputAt(0), 40);
  }, [autoFocusToken, focusInputAt]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  return (
    <Card className="overflow-hidden rounded-[36px] border border-white/40 bg-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/40 dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
      <CardHeader className="border-b border-zinc-200/50 px-8 py-6 dark:border-white/10">
        <div className="font-mono text-[10px] font-medium uppercase tracking-[0.26em] text-zinc-500 dark:text-zinc-400">
          {activeSession.type === 'L' ? 'LISTENING REVIEW' : 'READING REVIEW'}
        </div>
        <CardTitle className="mt-2 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-2xl">
          {copy.dataEntryTitle}
        </CardTitle>
        <CardDescription className="text-xs leading-6">
          {copy.dataEntryDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <div className="rounded-2xl border border-zinc-200/80 bg-white/78 px-4 py-3 dark:border-white/8 dark:bg-zinc-950/82">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            {locale === 'zh' ? '复盘步骤' : 'Review Steps'}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] leading-5">
            <StepTag label={locale === 'zh' ? '1 录入错题' : '1 Mistakes'} active />
            <StepTag label={locale === 'zh' ? '2 选择错因' : '2 Reasons'} active={reasons.length > 0} />
            <StepTag label={locale === 'zh' ? '3 保存复盘' : '3 Save'} active={saved || activeSession.status === 'debugged'} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickInfoCard label={copy.session} value={activeSession.label} helper={activeSession.type === 'L' ? copy.listeningDiagnosis : copy.readingDiagnosis} />
          <QuickInfoCard label={copy.target} value={`${activeSession.targetMinutes}m`} helper={copy.officialSprintTime} />
          <QuickInfoCard label={copy.currentMistakes} value={`${totalMistakes}`} helper={copy.liveTotalInForm} />
          <QuickInfoCard
            label={copy.forcedSubmit}
            value={activeSession.timerSummary?.forcedSubmit ? copy.yes : copy.no}
            helper={
              activeSession.timerSummary
                ? copy.unfinished(activeSession.timerSummary.unfinishedQuestions)
                : copy.noTimerSummary
            }
          />
        </div>

        {unresolvedBacklog && (
          <div className="rounded-[22px] border border-red-500/20 bg-red-500/8 p-4 dark:bg-red-500/10">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-red-600 dark:text-red-300">
              {locale === 'zh' ? 'Overtime Review Mode' : 'Overtime Review Mode'}
            </div>
            <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {locale === 'zh'
                ? `这套题还有 ${activeSession.timerSummary?.unfinishedQuestions ?? 0} 题是在超时后补做的。`
                : `${activeSession.timerSummary?.unfinishedQuestions ?? 0} items in this set were resolved after the time limit.`}
            </div>
            <p className="mt-2 text-xs leading-6 text-zinc-600 dark:text-zinc-300">
              {locale === 'zh'
                ? '下面这组输入框只记录超时后补做时真正做错的题目，并会写入潜力分，不再反向污染严格模考分。'
                : 'The overtime fields below only record mistakes made while resolving unfinished items after time expired. They feed the potential score without contaminating the strict mock score.'}
            </p>
          </div>
        )}

        {activeSession.type === 'R' && (
          <div className="deck-surface-soft p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">{copy.lapSync}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {READING_LAP_SEGMENTS.map((segment) => {
                const actual = activeSession.readingLapTimes[segment.key];
                const delta = actual !== undefined ? actual / 60000 - segment.baselineMinutes : undefined;
                return (
                  <div key={segment.key} className="deck-surface-strong rounded-xl p-3">
                    <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{translatePart(locale, segment.key)}</div>
                    <div className="mt-1.5 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {actual !== undefined ? formatMinutes(actual) : '--'}
                    </div>
                    <div className={`mt-0.5 font-mono text-[10px] ${delta !== undefined && delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {delta !== undefined ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}m vs ${segment.baselineMinutes}m` : `${locale === 'zh' ? '基准' : 'Base'} ${segment.baselineMinutes}m`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">{copy.mistakesByPart}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fillEmptyMistakesWithZero}
                className="rounded-full border border-zinc-200/80 bg-white/80 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-950/78 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {locale === 'zh' ? '空值补零' : 'Fill Empty'}
              </button>
              <button
                type="button"
                onClick={resetReviewDraft}
                className="rounded-full border border-zinc-200/80 bg-white/80 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-950/78 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {locale === 'zh' ? '恢复已保存' : 'Reset Draft'}
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {parts.map((part, index) => (
              <label key={part} className="group flex flex-col justify-between rounded-[24px] border border-white/50 bg-white/50 p-4 shadow-sm transition-all focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 hover:bg-white/80 dark:border-white/10 dark:bg-zinc-900/50 dark:hover:bg-zinc-900/80">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{translatePart(locale, part)}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
                    {mistakes[part] ?? 0}
                  </div>
                </div>
                <Input
                  type="number"
                  min="0"
                  className="mt-3 h-12 rounded-[16px] border-0 bg-white/80 text-center text-lg font-semibold focus-visible:ring-0 dark:bg-zinc-950/80"
                  value={mistakes[part] ?? ''}
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  onChange={(event) => updateMistake(part, event.target.value)}
                  onKeyDown={(event) => handleMistakeInputKeyDown(event, index)}
                  placeholder="0"
                />
              </label>
            ))}
          </div>
        </div>

        {unresolvedBacklog && (
          <div>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">
                {locale === 'zh' ? '超时后补录错题' : 'Overtime Mistakes'}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
                {locale === 'zh' ? `已录 ${totalOvertimeMistakes}` : `${totalOvertimeMistakes} logged`}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {parts.map((part) => (
                <label key={`overtime-${part}`} className="group flex flex-col justify-between rounded-[24px] border border-red-200/50 bg-red-50/50 p-4 shadow-sm transition-all focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-400/20 hover:bg-red-50/80 dark:border-red-900/20 dark:bg-red-900/10 dark:hover:bg-red-900/20">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{translatePart(locale, part)}</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
                      {overtimeMistakes[part] ?? 0}
                    </div>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    className="mt-3 h-12 rounded-[16px] border-0 bg-white/80 text-center text-lg font-semibold focus-visible:ring-0 dark:bg-zinc-950/80"
                    value={overtimeMistakes[part] ?? ''}
                    onChange={(event) => updateOvertimeMistake(part, event.target.value)}
                    placeholder="0"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">{copy.rootCauseTags}</div>
            <button
              type="button"
              onClick={() => setReasons([])}
              className="rounded-full border border-zinc-200/80 bg-white/80 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-950/78 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {locale === 'zh' ? `清空标签 (${reasons.length})` : `Clear (${reasons.length})`}
            </button>
          </div>
          {totalMistakes > 0 && reasons.length === 0 && (
            <div className="mb-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] leading-5 text-amber-700 dark:text-amber-300">
              {locale === 'zh'
                ? '建议至少选择 1 个错因标签，后续趋势分析会更准确。'
                : 'Select at least one root-cause tag for more reliable trend analysis.'}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {reasonOptions.map((reason) => {
              const active = reasons.includes(reason);
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => toggleReason(reason)}
                  className={cn(
                    'rounded-full border px-5 py-2.5 text-sm font-medium shadow-sm transition-all duration-200 hover:scale-105 active:scale-95',
                    active
                      ? 'border-amber-400/40 bg-amber-400/10 text-amber-700 shadow-sm dark:text-amber-300'
                      : 'border-zinc-200/80 bg-white/80 text-zinc-500 hover:border-amber-300 hover:text-zinc-800 dark:border-white/8 dark:bg-zinc-950/78 dark:text-zinc-400'
                  )}
                  aria-pressed={active}
                >
                  {translateReason(locale, reason)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="deck-surface-strong p-3">
          <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>{locale === 'zh' ? '保存后会将当前套题标记为已完成复盘。' : 'Saving will mark this set as reviewed.'}</span>
            <span className="font-mono uppercase tracking-[0.2em]">{totalMistakes}</span>
          </div>
          <div className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            {locale === 'zh'
              ? '快捷键: Ctrl/Cmd + Enter 保存复盘，Shift + Ctrl/Cmd + Enter 保存加时复盘'
              : 'Shortcut: Ctrl/Cmd + Enter saves review, Shift + Ctrl/Cmd + Enter saves overtime review'}
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirtyReview}
            className="h-14 w-full rounded-full text-base font-semibold shadow-lg transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          >
            {saved ? <Check className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
            {saved ? `${copy.saveDiagnostics} OK` : !dirtyReview ? (locale === 'zh' ? '暂无变更' : 'No Changes') : `${copy.saveDiagnostics} ${copy.markDebugged}`}
          </Button>

          {undoVisible && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] text-zinc-700 dark:text-zinc-300">
              <span>{locale === 'zh' ? '已保存，可在 5 秒内撤销。' : 'Saved. You can undo within 5 seconds.'}</span>
              <Button type="button" variant="ghost" size="sm" onClick={handleUndoSave} className="h-7 px-2 text-[11px]">
                {locale === 'zh' ? '撤销' : 'Undo'}
              </Button>
            </div>
          )}
        </div>

        {unresolvedBacklog && (
          <div className="deck-surface-strong border border-red-500/10 p-3">
            <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>
                {locale === 'zh'
                  ? '保存后会写入 overtimeMistakes，并把这套题从未完成列表中移除。'
                  : 'Saving writes overtimeMistakes and removes this set from the unfinished queue.'}
              </span>
              <span className="font-mono uppercase tracking-[0.2em]">{totalOvertimeMistakes}</span>
            </div>
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={resetOvertimeDraft}
                className="rounded-full border border-red-500/25 bg-white/80 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-red-600 transition-colors hover:bg-red-500/8 dark:border-red-500/30 dark:bg-zinc-950/78 dark:text-red-300"
              >
                {locale === 'zh' ? '恢复已保存' : 'Reset Draft'}
              </button>
            </div>
            <Button
              size="sm"
              onClick={handleSaveOvertime}
              disabled={!dirtyOvertime}
              className="h-14 w-full rounded-full text-base font-semibold shadow-lg transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 bg-red-500 text-white hover:bg-red-600"
            >
              {overtimeSaved ? <Check className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
              {overtimeSaved
                ? locale === 'zh'
                  ? '已保存加时补录'
                  : 'Overtime Saved'
                : locale === 'zh'
                  ? !dirtyOvertime
                    ? '加时无变更'
                    : '保存加时补录'
                  : !dirtyOvertime
                    ? 'No Overtime Changes'
                    : 'Save Overtime Review'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepTag({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={active
        ? 'rounded-full border border-amber-400/35 bg-amber-400/12 px-2.5 py-1 font-mono tracking-[0.12em] text-amber-700 dark:text-amber-300'
        : 'rounded-full border border-zinc-200/85 bg-white/80 px-2.5 py-1 font-mono tracking-[0.12em] text-zinc-500 dark:border-white/8 dark:bg-zinc-950/70 dark:text-zinc-400'}
    >
      {label}
    </span>
  );
}

function QuickInfoCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="deck-surface-soft rounded-2xl p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">{label}</div>
      <div className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{value}</div>
      <div className="mt-0.5 text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">{helper}</div>
    </div>
  );
}
