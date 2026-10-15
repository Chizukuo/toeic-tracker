'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, Calendar, Crosshair, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

import { DashboardShell, useDashboardContext } from '@/components/DashboardShell';
import { getNextStepRecommendation, getWeakestPart } from '@/lib/nextStep';
import { estimateCurrentLevel } from '@/lib/toeic';
import { translatePart } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { MissionConfigDialog } from '@/components/MissionConfigDialog';
import { WelcomeGuide } from '@/components/WelcomeGuide';

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
  const router = useRouter();
  const examDate = useStore((state) => state.examDate);
  const setCount = useStore((state) => Math.max(state.sprintConfig.listeningCount, state.sprintConfig.readingCount));
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

  // Calendar days (local midnight to local midnight) so "tomorrow" always reads as 1; negative once the date has passed.
  const examDayOffset = useMemo(() => {
    const [year, month, day] = examDate.split('-').map(Number);
    const examDay = new Date(year, month - 1, day).getTime();
    const now = new Date(nowTs);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.round((examDay - today) / (24 * 60 * 60 * 1000));
  }, [examDate, nowTs]);
  const examDateIsSet = Number.isFinite(examDayOffset) && examDayOffset >= 0;
  const hasProgress = sessions.some(
    (session) => session.status !== 'not-started' || Boolean(session.timerSummary || session.timerRuntime)
  );

  // Recency-weighted level over the last few sets, so one off day does not swing the headline score.
  const level = useMemo(() => estimateCurrentLevel(sessions), [sessions]);
  const levelSummary = useMemo(() => {
    const zh = locale === 'zh';
    if (level.total && level.listening && level.reading) {
      const sets = Math.max(level.listening.setsUsed, level.reading.setsUsed);
      return {
        value: `${level.total.scaled}`,
        // CEFR is defined per section by ETS, so show both rather than one blended level.
        detail: zh
          ? `${level.total.interval.min}–${level.total.interval.max} · 听力 ${level.listening.cefr} / 阅读 ${level.reading.cefr}`
          : `${level.total.interval.min}–${level.total.interval.max} · L ${level.listening.cefr} / R ${level.reading.cefr}`,
        basis: sets > 1 ? (zh ? `近 ${sets} 套综合` : `Last ${sets} sets`) : (zh ? '根据 1 套' : 'From 1 set'),
      };
    }
    const section = level.listening ?? level.reading;
    if (!section) return null;
    const isListening = section.type === 'L';
    return {
      value: `${section.scaled}`,
      detail: zh
        ? `${isListening ? '听力' : '阅读'} ${section.interval.min}–${section.interval.max} · 再做一套${isListening ? '阅读' : '听力'}可看总分`
        : `${isListening ? 'Listening' : 'Reading'} ${section.interval.min}–${section.interval.max} · do a ${isListening ? 'reading' : 'listening'} set for a total`,
      basis: zh ? (isListening ? '仅听力' : '仅阅读') : (isListening ? 'Listening only' : 'Reading only'),
    };
  }, [level, locale]);

  const weakestPart = useMemo(() => getWeakestPart(sessions), [sessions]);

  const stageLabel = nextStep.kind === 'start-active' ? (locale === 'zh' ? '准备开始' : 'Ready') :
    nextStep.kind === 'resume-active' ? (locale === 'zh' ? '进行中' : 'In Progress') :
    nextStep.kind === 'resolve-backlog' ? (locale === 'zh' ? '有积压' : 'Backlog') :
    locale === 'zh' ? '下一步' : 'Next Step';

  return (
    <div className="space-y-8">
      <WelcomeGuide locale={locale} hasProgress={hasProgress} examDateIsSet={examDateIsSet} />

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
                  href={nextStep.href}
                  onClick={() => { if (nextStep.targetSessionId) selectSession(nextStep.targetSessionId); }}
                  className="inline-flex items-center gap-2.5 rounded-full bg-[var(--cheese-gold)] px-7 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(217,119,6,0.30)] transition-all hover:shadow-[0_6px_20px_rgba(217,119,6,0.40)] hover:brightness-110 dark:text-zinc-900"
                >
                  {nextStep.cta}
                  <ArrowRight className="size-4" />
                </Link>
              </motion.div>

              <span className="text-xs text-[var(--label-tertiary)]">{nextStep.helper}</span>
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
          {/* Phones wrap the sets into as many rows as fit; wider screens keep the two-row (L / R) layout. */}
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1 pb-1">
          <div
            className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5 sm:gap-2.5 md:grid-cols-[repeat(var(--session-columns),minmax(2.25rem,1fr))]"
            style={{ '--session-columns': Math.max(1, Math.ceil(sessions.length / 2)) } as CSSProperties}
          >
            {sessions.map((session) => {
              const isActive = session.id === activeSession.id;
              const isDone = session.status === 'debugged';
              const isInProgress = session.status === 'in-progress';

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      router.push('/practice');
                      return;
                    }
                    selectSession(session.id);
                  }}
                  title={`${session.label} — ${session.title}`}
                  aria-pressed={isActive}
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
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[var(--label-tertiary)]">
            <span>{locale === 'zh' ? 'L = 听力　R = 阅读' : 'L = Listening　R = Reading'}</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[var(--label-tertiary)]" />{locale === 'zh' ? '未开始' : 'Not started'}</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[var(--cheese-gold)]" />{locale === 'zh' ? '进行中' : 'In progress'}</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" />{locale === 'zh' ? '已对完答案' : 'Reviewed'}</span>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--label-tertiary)]">
            {locale === 'zh' ? '点一下选中套题，再点一次开始练习。' : 'Tap a set to select it; tap it again to start practicing.'}
          </p>
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
                  {levelSummary ? levelSummary.value : '—'}
                  {levelSummary && (
                    <span className="ml-2 align-middle text-xs font-medium text-[var(--label-tertiary)]">{levelSummary.basis}</span>
                  )}
                </div>
                <div className="mt-1.5 text-xs text-[var(--label-secondary)]">
                  {levelSummary
                    ? levelSummary.detail
                    : locale === 'zh' ? '做完一套并对完答案后显示' : 'Shows after you check one set'}
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
                    ? locale === 'zh' ? '目前错得最多的题型' : 'Where you miss the most'
                    : locale === 'zh' ? '填过错题数后显示' : 'Shows after you enter mistakes'}
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
                  {locale === 'zh' ? '距离考试' : 'Until exam'}
                </span>
              </div>
              {examDateIsSet ? (
                <div className="mt-4 text-3xl font-bold tracking-tight text-[var(--label-primary)]">
                  {examDayOffset}
                  <span className="ml-1 text-base font-normal text-[var(--label-tertiary)]">
                    {locale === 'zh' ? '天' : 'days'}
                  </span>
                </div>
              ) : (
                <div className="mt-4 text-xl font-bold text-[var(--label-primary)]">
                  {locale === 'zh' ? '设置考试日期' : 'Set your exam date'}
                </div>
              )}
              <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-[var(--label-secondary)]">
                <span className="font-medium">{examDateIsSet ? examDate : (locale === 'zh' ? '点这里修改日期和题量' : 'Tap to change date and plan')}</span>
                <span className="opacity-50">·</span>
                <span>{locale === 'zh' ? `共 ${setCount} 套` : `${setCount} Sets`}</span>
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