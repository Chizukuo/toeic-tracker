'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { ComponentType, ReactNode } from 'react';
import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart2, BookOpen, CalendarDays, CheckCircle, Clock, Database, Home, Menu, Target, Trophy, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { LocaleToggle } from '@/components/LocaleToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AchievementToast } from '@/components/AchievementToast';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

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
      totalSessions: sessions.length,
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
        href: '/practice',
        cta: locale === 'zh' ? '继续补录' : 'Resume Overtime',
      }
    : isTimingActive
      ? {
          stage: locale === 'zh' ? '计时中' : 'Timing',
          title: locale === 'zh' ? '当前计时进行中，优先完成本套操作' : 'The active timer is running, finish this set first',
          helper: locale === 'zh' ? '结束后会自动进入复盘录入。' : 'You will move directly into review input after the run.',
          href: '/practice',
          cta: locale === 'zh' ? '返回计时页' : 'Back To Timer',
        }
      : unresolvedBacklog || (activeSession.timerSummary && activeSession.status !== 'debugged')
        ? {
            stage: locale === 'zh' ? '待复盘' : 'Review',
            title: locale === 'zh' ? '本套已完成计时，下一步是录入错题并完成复盘' : 'Timing is done. Log mistakes and complete review next',
            helper: locale === 'zh' ? '未录入前，趋势和估分可信度会下降。' : 'Trends and estimates remain less reliable until review is saved.',
            href: '/practice',
            cta: locale === 'zh' ? '去录入复盘' : 'Open Review',
          }
        : activeSession.status === 'debugged' && nextSession
          ? {
              stage: locale === 'zh' ? '下一套' : 'Next Set',
              title: locale === 'zh' ? `当前已完成，建议切换到 ${nextSession.label}` : `Current set is done. Move to ${nextSession.label}`,
              helper: locale === 'zh' ? '保持连续节奏，比频繁切页更重要。' : 'Maintaining momentum matters more than bouncing across pages.',
              href: '/practice',
              cta: locale === 'zh' ? `切换到 ${nextSession.label}` : `Switch To ${nextSession.label}`,
              targetSessionId: nextSession.id,
            }
          : {
              stage: locale === 'zh' ? '准备开始' : 'Ready',
              title: locale === 'zh' ? '当前套题可直接开始严格计时' : 'The current set is ready for strict timing',
              helper: locale === 'zh' ? '先开始，再在结束后统一处理复盘。' : 'Start first, then complete review in one pass after finishing.',
              href: '/practice',
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
      value: `${homeMetrics.debuggedCount}/${homeMetrics.totalSessions}`,
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
    { href: '/', label: locale === 'zh' ? '任务台' : 'Mission', icon: Home },
    { href: '/practice', label: locale === 'zh' ? '训练场' : 'Practice', icon: Clock },
    { href: '/insights', label: locale === 'zh' ? '参考台' : 'Insights', icon: BarChart2 },
    { href: '/vocab', label: locale === 'zh' ? '生词本' : 'Vocab', icon: BookOpen },
    { href: '/vault', label: locale === 'zh' ? '数据' : 'Data', icon: Database },
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
      helper: locale === 'zh'
        ? `${homeMetrics.debuggedCount}/${homeMetrics.totalSessions} 已复盘`
        : `${homeMetrics.debuggedCount}/${homeMetrics.totalSessions} reviewed`,
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
      <AchievementToast />
      <main className="relative min-h-screen overflow-x-hidden pt-24 px-4 pb-14 text-[var(--label-primary)] sm:px-6 lg:px-8">

        <header className="fixed top-4 left-1/2 z-50 flex w-[calc(100%-1rem)] max-w-5xl -translate-x-1/2 items-center justify-between gap-1.5 rounded-[20px] border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2 py-2 shadow-[var(--shadow-elevated)] backdrop-blur-2xl transition-all duration-300 sm:w-[calc(100%-2rem)] lg:gap-3" style={{ boxShadow: 'var(--shadow-elevated), var(--glass-highlight)' }}>
           <Link href="/" aria-label={copy.appName} className="relative z-10 ml-2 flex shrink-0 items-center justify-center transition-transform hover:scale-105 active:scale-95">
             <BrandIconSvg className="size-7 opacity-90" />
          </Link>

          
          
          <nav className="no-scrollbar hidden min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto px-1 md:flex md:justify-center md:px-2 lg:gap-1.5">
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
                      className="absolute inset-0 rounded-full bg-[var(--surface-grouped)] shadow-[var(--shadow-soft)]"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <span className="relative z-10 hidden md:inline-block">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          
          <div className="relative z-10 mr-1 flex shrink-0 items-center gap-1 sm:gap-1.5">
            <div className="hidden md:flex items-center gap-2">
              <LocaleToggle />
              <ThemeToggle />
            </div>
            <div className="md:hidden">
              <button
                type="button"
                aria-label={locale === 'zh' ? '切换导航菜单' : 'Toggle navigation menu'}
                aria-expanded={isMobileMenuOpen}
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="ml-1 inline-flex size-10 items-center justify-center rounded-full border border-[var(--separator)] bg-[var(--surface-elevated)] text-[var(--label-primary)] shadow-[var(--shadow-soft)] transition-colors"
              >
                <motion.span
                  key={isMobileMenuOpen ? 'close' : 'menu'}
                  initial={{ opacity: 0, scale: 0.8, rotate: -25 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8, rotate: 25 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                </motion.span>
              </button>
            </div>
          </div>
        </header>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.button
                type="button"
                aria-label={locale === 'zh' ? '关闭导航菜单' : 'Close navigation menu'}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 z-40 bg-zinc-950/18 backdrop-blur-[2px] md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />

              <motion.nav
                className="fixed top-[5.3rem] left-1/2 z-50 w-[calc(100%-1rem)] max-w-350 -translate-x-1/2 rounded-[20px] border border-[var(--separator)] bg-[var(--surface-elevated)] p-2.5 shadow-[var(--shadow-elevated)] backdrop-blur-xl md:hidden"
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.85 }}
              >
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2 px-1 pb-1">
                    <div className="flex items-center gap-2">
                      <LocaleToggle />
                      <ThemeToggle />
                    </div>
                  </div>
                  {navigationItems.map((item, index) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <motion.div
                        key={item.href}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 + 0.05, duration: 0.22, ease: 'easeOut' }}
                      >
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            'group relative flex items-center justify-between rounded-2xl border px-3.5 py-3 text-sm transition-colors',
                            isActive
                              ? 'border-amber-200/80 bg-amber-50 text-zinc-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-zinc-100'
                              : 'border-transparent bg-white/55 text-zinc-600 hover:bg-white dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:bg-zinc-900/70'
                          )}
                        >
                          <span className="flex items-center gap-3">
                            <span className={cn(
                              'flex size-8 items-center justify-center rounded-full border',
                              isActive
                                ? 'border-amber-200 bg-white text-amber-600 dark:border-amber-300/20 dark:bg-zinc-900 dark:text-amber-300'
                                : 'border-zinc-200 bg-white/80 text-zinc-500 dark:border-white/10 dark:bg-zinc-900/75 dark:text-zinc-400'
                            )}>
                              <Icon className="size-4" />
                            </span>
                            <span className="font-medium">{item.label}</span>
                          </span>
                          <span className={cn(
                            'text-xs transition-opacity',
                            isActive ? 'opacity-100 text-amber-600 dark:text-amber-300' : 'opacity-0 group-hover:opacity-60 dark:group-hover:opacity-70'
                          )}>
                            {locale === 'zh' ? '进入' : 'Open'}
                          </span>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.nav>
            </>
          )}
        </AnimatePresence>

        <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6">
          <AnimatePresence mode="wait">
            <motion.div 
              key={pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
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
      <div className="px-2">
        <h2 className="text-[20px] font-semibold tracking-tight text-[var(--label-primary)]">{title}</h2>
        <p className="mt-1 text-[14px] text-[var(--label-secondary)]">{description}</p>
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
    <div className="overflow-hidden rounded-[20px] border border-[var(--separator)] bg-[var(--surface-elevated)]">
      <div className="h-16 border-b border-[var(--separator)] px-6 py-5" />
      <div className="grid gap-4 p-6">
        <div className="h-24 animate-pulse rounded-[16px] bg-[var(--surface-grouped)]" />
        <div className="h-56 animate-pulse rounded-[16px] bg-[var(--surface-grouped)]" />
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
    <Card className="overflow-hidden rounded-[20px] border border-[var(--separator)] bg-[var(--surface-elevated)] shadow-[var(--shadow-soft)]">
      <CardHeader className="border-b border-[var(--separator)] px-6 py-5">
        <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.32em] text-amber-600 dark:text-amber-400">
          {copy.examCountdownTitle}
        </CardTitle>
        <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {copy.examCountdownDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <div className="rounded-[16px] border border-[var(--separator)] bg-[var(--surface-grouped)] p-4">
          <label className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400" htmlFor="toeic-exam-date">
            {copy.examCountdownLabel}
          </label>
          <div className="mt-3 flex items-center gap-3 rounded-full border border-[var(--separator)] bg-[var(--surface-grouped)] px-4 transition-colors focus-within:border-amber-400/50 focus-within:ring-2 focus-within:ring-amber-400/20">
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
    <span className="cheese-pill">
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
        'cheese-stat',
        variant === 'feature' ? 'p-6 xl:min-h-47' : 'p-4'
      )}
    >
      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{label}</div>
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
      ? 'bg-amber-500'
      : tone === 'coral'
        ? 'bg-rose-500'
        : 'bg-zinc-400 dark:bg-zinc-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-zinc-400">
        <span>{label}</span>
        <span className="text-zinc-900 dark:text-zinc-100">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.04] dark:bg-white/[0.04]">
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
    <div className="flex items-center justify-between gap-4 rounded-full border border-[var(--separator)] bg-[var(--surface-elevated)] px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</div>
      <div className={cn('text-[13px] font-bold', danger ? 'text-rose-500' : 'text-zinc-900 dark:text-zinc-100')}>
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
      ? 'border-amber-500/10 bg-amber-500/5'
      : 'border-cyan-500/10 bg-cyan-500/5';

  return (
    <div className={cn('rounded-[16px] border p-6 transition-transform hover:scale-[1.02] active:scale-[0.97]', cls)}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</div>
      <div className="mt-3 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{value}</div>
      <div className="mt-2 text-[12px] text-zinc-500 leading-snug">{helper}</div>
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
  const accentCls =
    tone === 'amber' ? 'text-amber-500' :
    tone === 'coral' ? 'text-rose-500' :
    tone === 'cyan' ? 'text-cyan-500' :
    'text-zinc-600 dark:text-zinc-400';

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="group rounded-[20px] border border-[var(--separator)] bg-[var(--surface-elevated)] p-7 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-medium)]"
    >
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</div>
      <div className={cn('mt-4 text-[2.5rem] font-bold tracking-tight leading-none', accentCls)}>
        {value}
      </div>
      <div className="mt-3 text-[13px] leading-relaxed text-zinc-500">{detail}</div>
    </motion.div>
  );
}

function StatusBadge({ status, sessionStatus }: { status: string; sessionStatus: string }) {
  const cls =
    sessionStatus === 'debugged'
      ? 'border-emerald-500/10 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
      : sessionStatus === 'in-progress'
        ? 'border-amber-500/10 bg-amber-500/5 text-amber-600 dark:text-amber-400'
        : 'border-zinc-500/10 bg-zinc-500/5 text-zinc-500';

  return (
    <div className={cn('rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm', cls)}>
      {status}
    </div>
  );
}

export function ProtocolRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[16px] border border-[var(--separator)] bg-[var(--surface-grouped)] px-5 py-4">
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">{title}</div>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{body}</p>
    </div>
  );
}
