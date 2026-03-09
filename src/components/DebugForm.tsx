'use client';

import { useMemo, useState } from 'react';
import { Check, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getCopy, translatePart, translateReason } from '@/lib/i18n';
import {
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
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);
  const parts = useMemo(() => getPartsForType(activeSession.type), [activeSession.type]);
  const reasonOptions = useMemo(() => getReasonsForType(activeSession.type), [activeSession.type]);

  const [mistakes, setMistakes] = useState<Partial<Record<MistakeKey, number>>>(activeSession.mistakes);
  const [reasons, setReasons] = useState<string[]>(activeSession.reasons);
  const [saved, setSaved] = useState(false);

  const updateMistake = (part: MistakeKey, value: string) => {
    const parsed = Number(value);
    setMistakes((current) => ({
      ...current,
      [part]: Number.isNaN(parsed) ? 0 : parsed,
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

  return (
    <Card className="glass-panel overflow-hidden rounded-[26px] border-zinc-200/70 shadow-sm dark:border-zinc-800">
      <CardHeader className="border-b border-zinc-100 bg-zinc-50/70 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950/60">
        <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-500 dark:text-zinc-400">
          {activeSession.type === 'L' ? 'LISTENING DEBUG' : 'READING DEBUG'}
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
          <QuickInfoCard label={copy.currentMistakes} value={`${sumMistakes({ ...activeSession, mistakes })}`} helper={copy.liveTotalInForm} />
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

        {activeSession.type === 'R' && (
          <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">{copy.lapSync}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {READING_LAP_SEGMENTS.map((segment) => {
                const actual = activeSession.readingLapTimes[segment.key];
                const delta = actual !== undefined ? actual / 60000 - segment.baselineMinutes : undefined;
                return (
                  <div key={segment.key} className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/70">
                    <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{translatePart(locale, segment.key)}</div>
                    <div className="mt-1.5 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {actual !== undefined ? formatMinutes(actual) : '--'}
                    </div>
                    <div className={`mt-0.5 font-mono text-[10px] ${delta !== undefined && delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {delta !== undefined ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}m vs ${segment.baselineMinutes}m` : `base ${segment.baselineMinutes}m`}
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
              {locale === 'zh' ? '输入错题数' : 'Enter misses'}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {parts.map((part) => (
              <label key={part} className="rounded-2xl border border-zinc-200/70 bg-zinc-50/60 p-3 transition-colors hover:border-amber-300/60 dark:border-zinc-800 dark:bg-zinc-900/50">
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
                      : 'border-zinc-200 bg-white text-zinc-500 hover:border-amber-300 hover:text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400'
                  )}
                  aria-pressed={active}
                >
                  {translateReason(locale, reason)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>{locale === 'zh' ? '保存后会把当前套题标记为已 Debug。' : 'Saving will mark this set as debugged.'}</span>
            <span className="font-mono uppercase tracking-[0.2em]">{sumMistakes({ ...activeSession, mistakes })}</span>
          </div>
          <Button size="sm" onClick={handleSave} className="w-full bg-zinc-950 font-mono text-xs uppercase tracking-[0.18em] text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200">
            {saved ? <Check className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
            {saved ? `${copy.saveDiagnostics} OK` : `${copy.saveDiagnostics} ${copy.markDebugged}`}
          </Button>
        </div>
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
    <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">{label}</div>
      <div className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{value}</div>
      <div className="mt-0.5 text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">{helper}</div>
    </div>
  );
}
