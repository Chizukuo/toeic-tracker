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
  PART_QUESTION_COUNTS,
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
}: {
  activeSession: SessionRecord;
  autoFocusToken?: number;
  onReviewSaved?: (nextStep: 'unfinished' | 'analytics') => void;
}) {
  const saveDiagnostics = useStore((state) => state.saveDiagnostics);
  const saveOvertimeDiagnostics = useStore((state) => state.saveOvertimeDiagnostics);
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);
  const parts = useMemo(() => getPartsForType(activeSession.type), [activeSession.type]);
  const reasonOptions = useMemo(() => getReasonsForType(activeSession.type), [activeSession.type]);

  const [mistakes, setMistakes] = useState<Partial<Record<MistakeKey, number>>>(activeSession.mistakes);
  const [overtimeMistakes, setOvertimeMistakes] = useState<Partial<Record<MistakeKey, number>>>(activeSession.overtimeMistakes ?? {});
  const [reasons, setReasons] = useState<string[]>(activeSession.reasons);
  const [notes, setNotes] = useState<string>(activeSession.notes ?? '');
  const [saved, setSaved] = useState(false);
  const [showNotes, setShowNotes] = useState(Boolean(activeSession.notes));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const unfinishedCount = activeSession.type === 'R' ? activeSession.timerSummary?.unfinishedQuestions ?? 0 : 0;
  const unresolvedBacklog = unfinishedCount > 0 && !hasResolvedUnfinished(activeSession);
  // Overtime mistakes only make sense once the user actually finished the leftovers on the clock.
  const overtimeDone = unresolvedBacklog && (activeSession.timerSummary?.overtimeElapsedMs ?? 0) > 0;
  const hasLapTimes = activeSession.type === 'R' && Object.keys(activeSession.readingLapTimes).length > 0;

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
      !sameStringArray(reasons, activeSession.reasons) ||
      notes !== (activeSession.notes ?? '')
    );
  }, [activeSession.mistakes, activeSession.reasons, activeSession.notes, mistakes, reasons, notes]);

  const dirtyOvertime = useMemo(() => {
    return !sameNumberRecord<MistakeKey>(overtimeMistakes, activeSession.overtimeMistakes ?? {});
  }, [activeSession.overtimeMistakes, overtimeMistakes]);

  // A first save is always allowed, so a clean run (zero mistakes, no tags) can still be closed out.
  const canSaveReview = dirtyReview || (overtimeDone && dirtyOvertime) || activeSession.status !== 'debugged';
  const hasEmptyPart = parts.some((part) => mistakes[part] === undefined);

  const updateMistake = (part: MistakeKey, value: string) => {
    setMistakes((current) => ({
      ...current,
      [part]: parseMistakeCount(value, part),
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
    setOvertimeMistakes((current) => ({
      ...current,
      [part]: parseMistakeCount(value, part),
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
    setNotes(activeSession.notes ?? '');
  };

  const handleSave = () => {
    saveDiagnostics(activeSession.id, {
      mistakes,
      reasons,
      notes: notes.trim() || undefined,
      status: unresolvedBacklog ? 'in-progress' : 'debugged',
    });

    if (overtimeDone) {
      // One save closes the set: overtime mistakes feed only the "with enough time" score.
      saveOvertimeDiagnostics(activeSession.id, {
        overtimeMistakes,
        resolvedUnfinished: true,
        overtimeElapsedMs: activeSession.timerSummary?.overtimeElapsedMs,
        status: 'debugged',
      });
      trackUXEvent('overtime_saved', activeSession.id);
    }

    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
    trackUXEvent('review_saved', activeSession.id);
    // Only leftovers that still need a decision send the user back to the timer; otherwise show the result.
    onReviewSaved?.(unresolvedBacklog && !overtimeDone ? 'unfinished' : 'analytics');
  };

  const handleShortcutSave = useEffectEvent(() => {
    if (canSaveReview) {
      handleSave();
    }
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Skip keys another field already handled (e.g. Enter in the vocab capture box).
      if (event.defaultPrevented || !((event.ctrlKey || event.metaKey) && event.key === 'Enter')) {
        return;
      }

      event.preventDefault();
      handleShortcutSave();
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

  const chipButton =
    'rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-950/78 dark:text-zinc-400 dark:hover:text-zinc-100';

  return (
    <Card className="overflow-hidden rounded-[36px] border border-white/40 bg-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/40 dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
      <CardHeader className="border-b border-zinc-200/50 px-6 py-5 sm:px-8 sm:py-6 dark:border-white/10">
        <CardTitle className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-2xl">
          {copy.dataEntryTitle}
        </CardTitle>
        <CardDescription className="text-[13px] leading-6">
          {copy.dataEntryDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-5 sm:p-6">
        {unfinishedCount > 0 && (
          <div className="rounded-[20px] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[13px] leading-6 text-amber-900 dark:text-amber-100">
            {locale === 'zh'
              ? `有 ${unfinishedCount} 题没来得及做，已经按错题算进分数了。下面只填你做了但做错的题。`
              : `${unfinishedCount} questions were left unanswered and already count as wrong. Below, enter only the ones you answered incorrectly.`}
            {unresolvedBacklog && !overtimeDone && (
              <span className="block text-amber-800/80 dark:text-amber-200/80">
                {locale === 'zh'
                  ? '保存后，你可以选择把这几题补做完（看看时间够的话能拿多少分），也可以跳过。'
                  : 'After saving you can finish those questions (to see your score with enough time) or skip them.'}
              </span>
            )}
          </div>
        )}

        <section>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{copy.mistakesByPart}</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {locale === 'zh' ? `共错 ${totalMistakes} 题` : `${totalMistakes} wrong`}
              </span>
              {hasEmptyPart && (
                <button type="button" onClick={fillEmptyMistakesWithZero} className={chipButton}>
                  {locale === 'zh' ? '其余填 0' : 'Rest are 0'}
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {parts.map((part, index) => (
              <label key={part} className="group flex flex-col justify-between rounded-[22px] border border-white/50 bg-white/50 p-3.5 shadow-sm transition-all focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 hover:bg-white/80 dark:border-white/10 dark:bg-zinc-900/50 dark:hover:bg-zinc-900/80">
                <div className="text-xs font-medium leading-5 text-zinc-700 dark:text-zinc-300">{translatePart(locale, part)}</div>
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  {locale === 'zh' ? `共 ${PART_QUESTION_COUNTS[part]} 题` : `${PART_QUESTION_COUNTS[part]} questions`}
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max={PART_QUESTION_COUNTS[part]}
                  aria-label={`${translatePart(locale, part)} ${copy.mistakesByPart}`}
                  className="mt-2 h-12 rounded-[16px] border-0 bg-white/80 text-center text-lg font-semibold focus-visible:ring-0 dark:bg-zinc-950/80"
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
        </section>

        {overtimeDone && (
          <section>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {locale === 'zh' ? `补做的 ${unfinishedCount} 题里错了几题？` : `Of the ${unfinishedCount} you finished late, how many were wrong?`}
              </h3>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {locale === 'zh' ? `共错 ${totalOvertimeMistakes} 题` : `${totalOvertimeMistakes} wrong`}
              </span>
            </div>
            <p className="mb-2.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {locale === 'zh'
                ? '这部分只影响「时间充足时的分数」，不会改变按考试规则算出的分数。'
                : 'This only affects your "with enough time" score, not the score under real test rules.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {parts.map((part) => (
                <label key={`overtime-${part}`} className="flex flex-col rounded-[22px] border border-amber-300/40 bg-amber-50/50 p-3.5 shadow-sm transition-all focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 dark:border-amber-900/30 dark:bg-amber-900/10">
                  <div className="text-xs font-medium leading-5 text-zinc-700 dark:text-zinc-300">{translatePart(locale, part)}</div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max={PART_QUESTION_COUNTS[part]}
                    aria-label={`${translatePart(locale, part)} ${locale === 'zh' ? '补做错题' : 'late mistakes'}`}
                    className="mt-2 h-12 rounded-[16px] border-0 bg-white/80 text-center text-lg font-semibold focus-visible:ring-0 dark:bg-zinc-950/80"
                    value={overtimeMistakes[part] ?? ''}
                    onChange={(event) => updateOvertimeMistake(part, event.target.value)}
                    placeholder="0"
                  />
                </label>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-1 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{copy.rootCauseTags}</h3>
            {reasons.length > 0 && (
              <button type="button" onClick={() => setReasons([])} className={chipButton}>
                {locale === 'zh' ? '清空' : 'Clear'}
              </button>
            )}
          </div>
          <p className="mb-2.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {locale === 'zh'
              ? '可多选。选得越多，「分析」页越能看出你反复在哪里失分。'
              : 'Pick any that apply. Over time, Insights shows which ones keep costing you points.'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {reasonOptions.map((reason) => {
              const active = reasons.includes(reason);
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => toggleReason(reason)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-200 active:scale-95',
                    active
                      ? 'border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300'
                      : 'border-zinc-200/80 bg-white/80 text-zinc-500 hover:border-amber-300 hover:text-zinc-800 dark:border-white/8 dark:bg-zinc-950/78 dark:text-zinc-400'
                  )}
                  aria-pressed={active}
                >
                  {translateReason(locale, reason)}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          {showNotes ? (
            <>
              <h3 className="mb-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {locale === 'zh' ? '笔记（可选）' : 'Notes (optional)'}
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={locale === 'zh' ? '这套题有什么教训？下次要注意什么？' : 'Any lessons from this set? What to watch for next time?'}
                rows={3}
                className="w-full resize-none rounded-[16px] border border-zinc-200/80 bg-white/50 p-4 text-sm leading-relaxed text-zinc-700 transition-all placeholder:text-zinc-400 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/20 dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-300 dark:placeholder:text-zinc-600 dark:focus:bg-zinc-950/80"
              />
            </>
          ) : (
            <button type="button" onClick={() => setShowNotes(true)} className={chipButton}>
              {locale === 'zh' ? '+ 写点笔记（可选）' : '+ Add a note (optional)'}
            </button>
          )}
        </section>

        {hasLapTimes && (
          <details className="deck-surface-soft group rounded-2xl p-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {copy.lapSync}
              <span className="ml-2 text-xs font-normal text-zinc-500 group-open:hidden dark:text-zinc-400">
                {locale === 'zh' ? '点开查看' : 'Show'}
              </span>
            </summary>
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
                    <div className={`mt-0.5 text-[11px] ${delta !== undefined && delta > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {delta !== undefined
                        ? locale === 'zh'
                          ? `${delta > 0 ? '超出' : '少于'}建议 ${Math.abs(delta).toFixed(1)} 分钟`
                          : `${Math.abs(delta).toFixed(1)}m ${delta > 0 ? 'over' : 'under'} suggested`
                        : locale === 'zh' ? `建议 ${segment.baselineMinutes} 分钟` : `Suggested ${segment.baselineMinutes}m`}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        <div className="space-y-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!canSaveReview}
            className="h-14 w-full rounded-full bg-zinc-900 text-base font-semibold text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 dark:bg-white dark:text-zinc-900"
          >
            {saved ? <Check className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
            {saved
              ? (locale === 'zh' ? '已保存' : 'Saved')
              : !canSaveReview
                ? (locale === 'zh' ? '没有改动' : 'No changes')
                : unresolvedBacklog && !overtimeDone
                  ? (locale === 'zh' ? '保存，下一步处理没做完的题' : 'Save, then handle unfinished questions')
                  : (locale === 'zh' ? '保存，看结果' : 'Save and see result')}
          </Button>
          <div className="flex items-center justify-between gap-3 px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            <span className="hidden md:inline">
              {locale === 'zh' ? '快捷键：Ctrl / ⌘ + Enter 保存' : 'Shortcut: Ctrl / ⌘ + Enter to save'}
            </span>
            {activeSession.status === 'debugged' && (dirtyReview || dirtyOvertime) && (
              <button
                type="button"
                onClick={() => {
                  resetReviewDraft();
                  setOvertimeMistakes(activeSession.overtimeMistakes ?? {});
                }}
                className="ml-auto underline-offset-2 hover:text-zinc-600 hover:underline dark:hover:text-zinc-300"
              >
                {locale === 'zh' ? '放弃这次修改' : 'Discard changes'}
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function parseMistakeCount(value: string, part: MistakeKey) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? Math.min(Math.max(0, parsed), PART_QUESTION_COUNTS[part]) : 0;
}
