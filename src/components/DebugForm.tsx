'use client';

import { useMemo, useState } from 'react';
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
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

export function DebugForm({ activeSession }: { activeSession: SessionRecord }) {
  const saveDiagnostics = useStore((state) => state.saveDiagnostics);
  const saveOvertimeDiagnostics = useStore((state) => state.saveOvertimeDiagnostics);
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);
  const parts = useMemo(() => getPartsForType(activeSession.type), [activeSession.type]);
  const reasonOptions = useMemo(() => getReasonsForType(activeSession.type), [activeSession.type]);

  const [mistakes, setMistakes] = useState<Partial<Record<MistakeKey, number>>>(activeSession.mistakes);
  const [overtimeMistakes, setOvertimeMistakes] = useState<Partial<Record<MistakeKey, number>>>(activeSession.overtimeMistakes ?? {});
  const [reasons, setReasons] = useState<string[]>(activeSession.reasons);
  const [saved, setSaved] = useState(false);
  const [overtimeSaved, setOvertimeSaved] = useState(false);

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

  const updateMistake = (part: MistakeKey, value: string) => {
    const parsed = Number(value);
    setMistakes((current) => ({
      ...current,
      [part]: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
    }));
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

  const handleSave = () => {
    saveDiagnostics(activeSession.id, {
      mistakes,
      reasons,
      status: 'debugged',
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
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
  };

  return (
    <Card className="deck-card rounded-[26px]">
      <CardHeader className="deck-card-header px-6 py-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-500 dark:text-zinc-400">
          {activeSession.type === 'L' ? 'LISTENING REVIEW' : 'READING REVIEW'}
        </div>
        <CardTitle className="mt-1 text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-base">
          {copy.dataEntryTitle}
        </CardTitle>
        <CardDescription className="text-xs leading-6">
          {copy.dataEntryDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
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
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
              {locale === 'zh' ? '录入错题数' : 'Enter mistake count'}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {parts.map((part) => (
              <label key={part} className="deck-surface-soft p-3 transition-colors hover:border-amber-300/60 dark:hover:border-amber-300/25">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{translatePart(locale, part)}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
                    {mistakes[part] ?? 0}
                  </div>
                </div>
                <Input
                  type="number"
                  min="0"
                  className="mt-2 h-9 bg-white text-sm dark:bg-zinc-950"
                  value={mistakes[part] ?? ''}
                  onChange={(event) => updateMistake(part, event.target.value)}
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
                <label key={`overtime-${part}`} className="deck-surface-soft border-red-500/10 p-3 transition-colors hover:border-red-300/40 dark:hover:border-red-300/20">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{translatePart(locale, part)}</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
                      {overtimeMistakes[part] ?? 0}
                    </div>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    className="mt-2 h-9 bg-white text-sm dark:bg-zinc-950"
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
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
              {locale === 'zh' ? `已选 ${reasons.length}` : `${reasons.length} selected`}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {reasonOptions.map((reason) => {
              const active = reasons.includes(reason);
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => toggleReason(reason)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
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
          <Button size="sm" onClick={handleSave} className="w-full bg-zinc-950 font-mono text-xs uppercase tracking-[0.18em] text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200">
            {saved ? <Check className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
            {saved ? `${copy.saveDiagnostics} OK` : `${copy.saveDiagnostics} ${copy.markDebugged}`}
          </Button>
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
            <Button size="sm" onClick={handleSaveOvertime} className="w-full bg-red-500 font-mono text-xs uppercase tracking-[0.18em] text-white hover:bg-red-600">
              {overtimeSaved ? <Check className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
              {overtimeSaved
                ? locale === 'zh'
                  ? '已保存加时补录'
                  : 'Overtime Saved'
                : locale === 'zh'
                  ? '保存加时补录'
                  : 'Save Overtime Review'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
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
