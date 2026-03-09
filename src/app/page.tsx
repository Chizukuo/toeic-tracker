'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Flame, Radar, Target } from 'lucide-react';

import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { DataVaultPanel } from '@/components/DataVaultPanel';
import { DebugForm } from '@/components/DebugForm';
import { LapTimer } from '@/components/LapTimer';
import { LocaleToggle } from '@/components/LocaleToggle';
import { ScoreEstimatorPanel } from '@/components/ScoreEstimatorPanel';
import { SprintDashboard } from '@/components/SprintDashboard';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TimeWaterfallChart } from '@/components/TimeWaterfallChart';
import { UnfinishedTrackerPanel } from '@/components/UnfinishedTrackerPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatHotspot, formatSessionTitle, formatWorstPart, getCopy, translateStatus } from '@/lib/i18n';
import { sumMistakes } from '@/lib/toeic';
import { useStore } from '@/store/useStore';

export default function Home() {
  const { sessions, ensureInitialized, activeSessionId, locale } = useStore();
  const copy = getCopy(locale);

  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized]);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions]
  );

  const { debuggedCount, liveCount, overtimeCount, totalMistakeLoad, unfinishedTotal } = useMemo(() => {
    let debuggedCount = 0;
    let liveCount = 0;
    let overtimeCount = 0;
    let totalMistakeLoad = 0;
    let unfinishedTotal = 0;
    for (const session of sessions) {
      if (session.status === 'debugged') debuggedCount++;
      else if (session.status === 'in-progress') liveCount++;
      if (session.timerSummary?.timedOut) overtimeCount++;
      totalMistakeLoad += sumMistakes(session);
      unfinishedTotal += session.timerSummary?.unfinishedQuestions ?? 0;
    }
    return { debuggedCount, liveCount, overtimeCount, totalMistakeLoad, unfinishedTotal };
  }, [sessions]);
  const completionPct = sessions.length > 0 ? Math.round((debuggedCount / sessions.length) * 100) : 0;

  if (!activeSession) {
    return null;
  }

  const timedOutFlag = Boolean(activeSession.timerSummary?.timedOut);

  return (
    <main className="dashboard-grid relative min-h-screen overflow-x-hidden px-4 py-0 text-zinc-950 dark:text-zinc-50 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_28%),linear-gradient(180deg,transparent,rgba(9,9,11,0.08))] dark:bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,transparent,rgba(0,0,0,0.34))]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-300/80 to-transparent" />

      <div className="relative mx-auto flex w-full max-w-370 flex-col gap-8 pb-16">
        <header className="reveal-fade pt-6 sm:pt-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-400 shadow-[0_0_24px_2px_rgba(251,191,36,0.35)] ring-1 ring-amber-200/60 dark:ring-amber-300/10">
                <span className="font-mono text-[13px] font-bold text-zinc-950">C</span>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.34em] text-amber-700 dark:text-amber-400">
                  {copy.appName}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                  {locale === 'zh' ? 'Cheese Yellow Control Surface' : 'Cheese Yellow Control Surface'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LocaleToggle />
              <ThemeToggle />
            </div>
          </div>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
            <Card className="glass-panel panel-sheen overflow-hidden rounded-[28px] border border-zinc-200/70 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.18)] dark:border-zinc-800/80 dark:shadow-[0_24px_90px_-38px_rgba(0,0,0,0.6)]">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <HeroChip label={locale === 'zh' ? '20 天冲刺' : '20-Day Sprint'} />
                  <HeroChip label={locale === 'zh' ? '听读交替' : 'Alternating LC/RC'} subtle />
                  <HeroChip label={locale === 'zh' ? '本地持久化' : 'Persisted Locally'} subtle />
                </div>

                <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-end">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">
                      {locale === 'zh' ? '弱点暴露优先' : 'Weakness Exposure First'}
                    </div>
                    <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.05em] text-zinc-950 dark:text-zinc-50 sm:text-5xl lg:text-[4.4rem]">
                      {locale === 'zh' ? (
                        <>
                          用一块更冷静的面板，
                          <span className="text-gradient-cheese">逼出</span>
                          你 TOEIC 冲刺期所有
                          <span className="text-gradient-cheese">时间漏洞</span>和错误模式。
                        </>
                      ) : (
                        <>
                          A quieter surface that forces your TOEIC sprint to reveal every
                          <span className="text-gradient-cheese"> pacing leak</span> and
                          <span className="text-gradient-cheese"> mistake pattern</span>.
                        </>
                      )}
                    </h1>
                    <p className="mt-5 max-w-3xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 sm:text-[15px]">
                      {copy.heroBody}
                    </p>

                    <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <MetricTile
                        label={copy.currentSession}
                        value={activeSession.label}
                        hint={copy.sprintDay(activeSession.sprintDay)}
                        icon={<Target className="size-3.5" />}
                        accent
                      />
                      <MetricTile
                        label={copy.status}
                        value={translateStatus(locale, activeSession.status)}
                        hint={activeSession.type === 'L' ? copy.pressureTape : copy.lapRace}
                        icon={<Clock3 className="size-3.5" />}
                      />
                      <MetricTile
                        label={copy.hotRootCause}
                        value={formatHotspot(locale, sessions)}
                        hint={copy.mostRepeatedTag}
                        icon={<Flame className="size-3.5" />}
                      />
                      <MetricTile
                        label={copy.worstPart}
                        value={formatWorstPart(locale, sessions)}
                        hint={copy.averageErrorRateBottleneck}
                        icon={<AlertTriangle className="size-3.5" />}
                      />
                    </div>

                    <div className="mt-4 rounded-[22px] border border-zinc-200/80 bg-white/72 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/55">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                            {copy.unfinishedTrackerTitle}
                          </div>
                          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                            {copy.unfinishedTrackerDescription}
                          </div>
                        </div>
                        <div className="rounded-full border border-red-500/20 bg-red-500/8 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-red-600 dark:text-red-300">
                          {copy.unfinished(unfinishedTotal)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-zinc-200/80 bg-white/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-700 dark:text-amber-400">
                          LIVE SESSION
                        </div>
                        <div className="mt-1 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                          {formatSessionTitle(locale, activeSession)}
                        </div>
                      </div>
                      <StatusBadge status={translateStatus(locale, activeSession.status)} sessionStatus={activeSession.status} />
                    </div>

                    <div className="mt-5 grid gap-3">
                      <MissionRow
                        label={locale === 'zh' ? '目标时长' : 'Target window'}
                        value={`${activeSession.targetMinutes}m`}
                        helper={activeSession.type === 'L' ? copy.protocolListeningBody : copy.protocolReadingBody}
                      />
                      <MissionRow
                        label={locale === 'zh' ? '完成进度' : 'Completion'}
                        value={`${completionPct}%`}
                        helper={locale === 'zh' ? `${debuggedCount}/20 套已形成 debug 闭环` : `${debuggedCount}/20 sets have reached debug closure`}
                      />
                      <MissionRow
                        label={locale === 'zh' ? '压力状态' : 'Pressure state'}
                        value={timedOutFlag ? (locale === 'zh' ? '已超时冻结' : 'Frozen on timeout') : activeSession.type === 'L' ? '45m LC' : '75m RC'}
                        helper={timedOutFlag ? copy.protocolTimeoutBody : locale === 'zh' ? '当前模式会直接决定计时器约束。' : 'The active mode directly changes timer constraints.'}
                        warning={timedOutFlag}
                      />
                    </div>

                    <div className="mt-5 rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                          SPRINT LOADOUT
                        </div>
                        <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{completionPct}%</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#facc15_0%,#f59e0b_45%,#fb923c_100%)] transition-all duration-700"
                          style={{ width: `${completionPct}%` }}
                        />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <SummaryCard label={copy.summaryDebugged} value={`${debuggedCount}/20`} tone="amber" helper={copy.summaryDebuggedHelper} compact />
                        <SummaryCard label={copy.summaryInProgress} value={`${liveCount}`} tone="zinc" helper={copy.summaryInProgressHelper} compact />
                        <SummaryCard label={copy.summaryTimeout} value={`${overtimeCount}`} tone="red" helper={copy.summaryTimeoutHelper} compact />
                        <SummaryCard label={copy.summaryMistakes} value={`${totalMistakeLoad}`} tone="amber" helper={copy.summaryMistakesHelper} compact />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel panel-sheen overflow-hidden rounded-[28px] border border-zinc-200/70 shadow-[0_20px_60px_-32px_rgba(0,0,0,0.2)] dark:border-zinc-800/80 dark:shadow-[0_20px_70px_-36px_rgba(0,0,0,0.6)]">
              <CardHeader className="border-b border-zinc-200/70 bg-zinc-50/75 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950/65">
                <CardTitle className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-700 dark:text-amber-400">
                  Sprint Doctrine
                </CardTitle>
                <CardDescription className="text-xs leading-6">
                  {locale === 'zh'
                    ? '这块面板不是鼓励感，而是持续暴露瓶颈的工作台。'
                    : 'This surface is built for bottlenecks, not motivation.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-6">
                <DoctrineItem
                  icon={<Clock3 className="size-4" />}
                  title={copy.protocolListeningTitle}
                  body={copy.protocolListeningBody}
                />
                <DoctrineItem
                  icon={<Radar className="size-4" />}
                  title={copy.protocolReadingTitle}
                  body={copy.protocolReadingBody}
                />
                <DoctrineItem
                  icon={<AlertTriangle className="size-4" />}
                  title={copy.protocolTimeoutTitle}
                  body={copy.protocolTimeoutBody}
                  danger
                />
                <DoctrineItem
                  icon={<CheckCircle2 className="size-4" />}
                  title={copy.protocolPersistTitle}
                  body={copy.protocolPersistBody}
                />
              </CardContent>
            </Card>
          </section>
        </header>

        <SectionLabel index="01" label={copy.dashboardTitle ?? 'SPRINT GRID'} />
        <SprintDashboard />

        <SectionLabel index="02" label={`${activeSession.label} · ${formatSessionTitle(locale, activeSession)}`} />
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="glass-panel overflow-hidden rounded-[28px] border border-zinc-200/70 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.18)] dark:border-zinc-800 dark:shadow-[0_20px_70px_-38px_rgba(0,0,0,0.65)]">
            <CardHeader className="border-b border-zinc-100 bg-zinc-50/85 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                      Active Workbench
                  </div>
                  <CardTitle className="mt-1 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-xl">
                    {activeSession.label}
                    <span className="mx-2 text-zinc-300 dark:text-zinc-600">/</span>
                    <span className="text-zinc-600 dark:text-zinc-400">{formatSessionTitle(locale, activeSession)}</span>
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs leading-6">
                    {copy.activeSessionDescription(activeSession.sprintDay, activeSession.type)}
                  </CardDescription>
                </div>
                <StatusBadge status={translateStatus(locale, activeSession.status)} sessionStatus={activeSession.status} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_420px]">
              <LapTimer key={`timer-${activeSession.id}`} session={activeSession} />
              <DebugForm key={`debug-${activeSession.id}`} activeSession={activeSession} />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <TimeWaterfallChart session={activeSession} />
            <Card className="glass-panel overflow-hidden rounded-[28px] border border-zinc-200/70 shadow-sm dark:border-zinc-800">
              <CardHeader className="border-b border-zinc-100 bg-zinc-50/75 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950/60">
                <CardTitle className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-600 dark:text-amber-400">
                  {copy.sprintProtocol}
                </CardTitle>
                <CardDescription className="text-xs leading-6">{copy.sprintProtocolDesc}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 p-6 text-sm text-zinc-600 dark:text-zinc-300">
                <ProtocolRow title={copy.protocolListeningTitle} body={copy.protocolListeningBody} />
                <ProtocolRow title={copy.protocolReadingTitle} body={copy.protocolReadingBody} />
                <ProtocolRow title={copy.protocolTimeoutTitle} body={copy.protocolTimeoutBody} />
                <ProtocolRow title={copy.protocolPersistTitle} body={copy.protocolPersistBody} />
              </CardContent>
            </Card>
          </div>
        </section>

        <SectionLabel index="03" label={copy.unfinishedTrackerTitle} />
        <UnfinishedTrackerPanel />

        <SectionLabel index="04" label={copy.analyticsTitle} />
        <AnalyticsDashboard />

        <SectionLabel index="05" label={copy.scoreEstimatorTitle} />
        <ScoreEstimatorPanel />

        <SectionLabel index="06" label={copy.dataVaultTitle} />
        <DataVaultPanel />
      </div>
    </main>
  );
}

