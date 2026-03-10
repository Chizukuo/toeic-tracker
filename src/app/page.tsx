'use client';

import dynamic from 'next/dynamic';

import type { ComponentType, ReactNode } from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
} from 'lucide-react';

import { DebugForm } from '@/components/DebugForm';
import { LapTimer } from '@/components/LapTimer';
import { LocaleToggle } from '@/components/LocaleToggle';
import { SprintDashboard } from '@/components/SprintDashboard';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TimeWaterfallChart } from '@/components/TimeWaterfallChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatHotspot, formatSessionTitle, formatWorstPart, getCopy, translateStatus } from '@/lib/i18n';
import { getIncorrectAnswers } from '@/lib/toeic';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

const AnalyticsDashboard = dynamic(() => import('@/components/AnalyticsDashboard').then((module) => module.AnalyticsDashboard), {
  loading: () => <DeferredPanelPlaceholder />,
});

const DataVaultPanel = dynamic(() => import('@/components/DataVaultPanel').then((module) => module.DataVaultPanel), {
  loading: () => <DeferredPanelPlaceholder />,
});

const ScoreEstimatorPanel = dynamic(() => import('@/components/ScoreEstimatorPanel').then((module) => module.ScoreEstimatorPanel), {
  loading: () => <DeferredPanelPlaceholder />,
});

const UnfinishedTrackerPanel = dynamic(() => import('@/components/UnfinishedTrackerPanel').then((module) => module.UnfinishedTrackerPanel), {
  loading: () => <DeferredPanelPlaceholder />,
});

