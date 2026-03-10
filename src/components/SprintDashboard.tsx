'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getCopy, translateStatus } from '@/lib/i18n';
import { sumMistakes } from '@/lib/toeic';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

export function SprintDashboard() {
  const { sessions, activeSessionId, selectSession, locale } = useStore();
  const copy = getCopy(locale);

  const notStartedCount = sessions.filter((s) => s.status === 'not-started').length;
  const inProgressCount = sessions.filter((s) => s.status === 'in-progress').length;
  const debuggedCount = sessions.filter((s) => s.status === 'debugged').length;
  const progressPct = Math.round((debuggedCount / sessions.length) * 100);

  return (
    <section>
      <Card className="deck-card rounded-[28px]">
        <CardHeader className="deck-card-header px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative h-11 w-11 shrink-0">
                <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-zinc-200 dark:text-zinc-800" />
                  <circle
                    cx="18" cy="18" r="15.5"
                    fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeDasharray={`${progressPct} 100`}
                    strokeLinecap="round"
                    className="text-amber-400 transition-all duration-500"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-semibold text-zinc-700 dark:text-zinc-300">
                  {progressPct}%
                </span>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-amber-600 dark:text-amber-400">
                  {copy.dashboardTitle}
                </div>
                <div className="mt-1 max-w-2xl text-xs leading-6 text-zinc-500 dark:text-zinc-400">{copy.dashboardDescription}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusPill label={translateStatus(locale, 'not-started')} value={notStartedCount} tone="zinc" />
              <StatusPill label={translateStatus(locale, 'in-progress')} value={inProgressCount} tone="amber" />
              <StatusPill label={translateStatus(locale, 'debugged')} value={debuggedCount} tone="green" />
            </div>
          </div>

          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-linear-to-r from-amber-400 to-amber-500 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const mistakes = sumMistakes(session);
              const hasMistakes = mistakes > 0 && session.status !== 'not-started';

              const baseCls =
                session.status === 'debugged'
                  ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/10'
                  : session.status === 'in-progress'
                    ? 'border-amber-400/50 bg-amber-400/10 text-amber-700 dark:text-amber-300'
                    : 'border-zinc-200/80 bg-white/70 text-zinc-500 dark:border-white/8 dark:bg-white/[0.04] dark:text-zinc-400';

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => selectSession(session.id)}
                  className={cn(
                    'group relative flex min-h-32 flex-col rounded-[22px] border p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
                    baseCls,
                    isActive
                      ? 'z-10 -translate-y-0.5 border-amber-400 shadow-lg shadow-amber-400/15 ring-2 ring-amber-400/40'
                      : 'hover:-translate-y-0.5 hover:border-amber-300/60 hover:shadow-md hover:shadow-amber-400/8'
                  )}
                  aria-pressed={isActive}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-base font-bold leading-none tracking-tight">{session.id}</div>
                      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
                        Day {String(session.sprintDay).padStart(2, '0')}
                      </div>
                    </div>

                    <div className="rounded-full bg-current/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.22em] opacity-75">
                      {session.type === 'L' ? 'LC' : 'RC'}
                    </div>
                  </div>

                  <div className="mt-4 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {translateStatus(locale, session.status)}
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                    <div className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                      {session.type === 'L'
                        ? locale === 'zh'
                          ? '45 分钟听力计时'
                          : '45-minute listening timer'
                        : locale === 'zh'
                          ? '75 分钟阅读分段计时'
                          : '75-minute segmented reading timer'}
                    </div>

                    {hasMistakes ? (
                      <div className="rounded-lg bg-current/10 px-2 py-1 font-mono text-[10px] font-semibold tabular-nums">
                        -{mistakes}
                      </div>
                    ) : (
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-50">
                          {locale === 'zh' ? '无错题' : 'No misses'}
                      </div>
                    )}
                  </div>

                  <div className={cn(
                    'absolute top-2 right-2 size-1.5 rounded-full',
                    session.status === 'debugged' ? 'bg-emerald-400' :
                    session.status === 'in-progress' ? 'bg-amber-400 animate-pulse' :
                    'bg-zinc-300 dark:bg-zinc-700'
                  )} />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'zinc' | 'amber' | 'green';
}) {
  const cls =
    tone === 'amber'
      ? 'border-amber-400/30 bg-amber-400/8 text-amber-700 dark:text-amber-300'
      : tone === 'green'
        ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'
        : 'border-zinc-200/80 bg-white/72 text-zinc-500 dark:border-white/8 dark:bg-white/[0.04] dark:text-zinc-400';

  return (
    <div className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em]', cls)}>
      <span className="text-base font-semibold leading-none">{value}</span>
      <span className="opacity-70">{label}</span>
    </div>
  );
}
