'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { ComponentType, ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart2, BookOpen, Clock, Database, Home, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { LocaleToggle } from '@/components/LocaleToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AchievementToast } from '@/components/AchievementToast';
import { BrandIconSvg } from '@/lib/brandIcon';
import { formatHotspot, formatWorstPart, getCopy, translateStatus, type Locale } from '@/lib/i18n';
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
    totalSessions: number;
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
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      <main
        data-layout-variant={variant}
        className="relative min-h-screen overflow-x-hidden px-4 pb-14 pt-24 text-(--label-primary) sm:px-6 lg:px-8"
      >

        <header className="fixed top-4 left-1/2 z-50 flex w-[calc(100%-1rem)] max-w-5xl -translate-x-1/2 items-center justify-between gap-1.5 rounded-[20px] border border-(--glass-border) bg-(--glass-bg) px-2 py-2 shadow-(--shadow-elevated) backdrop-blur-2xl transition-all duration-300 sm:w-[calc(100%-2rem)] lg:gap-3" style={{ boxShadow: 'var(--shadow-elevated), var(--glass-highlight)' }}>
           <Link href="/" aria-label={copy.appName} className="relative z-10 ml-2 flex shrink-0 items-center justify-center transition-transform hover:scale-105 active:scale-95">
             <BrandIconSvg className="size-7 opacity-90" />
          </Link>

          
          
          <nav className="no-scrollbar hidden min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto px-1 md:flex md:justify-center md:px-2 lg:gap-1.5">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
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
                      className="absolute inset-0 rounded-full bg-(--surface-grouped) shadow-(--shadow-soft)"
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
                className="ml-1 inline-flex size-10 items-center justify-center rounded-full border border-(--separator) bg-(--surface-elevated) text-(--label-primary) shadow-(--shadow-soft) transition-colors"
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
                className="fixed top-[5.3rem] left-1/2 z-50 w-[calc(100%-1rem)] max-w-350 -translate-x-1/2 rounded-[20px] border border-(--separator) bg-(--surface-elevated) p-2.5 shadow-(--shadow-elevated) backdrop-blur-xl md:hidden"
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
    <section data-section-index={index} className="grid gap-6 mt-4">
      <div className="px-2">
        <h2 className="text-[20px] font-semibold tracking-tight text-(--label-primary)">{title}</h2>
        <p className="mt-1 text-[14px] text-(--label-secondary)">{description}</p>
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
    <div className="overflow-hidden rounded-[20px] border border-(--separator) bg-(--surface-elevated)">
      <div className="h-16 border-b border-(--separator) px-6 py-5" />
      <div className="grid gap-4 p-6">
        <div className="h-24 animate-pulse rounded-[16px] bg-(--surface-grouped)" />
        <div className="h-56 animate-pulse rounded-[16px] bg-(--surface-grouped)" />
      </div>
    </div>
  );
}

export function ProtocolRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[16px] border border-(--separator) bg-(--surface-grouped) px-5 py-4">
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">{title}</div>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{body}</p>
    </div>
  );
}