export default function Home() {
  const sessions = useStore((state) => state.sessions);
  const ensureInitialized = useStore((state) => state.ensureInitialized);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);

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

  const activeSession = homeMetrics.activeSession;

  if (!activeSession) {
    return null;
  }

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

  return (
    <main className="relative min-h-screen overflow-x-hidden px-4 py-4 text-zinc-950 dark:text-zinc-50 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(255,196,75,0.26),transparent_24%),radial-gradient(circle_at_88%_14%,rgba(62,203,255,0.14),transparent_20%),radial-gradient(circle_at_50%_100%,rgba(239,114,84,0.12),transparent_28%)]" />
      <div className="dashboard-grid pointer-events-none fixed inset-0 opacity-80" />
      <div className="noise-overlay pointer-events-none fixed inset-0" />

      <div className="relative mx-auto flex w-full max-w-395 flex-col gap-6 pb-14">
        <header className="reveal-fade pt-2 sm:pt-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/65 bg-white/58 px-4 py-3 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.32)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/84 dark:shadow-[0_24px_80px_-50px_rgba(0,0,0,0.75)]">
            <div className="flex items-center gap-4">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ffd36d_0%,#ff9a5c_100%)] shadow-[0_18px_34px_-16px_rgba(245,158,11,0.9)]">
                <span className="font-mono text-sm font-bold text-zinc-950">CT</span>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.34em] text-amber-700 dark:text-amber-300">
                  {copy.appName}
                </div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {locale === 'zh' ? '以考试日为终点设计训练节奏。' : 'Design the sprint backward from exam day.'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <LocaleToggle />
              <ThemeToggle />
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_320px]">
            <section className="grid gap-4">
              <Card className="glass-panel panel-sheen overflow-hidden rounded-[34px] border border-white/65 shadow-[0_30px_110px_-54px_rgba(15,23,42,0.42)] dark:border-white/10">
                <CardContent className="p-6 sm:p-8 lg:p-10">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                        {locale === 'zh' ? '当前任务' : 'Current Task'}
                      </div>
                      <h1
                        className={cn(
                          'mt-4 max-w-4xl font-semibold text-zinc-950 dark:text-zinc-50',
                          locale === 'zh'
                            ? 'text-[3rem] leading-[1.02] tracking-[-0.06em] sm:text-[4.2rem]'
                            : 'text-[2.8rem] leading-[1.02] tracking-[-0.05em] sm:text-[3.6rem]'
                        )}
                      >
                        {formatSessionTitle(locale, activeSession)}
                      </h1>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <MiniBadge label={activeSession.label} />
                        <MiniBadge label={copy.sprintDay(activeSession.sprintDay)} />
                        <MiniBadge label={activeSession.type === 'L' ? 'LC 45m' : 'RC 75m'} />
                      </div>
                    </div>

                    <StatusBadge status={translateStatus(locale, activeSession.status)} sessionStatus={activeSession.status} />
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {focusSignals.map((signal) => (
                      <InlineStat key={signal.label} label={signal.label} value={signal.value} helper={signal.helper} variant="compact" />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {overviewSignals.map((signal) => (
                  <OverviewSignal
                    key={signal.label}
                    label={signal.label}
                    value={signal.value}
                    detail={signal.detail}
                    tone={signal.tone}
                  />
                ))}
              </div>
            </section>

            <aside className="grid gap-4">
              <ExamCountdownPanel locale={locale} />

              <div className="mission-orbit rounded-[34px] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,247,230,0.9),rgba(255,255,255,0.62))] p-6 dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(255,196,75,0.08),rgba(16,18,24,0.94))] dark:shadow-[0_28px_90px_-56px_rgba(0,0,0,0.82)]">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                      {locale === 'zh' ? '总进度' : 'Progress'}
                    </div>
                    <div className="mt-3 font-mono text-5xl font-semibold tracking-[-0.06em] text-zinc-950 dark:text-zinc-50">
                      {homeMetrics.completionPct}
                      <span className="text-2xl text-zinc-400">%</span>
                    </div>
                  </div>

                  <div className="text-right text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                    {locale === 'zh' ? `${homeMetrics.debuggedCount}/20 已完成复盘` : `${homeMetrics.debuggedCount}/20 reviewed`}
                  </div>
                </div>

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/80">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#ffcc57_0%,#ff8f56_52%,#54d4ff_100%)] transition-all duration-700"
                    style={{ width: `${homeMetrics.completionPct}%` }}
                  />
                </div>

                <div className="mt-5 space-y-3">
                  <QuickInfoRow label={copy.worstPart} value={formatWorstPart(locale, sessions)} />
                  <QuickInfoRow label={copy.hotRootCause} value={formatHotspot(locale, sessions)} />
                  <QuickInfoRow
                    label={locale === 'zh' ? '时限状态' : 'Timing'}
                    value={timedOutFlag ? (locale === 'zh' ? '当前 session 已超时' : 'Current session timed out') : activeSession.type === 'L' ? 'LC 45m' : 'RC 75m'}
                    danger={timedOutFlag}
                  />
                </div>

                <div className="mt-5 space-y-3">
                  <ProgressLine label={copy.summaryDebugged} value={homeMetrics.debuggedCount} max={20} tone="amber" />
                  <ProgressLine label={copy.summaryInProgress} value={homeMetrics.liveCount} max={20} tone="slate" />
                  <ProgressLine label={copy.summaryTimeout} value={homeMetrics.overtimeCount} max={20} tone="coral" />
                </div>
              </div>
            </aside>
          </div>
        </header>

        <SectionShell
          index="01"
          title={copy.dashboardTitle}
          description={locale === 'zh' ? '选择 session，切换到对应工作区。' : 'Select a session to switch the workspace.'}
        >
          <SprintDashboard />
        </SectionShell>

        <SectionShell
          index="02"
          title={locale === 'zh' ? '计时与录入' : 'Timer & Review'}
          description={locale === 'zh' ? `${activeSession.label} · ${formatSessionTitle(locale, activeSession)}` : `${activeSession.label} · ${formatSessionTitle(locale, activeSession)}`}
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="glass-panel overflow-hidden rounded-[32px] border border-white/65 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.24)] dark:border-white/10">
              <CardHeader className="border-b border-zinc-200/70 bg-white/55 px-6 py-5 dark:border-white/8 dark:bg-zinc-950/80">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                      {locale === 'zh' ? '当前工作区' : 'Active Workspace'}
                    </div>
                    <CardTitle className="mt-2 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                      {activeSession.label}
                      <span className="mx-2 text-zinc-300 dark:text-zinc-600">/</span>
                      <span className="text-zinc-600 dark:text-zinc-400">{formatSessionTitle(locale, activeSession)}</span>
                    </CardTitle>
                  </div>
                  <StatusBadge status={translateStatus(locale, activeSession.status)} sessionStatus={activeSession.status} />
                </div>
              </CardHeader>
              <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                <LapTimer key={`timer-${activeSession.id}`} session={activeSession} />
                <DebugForm key={`debug-${activeSession.id}`} activeSession={activeSession} />
              </CardContent>
            </Card>

            <div className="grid gap-6">
              <TimeWaterfallChart session={activeSession} />
              <Card className="glass-panel overflow-hidden rounded-[32px] border border-white/65 dark:border-white/10">
                <CardHeader className="border-b border-zinc-200/70 px-6 py-5 dark:border-white/8">
                  <CardTitle className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-700 dark:text-amber-300">
                    {copy.sprintProtocol}
                  </CardTitle>
                  <CardDescription className="text-xs leading-6">{copy.sprintProtocolDesc}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 p-6">
                  <ProtocolRow title={copy.protocolListeningTitle} body={copy.protocolListeningBody} />
                  <ProtocolRow title={copy.protocolReadingTitle} body={copy.protocolReadingBody} />
                  <ProtocolRow title={copy.protocolTimeoutTitle} body={copy.protocolTimeoutBody} />
                  <ProtocolRow title={copy.protocolPersistTitle} body={copy.protocolPersistBody} />
                </CardContent>
              </Card>
            </div>
          </div>
        </SectionShell>

        <SectionShell
          index="03"
          title={copy.unfinishedTrackerTitle}
          description={locale === 'zh' ? '集中处理超时后遗留的题目。' : 'Handle leftover questions from timed runs.'}
        >
          <DeferredSection component={UnfinishedTrackerPanel} />
        </SectionShell>

        <SectionShell
          index="04"
          title={copy.analyticsTitle}
          description={locale === 'zh' ? '查看趋势、短板和高频错因。' : 'Review trend, weak spots, and root causes.'}
        >
          <DeferredSection component={AnalyticsDashboard} />
        </SectionShell>

        <SectionShell
          index="05"
          title={copy.scoreEstimatorTitle}
          description={locale === 'zh' ? '按套次查看听力、阅读和总分估算。' : 'View listening, reading, and total estimates.'}
        >
          <DeferredSection component={ScoreEstimatorPanel} />
        </SectionShell>

        <SectionShell
          index="06"
          title={copy.dataVaultTitle}
          description={locale === 'zh' ? '备份、恢复或重置本地数据。' : 'Backup, restore, or reset local data.'}
        >
          <DeferredSection component={DataVaultPanel} />
        </SectionShell>
      </div>
    </main>
  );
}

function SectionShell({
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
    <section className="grid gap-4">
      <div className="rounded-[28px] border border-white/65 bg-white/58 p-5 shadow-[0_20px_70px_-46px_rgba(15,23,42,0.3)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/84 dark:shadow-[0_24px_80px_-50px_rgba(0,0,0,0.75)]">
        <div className="flex flex-wrap items-start gap-4 sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#ffd971_0%,#ff8f56_100%)] font-mono text-[10px] font-bold tracking-[0.2em] text-zinc-950">
              {index}
            </span>

            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{title}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{description}</p>
            </div>
          </div>
        </div>
      </div>

      <div>{children}</div>
    </section>
  );
}

const ExamCountdownPanel = memo(function ExamCountdownPanel({ locale }: { locale: 'zh' | 'en' }) {
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
    <Card className="glass-panel rounded-[34px] border border-white/65 shadow-[0_28px_100px_-54px_rgba(15,23,42,0.35)] dark:border-white/10">
      <CardHeader className="border-b border-zinc-200/70 px-6 py-5 dark:border-white/8">
        <CardTitle className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-700 dark:text-amber-300">
          {copy.examCountdownTitle}
        </CardTitle>
        <CardDescription className="text-xs leading-6">
          {copy.examCountdownDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <div className="rounded-[24px] border border-zinc-200/80 bg-white/80 p-4 dark:border-white/8 dark:bg-zinc-950/84">
          <label className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400" htmlFor="toeic-exam-date">
            {copy.examCountdownLabel}
          </label>
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-zinc-200/70 bg-zinc-50/85 px-3 dark:border-zinc-800 dark:bg-zinc-900/70">
            <CalendarDays className="size-4 text-zinc-400 dark:text-zinc-500" />
            <Input
              id="toeic-exam-date"
              type="date"
              value={examDate}
              onChange={(event) => setExamDate(event.target.value)}
              className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="mt-3 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
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

function DeferredSection({ component: Component }: { component: ComponentType }) {
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

function DeferredPanelPlaceholder() {
  return (
    <div className="deck-card overflow-hidden rounded-[32px] border border-white/65 dark:border-white/10">
      <div className="h-14 border-b border-zinc-200/70 bg-white/55 px-6 py-5 dark:border-white/8 dark:bg-zinc-950/80" />
      <div className="grid gap-4 p-6">
        <div className="h-24 animate-pulse rounded-[24px] bg-zinc-200/60 dark:bg-zinc-800/60" />
        <div className="h-56 animate-pulse rounded-[28px] bg-zinc-200/50 dark:bg-zinc-800/50" />
      </div>
    </div>
  );
}

function MiniBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-zinc-200/80 bg-zinc-50/90 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:border-white/8 dark:bg-zinc-950/65 dark:text-zinc-300">
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
        'rounded-[22px] border border-zinc-200/80 bg-zinc-50/85 dark:border-white/8 dark:bg-zinc-950/65',
        variant === 'feature' ? 'p-5 xl:min-h-47' : 'p-4'
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{label}</div>
      <div
        className={cn(
          'font-semibold tracking-tight text-zinc-950 dark:text-zinc-50',
          variant === 'feature' ? 'mt-4 text-[2rem] leading-none sm:text-[2.4rem]' : 'mt-2 text-xl leading-tight'
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          'text-zinc-500 dark:text-zinc-400',
          variant === 'feature' ? 'mt-4 max-w-88 text-sm leading-7' : 'mt-2 text-xs leading-6'
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
      ? 'bg-[linear-gradient(90deg,#ffd15d_0%,#ff9656_100%)]'
      : tone === 'coral'
        ? 'bg-[linear-gradient(90deg,#ff9f7b_0%,#ef7154_100%)]'
        : 'bg-[linear-gradient(90deg,#d4d4d8_0%,#71717a_100%)]';

  return (
    <div>
      <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/80">
        <div className={cn('h-full rounded-full transition-all duration-700', barClass)} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
      </div>
    </div>
  );
}

function QuickInfoRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[20px] border border-zinc-200/80 bg-white/65 px-4 py-3 dark:border-white/8 dark:bg-zinc-950/82">
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{label}</div>
        <div className={cn('mt-1 text-sm font-medium leading-6', danger ? 'text-red-600 dark:text-red-300' : 'text-zinc-700 dark:text-zinc-200')}>
          {value}
        </div>
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
      ? 'border-amber-300/60 bg-[linear-gradient(180deg,rgba(255,214,102,0.18),rgba(255,255,255,0.88))] dark:bg-[linear-gradient(180deg,rgba(255,196,75,0.10),rgba(16,18,24,0.96))]'
      : 'border-cyan-300/60 bg-[linear-gradient(180deg,rgba(125,225,255,0.18),rgba(255,255,255,0.88))] dark:bg-[linear-gradient(180deg,rgba(84,212,255,0.09),rgba(16,18,24,0.96))]';

  return (
    <div className={cn('rounded-[24px] border p-4', cls)}>
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-2 font-mono text-4xl font-semibold tracking-[-0.05em] text-zinc-950 dark:text-zinc-50">{value}</div>
      <div className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">{helper}</div>
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
      ? 'border-amber-300/60 bg-[linear-gradient(180deg,rgba(255,214,102,0.18),rgba(255,255,255,0.74))] dark:bg-[linear-gradient(180deg,rgba(255,196,75,0.09),rgba(16,18,24,0.95))]'
      : tone === 'coral'
        ? 'border-orange-300/60 bg-[linear-gradient(180deg,rgba(255,160,122,0.16),rgba(255,255,255,0.74))] dark:bg-[linear-gradient(180deg,rgba(239,114,84,0.09),rgba(16,18,24,0.95))]'
        : tone === 'cyan'
          ? 'border-cyan-300/60 bg-[linear-gradient(180deg,rgba(125,225,255,0.16),rgba(255,255,255,0.74))] dark:bg-[linear-gradient(180deg,rgba(84,212,255,0.08),rgba(16,18,24,0.95))]'
          : 'border-zinc-300/70 bg-white/70 dark:border-white/8 dark:bg-zinc-950/82';

  return (
    <div className={cn('rounded-[28px] border p-5 shadow-[0_22px_70px_-48px_rgba(15,23,42,0.34)] backdrop-blur-xl', cls)}>
      <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-3 font-mono text-[2.2rem] font-semibold tracking-[-0.05em] text-zinc-950 dark:text-zinc-50">{value}</div>
      <div className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">{detail}</div>
    </div>
  );
}

function StatusBadge({ status, sessionStatus }: { status: string; sessionStatus: string }) {
  const cls =
    sessionStatus === 'debugged'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : sessionStatus === 'in-progress'
        ? 'border-amber-400/40 bg-amber-400/12 text-amber-700 dark:text-amber-300'
        : 'border-zinc-200/90 bg-white/75 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400';

  return (
    <div className={cn('rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] shadow-sm', cls)}>
      {status}
    </div>
  );
}

function ProtocolRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[22px] border border-zinc-200/80 bg-zinc-50/90 px-4 py-3 dark:border-white/8 dark:bg-zinc-950/65">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">{title}</div>
      <p className="mt-1.5 text-xs leading-6 text-zinc-500 dark:text-zinc-400">{body}</p>
    </div>
  );
}
