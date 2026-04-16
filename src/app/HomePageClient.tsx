'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, Calendar, Crosshair, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

import { DashboardShell, useDashboardContext } from '@/components/DashboardShell';
import { getNextStepRecommendation } from '@/lib/nextStep';
import { estimateToeicCombinedScore, isSessionEstimateEligible, type MistakeKey } from '@/lib/toeic';
import { translatePart } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { MissionConfigDialog } from '@/components/MissionConfigDialog';

const ActivityCalendar = dynamic(() => import('@/components/ActivityCalendar').then(mod => mod.ActivityCalendar));
const WeeklyReport = dynamic(() => import('@/components/WeeklyReport').then(mod => mod.WeeklyReport));
const AchievementPanel = dynamic(() => import('@/components/AchievementPanel').then(mod => mod.AchievementPanel));

export default function HomePageClient() {
  return (
    <DashboardShell>
      <MissionControl />
    </DashboardShell>
  );
}

function MissionControl() {
  const { locale, activeSession, sessions, homeMetrics } = useDashboardContext();
  const selectSession = useStore((state) => state.selectSession);
  const examDate = useStore((state) => state.examDate);
  const historicalScoreCount = useStore((state) => state.historicalScores.length);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const nextStep = useMemo(
    () =>
      getNextStepRecommendation({
        locale,
        sessions,
        activeSessionId: activeSession.id,
        historicalScoreCount,
      }),
    [activeSession.id, historicalScoreCount, locale, sessions]
  );

  const nextStepHref = nextStep.href === '/timer' ? '/practice' :
                       nextStep.href === '/analytics' ? '/insights' :
                       nextStep.href === '/scores' ? '/insights' :
                       nextStep.href === '/unfinished' ? '/insights' : nextStep.href;

  const daysUntilExam = useMemo(() => {
    const target = new Date(`${examDate}T09:00:00`);
    const diff = target.getTime() - nowTs;
    return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
  }, [examDate, nowTs]);

  const scoreEstimate = useMemo(() => {
    const latestL = [...sessions].reverse().find((s) => s.type === 'L' && isSessionEstimateEligible(s));
    const latestR = [...sessions].reverse().find((s) => s.type === 'R' && isSessionEstimateEligible(s));
    if (!latestL && !latestR) return null;
    const combined = estimateToeicCombinedScore(latestL, latestR, 'strict');
    return combined.available ? combined : null;
  }, [sessions]);

  const weakestPart = useMemo(() => {
    const completed = sessions.filter((s) => s.status !== 'not-started');
    if (completed.length === 0) return null;
    let worst: MistakeKey | null = null;
    let worstRate = -1;
    for (const s of completed) {
      const parts: MistakeKey[] = s.type === 'L'
        ? ['Part 1', 'Part 2', 'Part 3', 'Part 4']
        : ['Part 5', 'Part 6', 'Part 7 Single', 'Part 7 Multiple'];
      for (const p of parts) {
        const mistakes = (s.mistakes as Record<string, number>)[p] ?? 0;
        const total = ({ 'Part 1': 6, 'Part 2': 25, 'Part 3': 39, 'Part 4': 30, 'Part 5': 30, 'Part 6': 16, 'Part 7 Single': 29, 'Part 7 Multiple': 25 } as Record<string, number>)[p] ?? 1;
        const rate = mistakes / total;
        if (rate > worstRate) { worstRate = rate; worst = p; }
      }
    }
    return worst;
  }, [sessions]);

  const stageLabel = nextStep.kind === 'start-active' ? (locale === 'zh' ? '准备开始' : 'Ready') :
    nextStep.kind === 'resume-active' ? (locale === 'zh' ? '进行中' : 'In Progress') :
    nextStep.kind === 'resolve-backlog' ? (locale === 'zh' ? '有积压' : 'Backlog') :
    locale === 'zh' ? '下一步' : 'Next Step';

  return (
    <div className="space-y-8">
      {/* ─── Main Task Card (Premium CTA) ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.1, duration: 0.5 }}
      >
        <div className="cheese-card overflow-hidden">
          {/* Amber accent top bar */}
          <div className="h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(217,119,6,0.4)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
                {stageLabel}
              </span>
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight text-[var(--label-primary)] sm:text-3xl">
              {nextStep.title}
            </h1>

            <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-[var(--label-secondary)]">
              {nextStep.body}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <motion.div whileTap={{ scale: 0.97 }} className="inline-block">
                <Link
                  href={nextStepHref}
                  onClick={() => { if (nextStep.targetSessionId) selectSession(nextStep.targetSessionId); }}
                  className="inline-flex items-center gap-2.5 rounded-full bg-[var(--cheese-gold)] px-7 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(217,119,6,0.30)] transition-all hover:shadow-[0_6px_20px_rgba(217,119,6,0.40)] hover:brightness-110 dark:text-zinc-900"
                >
                  {nextStep.cta}
                  <ArrowRight className="size-4" />
                </Link>
              </motion.div>

              {nextStep.targetSessionId && (
                <span className="cheese-pill">{nextStep.targetSessionId}</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Sprint Progress Grid ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.1, duration: 0.5, delay: 0.08 }}
      >
        <div className="flex items-center justify-between px-1 mb-3">
          <h2 className="text-sm font-bold text-[var(--label-primary)]">
            {locale === 'zh' ? '冲刺进度' : 'Sprint Progress'}
          </h2>
          <span className="text-xs font-medium text-[var(--label-secondary)]">
            {homeMetrics.completionPct}% · {homeMetrics.debuggedCount}/{homeMetrics.totalSessions}
          </span>
        </div>

        <div className="cheese-card p-4 sm:p-5">
          {/* Progress bar */}
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-grouped)]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${homeMetrics.completionPct}%` }}
              transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500"
            />
          </div>

          {/* Dynamic dot grid */}
          <div 
            className="grid gap-1.5 sm:gap-2.5" 
            style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.ceil(sessions.length / 2))}, minmax(0, 1fr))` }}
          >
            {sessions.map((session) => {
              const isActive = session.id === activeSession.id;
              const isDone = session.status === 'debugged';
              const isInProgress = session.status === 'in-progress';

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => selectSession(session.id)}
                  title={`${session.label} — ${session.title}`}
                  className={cn(
                    'relative group flex flex-col items-center justify-center gap-1.5 rounded-[10px] p-1.5 transition-colors sm:p-2',
                    isActive
                      ? '' // active styling is handled by the sliding background
                      : isDone
                        ? 'bg-emerald-500/8 hover:bg-emerald-500/15 dark:bg-emerald-500/10'
                        : isInProgress
                          ? 'bg-amber-500/8 hover:bg-amber-500/15 dark:bg-amber-500/10'
                          : 'bg-[var(--surface-grouped)]/50 hover:bg-[var(--surface-grouped)]'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeSessionHighlight"
                      className="absolute inset-0 rounded-[10px] bg-[var(--cheese-gold-soft)] ring-2 ring-[var(--cheese-gold)]/40 pointer-events-none"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <div
                    className={cn(
                      'relative z-10 size-3 rounded-full transition-transform sm:size-4',
                      isDone
                        ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]'
                        : isInProgress || isActive
                          ? 'bg-[var(--cheese-gold)] shadow-[0_0_6px_rgba(217,119,6,0.3)]'
                          : 'bg-[var(--label-tertiary)]',
                      'group-hover:scale-110'
                    )}
                  />
                  <span className={cn(
                    'relative z-10 text-[9px] font-bold leading-none sm:text-[10px]',
                    isActive ? 'text-[var(--cheese-gold)]' : 'text-[var(--label-tertiary)]'
                  )}>
                    {session.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ─── 3 Signal Cards ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.1, duration: 0.5, delay: 0.16 }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Score Estimate */}
          <motion.div whileTap={{ scale: 0.97 }}>
            <Link href="/insights" className="group block h-full">
              <div className="cheese-card cheese-card-amber h-full p-5">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-full bg-[var(--cheese-gold-soft)]">
                    <Zap className="size-3.5 text-[var(--cheese-gold)]" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
                    {locale === 'zh' ? '估分' : 'Score'}
                  </span>
                </div>
                <div className="mt-4 text-3xl font-bold tracking-tight text-[var(--label-primary)]">
                  {scoreEstimate ? scoreEstimate.total : '—'}
                </div>
                <div className="mt-1.5 text-xs text-[var(--label-secondary)]">
                  {scoreEstimate
                    ? `${scoreEstimate.interval.min}–${scoreEstimate.interval.max} · ${scoreEstimate.cefr}`
                    : locale === 'zh' ? '完成至少一套后可估分' : 'Complete a set to estimate'}
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Weakest Part */}
          <motion.div whileTap={{ scale: 0.97 }}>
            <Link href="/insights" className="group block h-full">
              <div className="cheese-card cheese-card-rose h-full p-5">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-full bg-rose-500/10 dark:bg-rose-500/15">
                    <Crosshair className="size-3.5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
                    {locale === 'zh' ? '弱项' : 'Weak Spot'}
                  </span>
                </div>
                <div className="mt-4 text-xl font-bold text-[var(--label-primary)]">
                  {weakestPart ? translatePart(locale, weakestPart) : '—'}
                </div>
                <div className="mt-1.5 text-xs text-[var(--label-secondary)]">
                  {weakestPart
                    ? locale === 'zh' ? '当前最大失分源' : 'Highest loss source'
                    : locale === 'zh' ? '暂无数据' : 'No data yet'}
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Exam Countdown (Clickable for Goal Config) */}
          <motion.div whileTap={{ scale: 0.97 }} className="h-full">
            <button 
               type="button"
               onClick={() => setIsConfigOpen(true)}
               className="cheese-card cheese-card-cyan h-full p-5 text-left w-full hover:brightness-105 transition-all"
            >
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-full bg-[var(--cheese-cyan-soft)]">
                  <Calendar className="size-3.5 text-[var(--cheese-cyan)]" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
                  {locale === 'zh' ? '目标配置' : 'Mission Goal'}
                </span>
              </div>
              <div className="mt-4 text-3xl font-bold tracking-tight text-[var(--label-primary)]">
                {daysUntilExam}
                <span className="ml-1 text-base font-normal text-[var(--label-tertiary)]">
                  {locale === 'zh' ? '天' : 'days'}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-[var(--label-secondary)]">
                <span className="font-medium">{examDate}</span>
                <span className="opacity-50">·</span>
                <span>{locale === 'zh' ? `设为 ${sessions.length / 2} 套` : `${sessions.length / 2} Sets`}</span>
              </div>
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* ─── Engagement Area (Heatmap & Digest) ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.1, duration: 0.5, delay: 0.24 }}
        className="grid gap-6 lg:grid-cols-[1fr_300px]"
      >
        <ActivityCalendar />
        <div className="flex flex-col justify-end gap-6">
          <AchievementPanel />
          <WeeklyReport />
        </div>
      </motion.div>

      <MissionConfigDialog 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} 
      />
    </div>
  );
}