/* ── SectionLabel ─────────────────────────────────────────── */
function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-[7px] border border-amber-400/40 bg-amber-400/8 font-mono text-[9px] font-bold tabular-nums text-amber-700 dark:bg-amber-400/10 dark:text-amber-400">
        {index}
      </span>
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <div className="h-px flex-1 bg-linear-to-r from-zinc-300 to-transparent dark:from-zinc-700" />
    </div>
  );
}

/* ── StatusBadge ──────────────────────────────────────────── */
function StatusBadge({ status, sessionStatus }: { status: string; sessionStatus: string }) {
  const cls =
    sessionStatus === 'debugged'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : sessionStatus === 'in-progress'
        ? 'border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300'
        : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400';
  return (
    <div className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] shadow-sm ${cls}`}>
      {status}
    </div>
  );
}

function HeroChip({ label, subtle }: { label: string; subtle?: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] ${
        subtle
          ? 'border-zinc-200/80 bg-white/70 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400'
          : 'border-amber-400/35 bg-amber-400/10 text-amber-700 dark:text-amber-300'
      }`}
    >
      {label}
    </span>
  );
}

function MissionRow({
  label,
  value,
  helper,
  warning,
}: {
  label: string;
  value: string;
  helper: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{label}</div>
          <div className={`mt-2 text-xl font-semibold tracking-tight ${warning ? 'text-red-600 dark:text-red-400' : 'text-zinc-950 dark:text-zinc-50'}`}>{value}</div>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{helper}</p>
    </div>
  );
}

