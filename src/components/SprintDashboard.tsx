'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCopy, translateStatus } from '@/lib/i18n';
import { getIncorrectAnswers } from '@/lib/toeic';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

export function SprintDashboard() {
  const sessions = useStore((state) => state.sessions);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const selectSession = useStore((state) => state.selectSession);
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);

  const { cards, debuggedCount, inProgressCount, notStartedCount, progressPct } = useMemo(() => {
    let nextNotStartedCount = 0;
    let nextInProgressCount = 0;
    let nextDebuggedCount = 0;

    const nextCards = sessions.map((session) => {
      if (session.status === 'debugged') {
        nextDebuggedCount++;
      } else if (session.status === 'in-progress') {
        nextInProgressCount++;
      } else {
        nextNotStartedCount++;
      }

      const mistakes = getIncorrectAnswers(session);

      return {
        session,
        mistakes,
        hasMistakes: mistakes > 0 && session.status !== 'not-started',
      };
    });

    return {
      cards: nextCards,
      notStartedCount: nextNotStartedCount,
      inProgressCount: nextInProgressCount,
      debuggedCount: nextDebuggedCount,
      progressPct: sessions.length > 0 ? Math.round((nextDebuggedCount / sessions.length) * 100) : 0,
    };
  }, [sessions]);

  return (
    <motion.div 
      variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
      initial="hidden" animate="show"
    >
      <Card className="overflow-hidden rounded-[32px] border border-black/[0.04] dark:border-white/[0.04] bg-white dark:bg-[#1C1C1E] shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none">
        <CardHeader className="px-6 py-6 border-b border-black/[0.04] dark:border-white/[0.04]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative h-12 w-12 shrink-0">
                <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-zinc-100 dark:text-zinc-800" />
                  <circle
                    cx="18" cy="18" r="15.5"
                    fill="none" stroke="currentColor" strokeWidth="3"
                    strokeDasharray={`${progressPct} 100`}
                    strokeLinecap="round"
                    className="text-amber-500 transition-all duration-1000 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-zinc-900 dark:text-zinc-100">
                  {progressPct}%
                </span>
              </div>
              <div>
                <CardTitle className="text-[12px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                  {copy.dashboardTitle}
                </CardTitle>
                <div className="mt-1 max-w-2xl text-[14px] leading-relaxed text-zinc-500">{copy.dashboardDescription}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusPill label={translateStatus(locale, 'not-started')} value={notStartedCount} tone="zinc" />
              <StatusPill label={translateStatus(locale, 'in-progress')} value={inProgressCount} tone="amber" />
              <StatusPill label={translateStatus(locale, 'debugged')} value={debuggedCount} tone="green" />
            </div>
          </div>

          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1, ease: [0.32, 0.72, 0, 1] }}
              className="h-full rounded-full bg-amber-500"
            />
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10">
            {cards.map(({ session, mistakes, hasMistakes }) => {
              const isActive = session.id === activeSessionId;

              const baseCls =
                session.status === 'debugged'
                  ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/10'
                  : session.status === 'in-progress'
                    ? 'border-amber-400/50 bg-amber-400/10 text-amber-700 dark:text-amber-300'
                    : 'border-zinc-200/80 bg-white/70 text-zinc-500 dark:border-white/8 dark:bg-white/4 dark:text-zinc-400';

              return (
                <motion.button
                  key={session.id}
                  variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: { type: 'spring', bounce: 0.2 } } }}
                  type="button"
                  onClick={() => selectSession(session.id)}
                  className={cn(
                    'group relative flex min-h-32 flex-col rounded-[24px] border p-4 text-left transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96]',
                    baseCls,
                    isActive
                      ? 'z-10 bg-white dark:bg-[#2C2C2E] border-amber-400 shadow-[0_8px_32px_rgba(245,165,36,0.15)] ring-1 ring-amber-400/20'
                      : 'border-black/[0.04] dark:border-white/[0.04] bg-white dark:bg-[#1C1C1E] hover:bg-zinc-50 dark:hover:bg-[#2C2C2E]'
                  )}
                  aria-pressed={isActive}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-bold leading-none tracking-tight text-zinc-900 dark:text-zinc-50">{session.id}</div>
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        Day {String(session.sprintDay).padStart(2, '0')}
                      </div>
                    </div>

                    <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      {session.type === 'L' ? 'LC' : 'RC'}
                    </div>
                  </div>

                  <div className="mt-4 text-[13px] font-medium text-zinc-500">
                    {translateStatus(locale, session.status)}
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                    <div className="text-[11px] font-medium leading-[1.4] text-zinc-400">
                      {session.type === 'L'
                        ? locale === 'zh' ? '45 min' : '45 min'
                        : locale === 'zh' ? '75 min' : '75 min'}
                    </div>

                    {hasMistakes ? (
                      <div className="rounded-lg bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                        -{mistakes}
                      </div>
                    ) : (
                      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-300 dark:text-zinc-700">
                        {locale === 'zh' ? 'CLEAN' : 'CLEAN'}
                      </div>
                    )}
                  </div>

                  <div className={cn(
                    'absolute top-4 right-4 size-2 rounded-full',
                    session.status === 'debugged' ? 'bg-emerald-500' :
                    session.status === 'in-progress' ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                    'bg-zinc-200 dark:bg-zinc-800'
                  )} />
                </motion.button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
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
      ? 'border-amber-400/20 bg-amber-400/5 text-amber-600 dark:text-amber-400'
      : tone === 'green'
        ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
        : 'border-black/[0.04] dark:border-white/[0.04] bg-zinc-50/50 text-zinc-500';

  return (
    <div className={cn('flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest', cls)}>
      <span className="text-zinc-900 dark:text-zinc-100">{value}</span>
      <span className="opacity-60">{label}</span>
    </div>
  );
}
