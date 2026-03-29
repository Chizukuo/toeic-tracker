'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDot } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { DebugForm } from '@/components/DebugForm';
import { DashboardShell, DeferredPanelPlaceholder, ProtocolRow, SectionShell, useDashboardContext } from '@/components/DashboardShell';
import { LapTimer } from '@/components/LapTimer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatSessionTitle, translateStatus } from '@/lib/i18n';
import { trackUXEvent } from '@/lib/uxEvent';

const TimeWaterfallChart = dynamic(
  () => import('@/components/TimeWaterfallChart').then((module) => module.TimeWaterfallChart),
  { loading: () => <DeferredPanelPlaceholder /> }
);

export default function TimerPageClient() {
  return (
    <DashboardShell variant="compact">
      <TimerPageContent />
    </DashboardShell>
  );
}

function TimerPageContent() {
  const { activeSession, locale, copy } = useDashboardContext();
  const router = useRouter();
  const [focusMode, setFocusMode] = useState(false);
  const [autoFocusToken, setAutoFocusToken] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    try {
      return window.localStorage.getItem('toeic-auto-advance') !== 'off';
    } catch {
      return true;
    }
  });
  const [flowToast, setFlowToast] = useState<{
    id: number;
    title: string;
    body: string;
    cta: string;
    href: '/unfinished' | '/analytics' | '/scores' | '/plan' | '/timer';
    autoNavigate: boolean;
    autoNavigateAt?: number;
  } | null>(null);

  const pushFlowToast = (payload: Omit<NonNullable<typeof flowToast>, 'id'>) => {
    setFlowToast({
      id: Date.now(),
      ...payload,
      autoNavigateAt: payload.autoNavigate ? Date.now() + 3200 : undefined,
    });
  };

  const dismissFlowToast = () => setFlowToast(null);

  useEffect(() => {
    if (!flowToast) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFlowToast(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flowToast]);

  const toggleAutoAdvance = () => {
    setAutoAdvanceEnabled((current) => {
      const next = !current;

      try {
        window.localStorage.setItem('toeic-auto-advance', next ? 'on' : 'off');
      } catch {
        // Ignore storage write errors because this is a preference enhancement.
      }

      return next;
    });
  };

  useEffect(() => {
    if (!flowToast?.autoNavigate) {
      return;
    }

    const remaining = Math.max((flowToast.autoNavigateAt ?? Date.now()) - Date.now(), 0);

    const timeoutId = window.setTimeout(() => {
      trackUXEvent('auto_advance_triggered', activeSession.id);
      router.push(flowToast.href);
      setFlowToast(null);
    }, remaining);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeSession.id, flowToast, router]);

  useEffect(() => {
    if (!flowToast?.autoNavigate) {
      return;
    }

    const tickId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 100);

    return () => window.clearInterval(tickId);
  }, [flowToast]);

  const autoAdvanceCountdownMs = flowToast?.autoNavigateAt
    ? Math.max(flowToast.autoNavigateAt - nowMs, 0)
    : 0;

  const workflowStage = useMemo(() => {
    const unresolvedBacklog =
      activeSession.type === 'R' &&
      (activeSession.timerSummary?.unfinishedQuestions ?? 0) > 0 &&
      !activeSession.timerSummary?.resolvedUnfinished;

    if (activeSession.timerRuntime?.isOvertime) {
      return {
        key: 'overtime',
        label: locale === 'zh' ? '补录中' : 'Overtime',
        helper: locale === 'zh' ? '严格分已锁定，当前补做只影响潜力分。' : 'Strict score is locked. Current overtime affects only potential score.',
      };
    }

    if (activeSession.timerRuntime?.startedAt && !activeSession.timerSummary) {
      return {
        key: 'timing',
        label: locale === 'zh' ? '计时中' : 'Timing',
        helper: locale === 'zh' ? '专注当前计时，结束后自动进入复盘录入。' : 'Stay focused on the timer. Review input comes right after.',
      };
    }

    if (unresolvedBacklog || (activeSession.timerSummary && activeSession.status !== 'debugged')) {
      return {
        key: 'review',
        label: locale === 'zh' ? '待复盘' : 'Review',
        helper: locale === 'zh' ? '请先录入错题与错因，再进行下一套。' : 'Log mistakes and root causes before moving to the next set.',
      };
    }

    if (activeSession.status === 'debugged') {
      return {
        key: 'done',
        label: locale === 'zh' ? '已完成' : 'Done',
        helper: locale === 'zh' ? '当前套题已闭环，可切换到下一套。' : 'This set is complete. You can move to the next one.',
      };
    }

    return {
      key: 'ready',
      label: locale === 'zh' ? '未开始' : 'Ready',
      helper: locale === 'zh' ? '建议先开始严格计时，再统一复盘。' : 'Start strict timing first, then review in one pass.',
    };
  }, [activeSession, locale]);

  const stageProgress = useMemo(() => {
    const stageOrder = ['ready', 'timing', 'review', 'done'] as const;
    const key = workflowStage.key === 'overtime' ? 'review' : (workflowStage.key as (typeof stageOrder)[number]);
    const index = Math.max(stageOrder.indexOf(key), 0);
    const percent = (index / (stageOrder.length - 1)) * 100;

    return { index, percent };
  }, [workflowStage.key]);

  return (
    <SectionShell
      index="01"
      title={locale === 'zh' ? '计时与录入' : 'Timer & Review'}
      description={`${activeSession.label} · ${formatSessionTitle(locale, activeSession)}`}
    >
      <div className="space-y-6">
        <Card className="cheese-card overflow-hidden">
          <CardContent className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_320px] md:items-center">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                {locale === 'zh' ? '当前阶段' : 'Workflow Stage'}
              </div>
              <div className="mt-2 flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {workflowStage.key === 'done' ? <CheckCircle2 className="size-5 text-emerald-500" /> : <CircleDot className="size-5 text-amber-500" />}
                <span>{workflowStage.label}</span>
              </div>
              <div className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{workflowStage.helper}</div>
              <div className="mt-3 w-full max-w-md">
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/80">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                    style={{ width: `${stageProgress.percent}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                  {locale === 'zh'
                    ? `流程进度 ${stageProgress.index + 1}/4`
                    : `Flow progress ${stageProgress.index + 1}/4`}
                </div>
              </div>
            </div>

            <div className="cheese-grouped p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  {locale === 'zh' ? '流程状态机' : 'Flow State'}
                </div>
                <button
                  type="button"
                  onClick={toggleAutoAdvance}
                  className={autoAdvanceEnabled
                    ? 'rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300'
                    : 'rounded-full border border-zinc-200/80 bg-white/80 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500 dark:border-white/10 dark:bg-zinc-950/78 dark:text-zinc-400'}
                >
                  {autoAdvanceEnabled ? (locale === 'zh' ? '自动推进开' : 'Auto On') : (locale === 'zh' ? '自动推进关' : 'Auto Off')}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] leading-5">
                <StagePill active={workflowStage.key === 'ready'} label={locale === 'zh' ? '未开始' : 'Ready'} />
                <StagePill active={workflowStage.key === 'timing'} label={locale === 'zh' ? '计时中' : 'Timing'} />
                <StagePill active={workflowStage.key === 'review' || workflowStage.key === 'overtime'} label={locale === 'zh' ? '待复盘' : 'Review'} />
                <StagePill active={workflowStage.key === 'done'} label={locale === 'zh' ? '已完成' : 'Done'} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="cheese-card overflow-hidden">
          <CardHeader className="cheese-card-header px-6 py-5">
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
              <div className="cheese-pill">
                {translateStatus(locale, activeSession.status)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <LapTimer
              key={`timer-${activeSession.id}`}
              session={activeSession}
              onFocusModeChange={setFocusMode}
              onStrictAttemptSaved={() => {
                setAutoFocusToken((value) => value + 1);
                pushFlowToast({
                  title: locale === 'zh' ? '严格计时已保存' : 'Strict attempt saved',
                  body: locale === 'zh' ? '已自动定位到复盘首项，建议立即录入错题与错因。' : 'The first review input is focused. Log mistakes and root causes now.',
                  cta: locale === 'zh' ? '继续复盘' : 'Continue Review',
                  href: '/timer',
                  autoNavigate: false,
                });
              }}
            />
            <DebugForm
              key={`debug-${activeSession.id}`}
              activeSession={activeSession}
              autoFocusToken={autoFocusToken}
              onReviewSaved={(nextStep) => {
                const isUnfinished = nextStep === 'unfinished';
                const willAutoAdvance = autoAdvanceEnabled;

                pushFlowToast({
                  title: locale === 'zh' ? '复盘已保存' : 'Review saved',
                  body: isUnfinished
                    ? locale === 'zh'
                      ? willAutoAdvance
                        ? '即将进入未完成追踪，确认是否还有积压。'
                        : '已保存。建议前往未完成追踪，确认是否还有积压。'
                      : willAutoAdvance
                        ? 'Moving to unfinished tracking shortly to verify remaining backlog.'
                        : 'Saved. Recommended next step: unfinished tracking.'
                    : locale === 'zh'
                      ? willAutoAdvance
                        ? '即将进入分析页，检查趋势和下一步重点。'
                        : '已保存。建议前往分析页，检查趋势和下一步重点。'
                      : willAutoAdvance
                        ? 'Moving to analytics shortly to inspect trends and next priorities.'
                        : 'Saved. Recommended next step: analytics.',
                  cta: isUnfinished ? (locale === 'zh' ? '前往未完成' : 'Open Unfinished') : (locale === 'zh' ? '前往分析' : 'Open Analytics'),
                  href: isUnfinished ? '/unfinished' : '/analytics',
                  autoNavigate: willAutoAdvance,
                });
              }}
              onReviewUndone={() => {
                dismissFlowToast();
                pushFlowToast({
                  title: locale === 'zh' ? '已撤销本次复盘' : 'Review reverted',
                  body: locale === 'zh' ? '自动推进已取消，你可以继续修改后再保存。' : 'Auto-advance is canceled. You can edit and save again.',
                  cta: locale === 'zh' ? '继续编辑' : 'Continue Editing',
                  href: '/timer',
                  autoNavigate: false,
                });
              }}
            />
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <TimeWaterfallChart session={activeSession} />
          <Card className="cheese-card overflow-hidden">
            <CardHeader className="cheese-card-header px-6 py-5">
              <CardTitle className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-700 dark:text-amber-300">
                {copy.sprintProtocol}
              </CardTitle>
              <CardDescription className="text-xs leading-6">{copy.sprintProtocolDesc}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-6">
              {focusMode ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/8 p-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">
                    {locale === 'zh' ? '专注模式' : 'Focus Mode'}
                  </div>
                  <div className="mt-1.5">
                    {locale === 'zh' ? '计时进行中，协议细节暂时收起。先完成当前动作，结束后自动恢复完整说明。' : 'Timer is running, protocol details are temporarily collapsed. Finish the active task first; full guidance returns after timing.'}
                  </div>
                </div>
              ) : (
                <>
                  <ProtocolRow title={copy.protocolListeningTitle} body={copy.protocolListeningBody} />
                  <ProtocolRow title={copy.protocolReadingTitle} body={copy.protocolReadingBody} />
                  <ProtocolRow title={copy.protocolTimeoutTitle} body={copy.protocolTimeoutBody} />
                  <ProtocolRow title={copy.protocolPersistTitle} body={copy.protocolPersistBody} />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      </div>

      {flowToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 w-[min(92vw,420px)] rounded-[16px] border border-[var(--separator)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-elevated)] backdrop-blur-xl"
        >
          <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{flowToast.title}</div>
          <div className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">{flowToast.body}</div>
          {flowToast.autoNavigate && (
            <div className="mt-2">
              <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/80">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-100 ease-linear"
                  style={{ width: `${Math.max(0, Math.min(100, (autoAdvanceCountdownMs / 3200) * 100))}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                {locale === 'zh' ? `将在 ${(autoAdvanceCountdownMs / 1000).toFixed(1)} 秒后自动跳转` : `Auto navigation in ${(autoAdvanceCountdownMs / 1000).toFixed(1)}s`}
              </div>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <Link
              href={flowToast.href}
              className="inline-flex items-center rounded-full bg-amber-500 px-4 py-2 text-[10px] uppercase font-bold tracking-[0.12em] text-white transition-all hover:bg-amber-600 active:scale-[0.97] dark:text-zinc-900"
            >
              {flowToast.cta}
            </Link>
            <button
              type="button"
              onClick={dismissFlowToast}
              className="inline-flex items-center rounded-full border border-[var(--separator)] bg-[var(--surface-grouped)] px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--label-secondary)] transition-all hover:text-[var(--label-primary)] active:scale-[0.97]"
            >
              {flowToast.autoNavigate ? (locale === 'zh' ? '取消跳转' : 'Cancel') : (locale === 'zh' ? '关闭' : 'Dismiss')}
            </button>
          </div>
        </div>
      )}
    </SectionShell>
  );
}

function StagePill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={active
        ? 'cheese-pill border-amber-400/35 bg-amber-400/12 text-amber-700 dark:text-amber-300'
        : 'cheese-pill'}
    >
      {label}
    </span>
  );
}