type MetricTileProps = {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  accent?: boolean;
};

function MetricTile({ label, value, hint, icon, accent }: MetricTileProps) {
  return (
    <div className={`col-span-1 rounded-[22px] border p-4 backdrop-blur transition-colors ${
      accent
        ? 'border-amber-400/40 bg-[linear-gradient(180deg,rgba(251,191,36,0.14),rgba(251,191,36,0.06))] dark:bg-amber-400/10'
        : 'border-zinc-200/80 bg-white/70 dark:border-zinc-800 dark:bg-zinc-900/60'
    }`}>
      <div className="mb-3 flex items-center justify-between text-zinc-400 dark:text-zinc-500">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em]">{label}</span>
        {icon}
      </div>
      <div className={`min-h-11 text-base font-semibold leading-tight ${accent ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-950 dark:text-zinc-50'}`}>
        {value}
      </div>
      <div className="mt-2 text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">{hint}</div>
    </div>
  );
}

type SummaryTone = 'amber' | 'red' | 'zinc';

function SummaryCard({
  label,
  value,
  helper,
  tone,
  compact,
}: {
  label: string;
  value: string;
  helper: string;
  tone: SummaryTone;
  compact?: boolean;
}) {
  const cls =
    tone === 'amber'
      ? 'border-amber-400/30 bg-amber-400/8 text-amber-700 dark:text-amber-300 dark:bg-amber-400/10'
      : tone === 'red'
        ? 'border-red-500/25 bg-red-500/8 text-red-700 dark:text-red-300 dark:bg-red-500/10'
        : 'border-zinc-200/80 bg-white/70 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200';

  return (
    <div className={`col-span-1 rounded-2xl border backdrop-blur ${compact ? 'p-3' : 'p-3.5'} ${cls}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-70">{label}</div>
      <div className={`${compact ? 'mt-1.5 text-xl' : 'mt-2 text-2xl'} font-mono font-semibold tabular-nums tracking-tight`}>{value}</div>
      <div className="mt-0.5 text-[11px] leading-5 opacity-60">{helper}</div>
    </div>
  );
}

function ProtocolRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">{title}</div>
      <p className="mt-1.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{body}</p>
    </div>
  );
}

function DoctrineItem({
  icon,
  title,
  body,
  danger,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-red-500/10 text-red-500' : 'bg-amber-400/12 text-amber-700 dark:text-amber-300'}`}>
          {icon}
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-700 dark:text-zinc-300">{title}</div>
          <p className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">{body}</p>
        </div>
      </div>
    </div>
  );
}
