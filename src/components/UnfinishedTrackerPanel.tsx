'use client';

import type { ReactNode } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ClipboardList, Orbit, TimerReset } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCopy } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

type UnfinishedPoint = {
  id: string;
  label: string;
  count: number;
  active: boolean;
  hasBacklog: boolean;
  tag: string;
};

export function UnfinishedTrackerPanel() {
  const { sessions, activeSessionId, locale, selectSession } = useStore();
  const copy = getCopy(locale);

  const readingSessions = sessions.filter((session) => session.type === 'R');

  const chartData: UnfinishedPoint[] = readingSessions.map((session) => ({
    id: session.id,
    label: session.label,
    count: session.timerSummary?.unfinishedQuestions ?? 0,
    active: session.id === activeSessionId,
    hasBacklog: (session.timerSummary?.unfinishedQuestions ?? 0) > 0,
    tag: session.timerSummary?.timedOut
      ? locale === 'zh'
        ? '超时'
        : 'Timeout'
      : session.timerSummary?.forcedSubmit
        ? locale === 'zh'
          ? '强制交卷'
          : 'Forced'
        : locale === 'zh'
          ? '正常交卷'
          : 'Saved',
  }));

  const unfinishedSessions = chartData.filter((session) => session.hasBacklog);
  const totalUnfinished = unfinishedSessions.reduce((sum, session) => sum + session.count, 0);
  const currentUnfinished = chartData.find((session) => session.id === activeSessionId)?.count ?? 0;
  const latestUnfinished = [...readingSessions]
    .filter((session) => (session.timerSummary?.unfinishedQuestions ?? 0) > 0)
    .sort(
      (a, b) =>
        new Date(b.timerSummary?.completedAt ?? 0).getTime() -
        new Date(a.timerSummary?.completedAt ?? 0).getTime()
    )[0];

  return (
    <Card className="glass-panel overflow-hidden rounded-[32px] border border-white/65 shadow-[0_24px_80px_-46px_rgba(15,23,42,0.22)] dark:border-white/10">
      <CardHeader className="deck-card-header px-6 py-5">
        <CardTitle className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-700 dark:text-amber-300">
          {copy.unfinishedTrackerTitle}
        </CardTitle>
        <CardDescription className="max-w-3xl text-xs leading-6">
          {copy.unfinishedTrackerDescription}
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-5 p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <TrackerStat
            icon={<ClipboardList className="size-4" />}
            label={copy.unfinishedTotal}
            value={`${totalUnfinished}`}
            helper={copy.unfinishedChartHint}
            tone="amber"
          />
          <TrackerStat
            icon={<Orbit className="size-4" />}
            label={copy.unfinishedSessions}
            value={`${unfinishedSessions.length}`}
            helper={copy.affectedCount(unfinishedSessions.length)}
            tone="slate"
          />
          <TrackerStat
            icon={<TimerReset className="size-4" />}
            label={copy.unfinishedCurrent}
            value={`${currentUnfinished}`}
            helper={latestUnfinished ? `${copy.unfinishedLatest}: ${latestUnfinished.label}` : copy.unfinishedNone}
            tone={currentUnfinished > 0 ? 'coral' : 'cyan'}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <div className="deck-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 pb-3 dark:border-white/8">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                  {copy.unfinishedQueue}
                </div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {copy.unfinishedChartHint}
                </div>
              </div>
              <div className="deck-pill text-[10px] tracking-[0.22em]">
                {copy.unfinished(totalUnfinished)}
              </div>
            </div>

            {unfinishedSessions.length === 0 ? (
              <div className="deck-empty mt-4 flex min-h-64 flex-col items-center justify-center px-6 py-8 text-center">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ClipboardList className="size-5" />
                </div>
                <div className="mt-4 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {copy.unfinishedNone}
                </div>
                <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {copy.unfinishedNoneDescription}
                </p>
              </div>
            ) : (
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 12, left: -18, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.15)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" allowDecimals={false} />
                    <Tooltip
                      cursor={{ stroke: 'rgba(245,158,11,0.24)', strokeWidth: 1 }}
                      contentStyle={{
                        background: 'var(--tooltip-bg)',
                        borderColor: 'var(--tooltip-border)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: 'var(--tooltip-color)',
                      }}
                      formatter={(value: number, _name, item) => [
                        copy.unfinished(Number(value)),
                        item?.payload?.tag ?? copy.unfinishedTrackerTitle,
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={(props) => {
                        const { cx, cy, payload } = props;

                        if (cx === undefined || cy === undefined || !payload) {
                          return <g />;
                        }

                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={payload.active ? 6 : payload.hasBacklog ? 4.5 : 3}
                            fill={payload.hasBacklog ? '#ef7154' : '#f59e0b'}
                            stroke={payload.active ? '#111827' : '#ffffff'}
                            strokeWidth={payload.active ? 2 : 1.5}
                            className={payload.hasBacklog ? 'cursor-pointer' : 'cursor-default'}
                            onClick={() => selectSession(payload.id)}
                          />
                        );
                      }}
                      activeDot={{ r: 7, fill: '#111827', stroke: '#f59e0b', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="deck-surface-strong rounded-[28px] p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              {locale === 'zh' ? '处理清单' : 'Resolution Queue'}
            </div>
            <div className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {locale === 'zh'
                ? '优先清掉仍有遗漏的 session，避免后面的分析与估分失真。'
                : 'Resolve leftover sessions first so analytics and projections stay trustworthy.'}
            </div>

            <div className="mt-4 space-y-3">
              {unfinishedSessions.length === 0 ? (
                <div className="deck-empty px-4 py-5 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {copy.unfinishedNoneDescription}
                </div>
              ) : (
                unfinishedSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => selectSession(session.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-[22px] border p-4 text-left transition-all',
                      session.active
                        ? 'border-amber-400/45 bg-amber-400/10 shadow-[0_18px_40px_-30px_rgba(245,158,11,0.4)]'
                        : 'border-zinc-200/80 bg-white/72 hover:border-amber-300/50 hover:bg-white dark:border-white/8 dark:bg-white/[0.035] dark:hover:bg-white/6'
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                          {session.label}
                        </span>
                        <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-red-600 dark:text-red-300">
                          {session.tag}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        {locale === 'zh'
                          ? `仍有 ${session.count} 题未完成，建议立即回到该套题补录。`
                          : `${session.count} questions remain unfinished. Jump back and resolve them now.`}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant={session.active ? 'default' : 'outline'}
                      size="sm"
                      className={session.active ? 'shrink-0 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200' : 'shrink-0'}
                    >
                      {copy.openSession}
                    </Button>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrackerStat({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: 'amber' | 'slate' | 'coral' | 'cyan';
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-300/60 bg-[linear-gradient(180deg,rgba(255,214,102,0.18),rgba(255,255,255,0.82))] dark:bg-[linear-gradient(180deg,rgba(255,196,75,0.09),rgba(16,18,24,0.95))]'
      : tone === 'coral'
        ? 'border-orange-300/60 bg-[linear-gradient(180deg,rgba(255,160,122,0.16),rgba(255,255,255,0.82))] dark:bg-[linear-gradient(180deg,rgba(239,114,84,0.09),rgba(16,18,24,0.95))]'
        : tone === 'cyan'
          ? 'border-cyan-300/60 bg-[linear-gradient(180deg,rgba(125,225,255,0.16),rgba(255,255,255,0.82))] dark:bg-[linear-gradient(180deg,rgba(84,212,255,0.08),rgba(16,18,24,0.95))]'
          : 'border-zinc-300/70 bg-white/78 dark:border-white/8 dark:bg-zinc-950/82';

  return (
    <div className={cn('rounded-[24px] border p-4 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.26)]', toneClass)}>
      <div className="flex items-center justify-between gap-3 text-zinc-500 dark:text-zinc-400">
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</div>
        <div>{icon}</div>
      </div>
      <div className="mt-3 font-mono text-[2.4rem] font-semibold tracking-[-0.05em] text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{helper}</div>
    </div>
  );
}