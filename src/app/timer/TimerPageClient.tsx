'use client';

import dynamic from 'next/dynamic';

import { DebugForm } from '@/components/DebugForm';
import { DashboardShell, DeferredPanelPlaceholder, ProtocolRow, SectionShell, useDashboardContext } from '@/components/DashboardShell';
import { LapTimer } from '@/components/LapTimer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatSessionTitle, translateStatus } from '@/lib/i18n';

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

  return (
    <SectionShell
      index="01"
      title={locale === 'zh' ? '计时与录入' : 'Timer & Review'}
      description={`${activeSession.label} · ${formatSessionTitle(locale, activeSession)}`}
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
              <div className="rounded-full border border-zinc-200/90 bg-white/75 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400">
                {translateStatus(locale, activeSession.status)}
              </div>
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
  );
}