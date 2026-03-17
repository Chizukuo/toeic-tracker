'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { ComponentType, ReactNode } from 'react';
import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle, Clock, Database, Home, Target, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { LocaleToggle } from '@/components/LocaleToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BrandIconSvg } from '@/lib/brandIcon';
import { formatHotspot, formatSessionTitle, formatWorstPart, getCopy, translateStatus, type Locale } from '@/lib/i18n';
import { getIncorrectAnswers, type SessionRecord } from '@/lib/toeic';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

type DashboardContextValue = {
  sessions: SessionRecord[];
  locale: Locale;
  copy: ReturnType<typeof getCopy>;
  activeSession: SessionRecord;
  homeMetrics: {
    activeSession: SessionRecord;
    debuggedCount: number;
    liveCount: number;
    overtimeCount: number;
    totalMistakeLoad: number;
    unfinishedTotal: number;
    unfinishedSessionsCount: number;
    completionPct: number;
  };
  focusSignals: Array<{
    label: string;
    value: string;
    helper: string;
  }>;
  overviewSignals: Array<{
    label: string;
    value: string;
    detail: string;
    tone: 'amber' | 'slate' | 'coral' | 'cyan';
  }>;
  timedOutFlag: boolean;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboardContext() {
  const value = useContext(DashboardContext);

  if (!value) {
    throw new Error('useDashboardContext must be used within DashboardShell');
  }

  return value;
}

export function DashboardShell({
  children,
  variant = 'hero',
}: {
  children: ReactNode;
  variant?: 'hero' | 'compact';
}) {
  const sessions = useStore((state) => state.sessions);
  const ensureInitialized = useStore((state) => state.ensureInitialized);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const selectSession = useStore((state) => state.selectSession);
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);
  const pathname = usePathname();

  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized]);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  const homeMetrics = useMemo(() => {
    const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
    let debuggedCount = 0;
    let liveCount = 0;
    let overtimeCount = 0;
    let totalMistakeLoad = 0;
    let unfinishedTotal = 0;
    let unfinishedSessionsCount = 0;

    for (const session of sessions) {
      if (session.status === 'debugged') debuggedCount++;
      else if (session.status === 'in-progress') liveCount++;

      if (session.timerSummary?.timedOut) {
        overtimeCount++;
      }

      totalMistakeLoad += getIncorrectAnswers(session);

      if (session.type === 'R') {
        const unfinished = session.timerSummary?.unfinishedQuestions ?? 0;
        unfinishedTotal += unfinished;
        if (unfinished > 0) {
          unfinishedSessionsCount++;
        }
      }
    }

    if (!activeSession) {
      return null;
    }

    return {
      activeSession,
      debuggedCount,
      liveCount,
      overtimeCount,
      totalMistakeLoad,
      unfinishedTotal,
      unfinishedSessionsCount,
      completionPct: sessions.length > 0 ? Math.round((debuggedCount / sessions.length) * 100) : 0,
    };
  }, [activeSessionId, sessions]);

  if (!homeMetrics) {
    return null;
  }

  const activeSession = homeMetrics.activeSession;
  const timedOutFlag = Boolean(activeSession.timerSummary?.timedOut);
  const unresolvedBacklog =
    activeSession.type === 'R' &&
    (activeSession.timerSummary?.unfinishedQuestions ?? 0) > 0 &&
    !activeSession.timerSummary?.resolvedUnfinished;
  const isTimingActive = Boolean(activeSession.timerRuntime?.startedAt) && !activeSession.timerSummary;
  const isOvertimeActive = Boolean(activeSession.timerRuntime?.isOvertime);

  const nextSession = sessions.find((session) => session.status !== 'debugged' && session.id !== activeSession.id);

  const primaryTask = isOvertimeActive
    ? {
        stage: locale === 'zh' ? '补录中' : 'Overtime',
        title: locale === 'zh' ? '继续加时补录，完成后再保存复盘' : 'Continue overtime resolution, then save review',
        helper: locale === 'zh' ? '严格分已锁定，当前只影响潜力分。' : 'Strict score is locked. Current work only affects potential score.',
        href: '/timer',
        cta: locale === 'zh' ? '继续补录' : 'Resume Overtime',
      }
    : isTimingActive
      ? {
          stage: locale === 'zh' ? '计时中' : 'Timing',
          title: locale === 'zh' ? '当前计时进行中，优先完成本套操作' : 'The active timer is running, finish this set first',
          helper: locale === 'zh' ? '结束后会自动进入复盘录入。' : 'You will move directly into review input after the run.',
          href: '/timer',
          cta: locale === 'zh' ? '返回计时页' : 'Back To Timer',
        }
      : unresolvedBacklog || (activeSession.timerSummary && activeSession.status !== 'debugged')
        ? {
            stage: locale === 'zh' ? '待复盘' : 'Review',
            title: locale === 'zh' ? '本套已完成计时，下一步是录入错题并完成复盘' : 'Timing is done. Log mistakes and complete review next',
            helper: locale === 'zh' ? '未录入前，趋势和估分可信度会下降。' : 'Trends and estimates remain less reliable until review is saved.',
            href: '/timer',
            cta: locale === 'zh' ? '去录入复盘' : 'Open Review',
          }
        : activeSession.status === 'debugged' && nextSession
          ? {
              stage: locale === 'zh' ? '下一套' : 'Next Set',
              title: locale === 'zh' ? `当前已完成，建议切换到 ${nextSession.label}` : `Current set is done. Move to ${nextSession.label}`,
              helper: locale === 'zh' ? '保持连续节奏，比频繁切页更重要。' : 'Maintaining momentum matters more than bouncing across pages.',
              href: '/timer',
              cta: locale === 'zh' ? `切换到 ${nextSession.label}` : `Switch To ${nextSession.label}`,
              targetSessionId: nextSession.id,
            }
          : {
              stage: locale === 'zh' ? '准备开始' : 'Ready',
              title: locale === 'zh' ? '当前套题可直接开始严格计时' : 'The current set is ready for strict timing',
              helper: locale === 'zh' ? '先开始，再在结束后统一处理复盘。' : 'Start first, then complete review in one pass after finishing.',
              href: '/timer',
              cta: locale === 'zh' ? '开始本套计时' : 'Start Timer',
            };

  const focusSignals = [
    {
      label: copy.status,
      value: translateStatus(locale, activeSession.status),
      helper:
        activeSession.type === 'L'
          ? locale === 'zh'
            ? '45 分钟整套听力计时'
            : '45-minute full listening timer'
          : locale === 'zh'
            ? '75 分钟阅读分段计时'
            : '75-minute segmented reading timer',
    },
    {
      label: locale === 'zh' ? '目标时长' : 'Target',
      value: `${activeSession.targetMinutes}m`,
      helper:
        activeSession.type === 'L'
          ? locale === 'zh'
            ? '按完整套题连续完成'
            : 'Run the listening set in one pass'
          : locale === 'zh'
            ? '按 Part 5 / 6 / 7 记录'
            : 'Capture Part 5 / 6 / 7 checkpoints',
    },
    {
      label: copy.unfinishedTrackerTitle,
      value: copy.unfinished(homeMetrics.unfinishedTotal),
      helper:
        locale === 'zh'
          ? `涉及 ${homeMetrics.unfinishedSessionsCount} 个 session`
          : `${homeMetrics.unfinishedSessionsCount} sessions affected`,
    },
    {
      label: copy.hotRootCause,
      value: formatHotspot(locale, sessions),
      helper:
        locale === 'zh'
          ? `薄弱项 ${formatWorstPart(locale, sessions)}`
          : `Weak spot ${formatWorstPart(locale, sessions)}`,
    },
  ];

  const overviewSignals = [
    {
      label: copy.summaryDebugged,
      value: `${homeMetrics.debuggedCount}/20`,
      detail: copy.summaryDebuggedHelper,
      tone: 'amber' as const,
    },
    {
      label: copy.summaryInProgress,
      value: `${homeMetrics.liveCount}`,
      detail: copy.summaryInProgressHelper,
      tone: 'slate' as const,
    },
    {
      label: copy.summaryTimeout,
      value: `${homeMetrics.overtimeCount}`,
      detail: copy.summaryTimeoutHelper,
      tone: 'coral' as const,
    },
    {
      label: copy.summaryMistakes,
      value: `${homeMetrics.totalMistakeLoad}`,
      detail: copy.summaryMistakesHelper,
      tone: 'cyan' as const,
    },
  ];

  const navigationItems = [
    { href: '/', label: locale === 'zh' ? '总览' : 'Overview', icon: Home },
    { href: '/plan', label: copy.dashboardTitle, icon: Target },
    { href: '/timer', label: locale === 'zh' ? '计时' : 'Timer', icon: Clock },
    { href: '/unfinished', label: copy.unfinishedTrackerTitle, icon: CheckCircle },
    { href: '/analytics', label: copy.analyticsTitle, icon: BarChart2 },
    { href: '/scores', label: copy.scoreEstimatorTitle, icon: Target },
    { href: '/vault', label: copy.dataVaultTitle, icon: Database },
  ];

  const currentNavIndex = navigationItems.findIndex((item) => item.href === pathname);
  const previousNavItem = currentNavIndex > 0 ? navigationItems[currentNavIndex - 1] : undefined;
  const nextNavItem = currentNavIndex >= 0 && currentNavIndex < navigationItems.length - 1 ? navigationItems[currentNavIndex + 1] : undefined;

  const compactSignals = [
    {
      label: locale === 'zh' ? '当前 Session' : 'Current Session',
      value: activeSession.label,
      helper: formatSessionTitle(locale, activeSession),
    },
    {
      label: locale === 'zh' ? '总进度' : 'Progress',
      value: `${homeMetrics.completionPct}%`,
      helper: locale === 'zh' ? `${homeMetrics.debuggedCount}/20 已复盘` : `${homeMetrics.debuggedCount}/20 reviewed`,
    },
    {
      label: copy.worstPart,
      value: formatWorstPart(locale, sessions),
      helper: locale === 'zh' ? '当前最需要补强的模块' : 'Current weakest module',
    },
  ];

  return (
    <DashboardContext.Provider
      value={{
        sessions,
        locale,
        copy,
        activeSession,
        homeMetrics,
        focusSignals,
        overviewSignals,
        timedOutFlag,
      }}
    >
      <main className="relative min-h-screen overflow-x-hidden pt-24 px-4 pb-14 text-zinc-950 dark:text-zinc-50 sm:px-6 lg:px-8">
        <div className="pointer-events-none fixed inset-0 bg-zinc-50/50 dark:bg-zinc-950/50" />
        <div className="pointer-events-none fixed inset-0 opacity-60 mix-blend-multiply dark:mix-blend-screen bg-[radial-gradient(circle_at_12%_16%,rgba(255,196,75,0.08),transparent_30%),radial-gradient(circle_at_88%_14%,rgba(62,203,255,0.04),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(239,114,84,0.03),transparent_35%)] dark:bg-[radial-gradient(circle_at_12%_16%,rgba(255,196,75,0.04),transparent_30%),radial-gradient(circle_at_88%_14%,rgba(62,203,255,0.02),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(239,114,84,0.02),transparent_35%)]" />

        <header className="fixed top-4 left-1/2 z-50 flex w-[calc(100%-1rem)] max-w-350 -translate-x-1/2 items-center justify-between gap-1.5 rounded-[28px] border border-white/40 bg-white/60 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-2xl transition-all duration-300 sm:w-[calc(100%-2rem)] lg:gap-3 dark:border-white/10 dark:bg-zinc-900/60 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
           <Link href="/" aria-label={copy.appName} className="relative z-10 ml-2 flex shrink-0 items-center justify-center transition-transform hover:scale-105 active:scale-95">
             <BrandIconSvg className="size-7 opacity-90" />
          </Link>
          
          <nav className="no-scrollbar flex min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto px-1 md:justify-center md:px-2 lg:gap-1.5">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-2.5 py-2 text-[13px] font-medium transition-colors md:px-3 lg:px-4 lg:py-2 lg:text-sm",
                    isActive ? "text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="dock-indicator"
                      className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:bg-zinc-800 dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon className="size-4" />
                    <span className="hidden md:inline-block">{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
          
          <div className="relative z-10 mr-1 flex shrink-0 items-center gap-1 sm:gap-1.5">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </header>

        <div className="relative mx-auto flex w-full max-w-395 flex-col gap-8">
          
          <AnimatePresence>
            {primaryTask && (
              <motion.div 
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="mx-auto w-full max-w-4xl pt-2"
              >
                <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[28px] border border-white/40 bg-white/50 p-4 pl-6 shadow-[0_8px_24px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-all hover:bg-white/60 dark:border-white/10 dark:bg-zinc-900/50 dark:shadow-[0_8px_24px_rgba(0,0,0,0.2)] dark:hover:bg-zinc-900/60">
                   <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="flex size-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">{primaryTask.stage}</span>
                      </div>
                      <span className="mt-1.5 text-base font-medium text-zinc-900 dark:text-zinc-100">{primaryTask.title}</span>
                      <span className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{primaryTask.helper}</span>
                   </div>
                   <Link 
                     href={primaryTask.href} 
                     onClick={() => { if (primaryTask.targetSessionId) selectSession(primaryTask.targetSessionId); }}
                     className="inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-transform hover:scale-105 active:scale-95 dark:bg-white dark:text-zinc-900"
                   >
                     {primaryTask.cta}
                   </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {variant === 'hero' ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_320px]">
              <section className="grid gap-6">
                <Card className="overflow-hidden rounded-[32px] border border-white/40 bg-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/40 dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                  <CardContent className="p-8 lg:p-10">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                          {locale === 'zh' ? '当前任务' : 'Current Task'}
                        </div>
                        <h1 className={cn(
                          'mt-4 max-w-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50',
                          locale === 'zh' ? 'text-[2.5rem] leading-[1.05] sm:text-[3.5rem]' : 'text-[2.5rem] leading-[1.05] sm:text-[3.2rem]'
                        )}>
                          {formatSessionTitle(locale, activeSession)}
                        </h1>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <MiniBadge label={activeSession.label} />
                          <MiniBadge label={copy.sprintDay(activeSession.sprintDay)} />
                          <MiniBadge label={activeSession.type === 'L' ? 'LC 45m' : 'RC 75m'} />
                        </div>
                      </motion.div>

                      <StatusBadge status={translateStatus(locale, activeSession.status)} sessionStatus={activeSession.status} />
                    </div>

                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                      {focusSignals.map((signal, idx) => (
                        <motion.div key={signal.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + idx * 0.05 }}>
                          <InlineStat label={signal.label} value={signal.value} helper={signal.helper} />
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                  {overviewSignals.map((signal, idx) => (
                    <motion.div key={signal.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + idx * 0.05 }}>
                      <OverviewSignal
                        label={signal.label}
                        value={signal.value}
                        detail={signal.detail}
                        tone={signal.tone}
                      />
                    </motion.div>
                  ))}
                </div>
              </section>

              <aside className="grid gap-6">
                <ExamCountdownPanel locale={locale} />

                <div className="rounded-[32px] border border-zinc-200/50 bg-[linear-gradient(180deg,rgba(255,247,230,0.5),rgba(255,255,255,0.4))] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.03)] backdrop-blur-2xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,196,75,0.04),rgba(16,18,24,0.6))] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                        {locale === 'zh' ? '总进度' : 'Progress'}
                      </div>
                      <div className="mt-3 font-mono text-5xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                        {homeMetrics.completionPct}
                        <span className="text-2xl text-zinc-400">%</span>
                      </div>
                    </div>

                    <div className="text-right text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                      {locale === 'zh' ? `${homeMetrics.debuggedCount}/20 已完成复盘` : `${homeMetrics.debuggedCount}/20 reviewed`}
                    </div>
                  </div>

                  <div className="mt-6 h-2 overflow-hidden rounded-full bg-zinc-200/60 dark:bg-zinc-800/60">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${homeMetrics.completionPct}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full rounded-full bg-[linear-gradient(90deg,#ffcc57_0%,#ff8f56_52%,#54d4ff_100%)]"
                    />
                  </div>

                  <div className="mt-6 space-y-3">
                    <QuickInfoRow label={copy.worstPart} value={formatWorstPart(locale, sessions)} />
                    <QuickInfoRow label={copy.hotRootCause} value={formatHotspot(locale, sessions)} />
                    <QuickInfoRow
                      label={locale === 'zh' ? '时限状态' : 'Timing'}
                      value={timedOutFlag ? (locale === 'zh' ? '当前 session 已超时' : 'Current session timed out') : activeSession.type === 'L' ? 'LC 45m' : 'RC 75m'}
                      danger={timedOutFlag}
                    />
                  </div>

                  <div className="mt-6 space-y-4">
                    <ProgressLine label={copy.summaryDebugged} value={homeMetrics.debuggedCount} max={20} tone="amber" />
                    <ProgressLine label={copy.summaryInProgress} value={homeMetrics.liveCount} max={20} tone="slate" />
                    <ProgressLine label={copy.summaryTimeout} value={homeMetrics.overtimeCount} max={20} tone="coral" />
                  </div>
                </div>
              </aside>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_320px]">
              <Card className="overflow-hidden rounded-[32px] border border-white/40 bg-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.03)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/40">
                <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <MiniBadge label={activeSession.label} />
                      <MiniBadge label={copy.sprintDay(activeSession.sprintDay)} />
                      <MiniBadge label={activeSession.type === 'L' ? 'LC 45m' : 'RC 75m'} />
                      <StatusBadge status={translateStatus(locale, activeSession.status)} sessionStatus={activeSession.status} />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                      {formatSessionTitle(locale, activeSession)}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                    {compactSignals.map((signal) => (
                      <InlineStat key={signal.label} label={signal.label} value={signal.value} helper={signal.helper} variant="compact" />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-[32px] border border-white/40 bg-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.03)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/40">
                <CardContent className="grid gap-3 p-6">
                  <QuickInfoRow label={copy.hotRootCause} value={formatHotspot(locale, sessions)} />
                  <QuickInfoRow
                    label={locale === 'zh' ? '时限状态' : 'Timing'}
                    value={timedOutFlag ? (locale === 'zh' ? '当前 session 已超时' : 'Current session timed out') : activeSession.type === 'L' ? 'LC 45m' : 'RC 75m'}
                    danger={timedOutFlag}
                  />
                  <div className="rounded-[20px] border border-zinc-200/50 bg-white/50 px-4 py-3 dark:border-white/10 dark:bg-zinc-900/50">
                    <div className="flex items-center justify-between gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                      <span>{locale === 'zh' ? '总进度' : 'Progress'}</span>
                      <span>{homeMetrics.completionPct}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200/60 dark:bg-zinc-800/60">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${homeMetrics.completionPct}%` }}
                        transition={{ duration: 1 }}
                        className="h-full rounded-full bg-[linear-gradient(90deg,#ffcc57_0%,#ff8f56_52%,#54d4ff_100%)]"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <motion.div 
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {children}
          </motion.div>

          {variant === 'compact' ? (
            <div className="grid gap-4 md:grid-cols-2 pt-4">
              {previousNavItem ? (
                <Link href={previousNavItem.href} className="group flex items-center justify-between gap-4 rounded-[28px] border border-white/40 bg-white/40 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] backdrop-blur-xl transition-all hover:bg-white/60 dark:border-white/10 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60">
                  <div className="flex items-center gap-4">
                    <span className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-colors group-hover:bg-zinc-950 group-hover:text-white dark:bg-white/10 dark:text-zinc-300 dark:group-hover:bg-white dark:group-hover:text-zinc-950">
                      <ArrowLeft className="size-4" />
                    </span>
                    <div>
                      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                        {locale === 'zh' ? '上一页' : 'Previous'}
                      </div>
                      <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{previousNavItem.label}</div>
                    </div>
                  </div>
                </Link>
              ) : <div />}

              {nextNavItem ? (
                <Link href={nextNavItem.href} className="group flex items-center justify-between gap-4 rounded-[28px] border border-white/40 bg-white/40 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] backdrop-blur-xl transition-all hover:bg-white/60 dark:border-white/10 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60">
                  <div className="flex flex-col items-end">
                    <div className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                      {locale === 'zh' ? '下一页' : 'Next'}
                    </div>
                    <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{nextNavItem.label}</div>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-full bg-zinc-950 text-white transition-colors group-hover:scale-105 dark:bg-white dark:text-zinc-950">
                    <ArrowRight className="size-4" />
                  </span>
                </Link>
              ) : <div />}
            </div>
          ) : null}
        </div>
      </main>
    </DashboardContext.Provider>
  );
}

export function SectionShell({
  index,
  title,
  description,
  children,
}: {
  index: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-6 mt-4">
      <div className="flex items-center gap-4 px-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 font-mono text-[11px] font-bold text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
          {index}
        </span>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

export function DeferredSection({ component: Component }: { component: ComponentType }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible || !hostRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(hostRef.current);

    return () => observer.disconnect();
  }, [isVisible]);

  return <div ref={hostRef}>{isVisible ? <Component /> : <DeferredPanelPlaceholder />}</div>;
}

export function DeferredPanelPlaceholder() {
  return (
    <div className="overflow-hidden rounded-[32px] border border-white/40 bg-white/30 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/30">
      <div className="h-16 border-b border-zinc-200/50 bg-white/40 px-6 py-5 dark:border-white/10 dark:bg-zinc-900/40" />
      <div className="grid gap-4 p-6">
        <div className="h-24 animate-pulse rounded-[24px] bg-zinc-200/50 dark:bg-zinc-800/50" />
        <div className="h-56 animate-pulse rounded-[28px] bg-zinc-200/40 dark:bg-zinc-800/40" />
      </div>
    </div>
  );
}

const ExamCountdownPanel = memo(function ExamCountdownPanel({ locale }: { locale: Locale }) {
  const examDate = useStore((state) => state.examDate);
  const setExamDate = useStore((state) => state.setExamDate);
  const copy = getCopy(locale);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const kickoff = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 60000);

    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, []);

  const countdown = useMemo(() => {
    if (!now) {
      return null;
    }

    const target = new Date(`${examDate}T09:00:00`);
    const diff = target.getTime() - now;
    const safeDiff = Math.max(diff, 0);

    return {
      isReady: diff <= 0,
      days: Math.floor(safeDiff / (24 * 60 * 60 * 1000)),
      hours: Math.floor(safeDiff / (60 * 60 * 1000)),
      formattedDate: new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        weekday: 'short',
      }).format(target),
    };
  }, [examDate, locale, now]);

  return (
    <Card className="overflow-hidden rounded-[32px] border border-white/40 bg-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.03)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/40 dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
      <CardHeader className="border-b border-zinc-200/50 px-6 py-5 dark:border-white/10">
        <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.32em] text-amber-600 dark:text-amber-400">
          {copy.examCountdownTitle}
        </CardTitle>
        <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {copy.examCountdownDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <div className="rounded-[24px] border border-zinc-200/50 bg-white/60 p-4 dark:border-white/10 dark:bg-zinc-900/60">
          <label className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400" htmlFor="toeic-exam-date">
            {copy.examCountdownLabel}
          </label>
          <div className="mt-3 flex items-center gap-3 rounded-full border border-zinc-200/60 bg-zinc-50/80 px-4 dark:border-zinc-800 dark:bg-zinc-900/80 transition-colors focus-within:border-amber-400/50 focus-within:ring-2 focus-within:ring-amber-400/20">
            <CalendarDays className="size-4 text-zinc-400 dark:text-zinc-500" />
            <Input
              id="toeic-exam-date"
              type="date"
              value={examDate}
              onChange={(event) => setExamDate(event.target.value)}
              className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 font-medium"
            />
          </div>
          <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 pl-1">
            {countdown?.formattedDate ?? examDate}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CountdownCard
            label={copy.examCountdownDays}
            value={countdown?.isReady ? '0' : `${countdown?.days ?? '--'}`}
            helper={countdown?.isReady ? copy.examCountdownReady : locale === 'zh' ? '按天安排训练' : 'Plan by day'}
            tone="amber"
          />
          <CountdownCard
            label={copy.examCountdownHours}
            value={countdown?.isReady ? '0' : `${countdown?.hours ?? '--'}`}
            helper={locale === 'zh' ? '折算为总训练时数' : 'Total training hours left'}
            tone="cyan"
          />
        </div>
      </CardContent>
    </Card>
  );
});

function MiniBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-zinc-200/50 bg-white/80 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-600 shadow-sm dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-300">
      {label}
    </span>
  );
}

function InlineStat({
  label,
  value,
  helper,
  variant = 'feature',
}: {
  label: string;
  value: string;
  helper: string;
  variant?: 'feature' | 'compact';
}) {
  return (
    <div
      className={cn(
        'rounded-[24px] border border-white/60 bg-white/50 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/50',
        variant === 'feature' ? 'p-6 xl:min-h-47' : 'p-5'
      )}
    >
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{label}</div>
      <div
        className={cn(
          'font-semibold tracking-tight text-zinc-900 dark:text-zinc-50',
          variant === 'feature' ? 'mt-4 text-[2rem] leading-none sm:text-[2.4rem]' : 'mt-2 text-xl leading-tight'
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          'text-zinc-500 dark:text-zinc-400',
          variant === 'feature' ? 'mt-4 max-w-88 text-sm leading-6' : 'mt-2 text-xs leading-5'
        )}
      >
        {helper}
      </div>
    </div>
  );
}

function ProgressLine({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: 'amber' | 'slate' | 'coral';
}) {
  const barClass =
    tone === 'amber'
      ? 'bg-gradient-to-r from-amber-400 to-orange-400'
      : tone === 'coral'
        ? 'bg-gradient-to-r from-red-400 to-rose-400'
        : 'bg-gradient-to-r from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-500';

  return (
    <div>
      <div className="flex items-center justify-between gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200/50 dark:bg-zinc-800/50">
        <motion.div 
          className={cn('h-full rounded-full', barClass)} 
          initial={{ width: 0 }}
          animate={{ width: `${Math.min((value / max) * 100, 100)}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function QuickInfoRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] border border-white/60 bg-white/50 px-4 py-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/50">
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={cn('text-sm font-medium', danger ? 'text-red-500 dark:text-red-400' : 'text-zinc-800 dark:text-zinc-200')}>
        {value}
      </div>
    </div>
  );
}

function CountdownCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: 'amber' | 'cyan';
}) {
  const cls =
    tone === 'amber'
      ? 'border-amber-200/50 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-900/10'
      : 'border-cyan-200/50 bg-cyan-50/50 dark:border-cyan-900/30 dark:bg-cyan-900/10';

  return (
    <div className={cn('rounded-[24px] border p-5 shadow-sm backdrop-blur-md', cls)}>
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-2 font-mono text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{value}</div>
      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{helper}</div>
    </div>
  );
}

function OverviewSignal({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'amber' | 'slate' | 'coral' | 'cyan';
}) {
  const cls =
    tone === 'amber'
      ? 'border-amber-200/40 bg-gradient-to-b from-amber-50/80 to-white/60 dark:border-amber-900/20 dark:from-amber-900/10 dark:to-zinc-900/60'
      : tone === 'coral'
        ? 'border-red-200/40 bg-gradient-to-b from-red-50/80 to-white/60 dark:border-red-900/20 dark:from-red-900/10 dark:to-zinc-900/60'
        : tone === 'cyan'
          ? 'border-cyan-200/40 bg-gradient-to-b from-cyan-50/80 to-white/60 dark:border-cyan-900/20 dark:from-cyan-900/10 dark:to-zinc-900/60'
          : 'border-zinc-200/50 bg-white/60 dark:border-white/10 dark:bg-zinc-900/60';

  return (
    <div className={cn('group rounded-[32px] border p-6 shadow-[0_8px_24px_rgba(0,0,0,0.03)] backdrop-blur-2xl transition-all hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.2)]', cls)}>
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.26em] text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-4 font-mono text-[2.2rem] font-semibold tracking-tight text-zinc-950 transition-transform group-hover:scale-[1.02] dark:text-zinc-50">{value}</div>
      <div className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{detail}</div>
    </div>
  );
}

function StatusBadge({ status, sessionStatus }: { status: string; sessionStatus: string }) {
  const cls =
    sessionStatus === 'debugged'
      ? 'border-emerald-200/60 bg-emerald-50 text-emerald-600 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-400'
      : sessionStatus === 'in-progress'
        ? 'border-amber-200/60 bg-amber-50 text-amber-600 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-400'
        : 'border-zinc-200/80 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400';

  return (
    <div className={cn('rounded-full border px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.24em] shadow-sm', cls)}>
      {status}
    </div>
  );
}

export function ProtocolRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-zinc-200/50 bg-white/60 px-5 py-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/60">
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">{title}</div>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{body}</p>
    </div>
  );
}
