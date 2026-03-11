'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
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

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCopy } from '@/lib/i18n';
import {
  estimateToeicSessionDualScore,
  formatMinutes,
  hasResolvedUnfinished,
  type MistakeKey,
  type SessionRecord,
} from '@/lib/toeic';
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

type OvertimeInsight = {
  timedOutCount: number;
  resolvedCount: number;
  totalOvertimeMs: number;
  averageSpeedGap: number;
  maxSpeedGapSession?: {
    id: string;
    label: string;
    gap: number;
    overtimeMs?: number;
  };
  hotspotPart?: {
    part: MistakeKey;
    mistakes: number;
  };
  latestTimedOut?: SessionRecord;
};

export function UnfinishedTrackerPanel() {
  const router = useRouter();
  const sessions = useStore((state) => state.sessions);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const locale = useStore((state) => state.locale);
  const selectSession = useStore((state) => state.selectSession);
  const copy = getCopy(locale);

  const openSession = (sessionId: string) => {
    selectSession(sessionId);
    router.push('/timer');
  };

  const { chartData, currentUnfinished, latestUnfinished, totalUnfinished, unfinishedSessions, overtimeInsight } = useMemo(() => {
    const readingSessions = sessions.filter((session) => session.type === 'R');

    const nextChartData: UnfinishedPoint[] = readingSessions.map((session) => {
      const count = session.timerSummary?.unfinishedQuestions ?? 0;
      const resolved = hasResolvedUnfinished(session);

      return {
        id: session.id,
        label: session.label,
        count,
        active: session.id === activeSessionId,
        hasBacklog: count > 0 && !resolved,
        tag: count > 0 && !resolved
          ? locale === 'zh'
            ? '待补录'
            : 'Pending'
          : session.timerSummary?.timedOut
            ? locale === 'zh'
              ? '已补录'
              : 'Resolved'
            : locale === 'zh'
              ? '正常交卷'
              : 'Saved',
      };
    });

    const nextUnfinishedSessions = nextChartData.filter((session) => session.hasBacklog);
    const nextLatestUnfinished = readingSessions.reduce<(typeof readingSessions)[number] | undefined>((latest, session) => {
      const count = session.timerSummary?.unfinishedQuestions ?? 0;

      if (count <= 0) {
        return latest;
      }

      const completedAt = new Date(session.timerSummary?.completedAt ?? 0).getTime();
      const latestCompletedAt = new Date(latest?.timerSummary?.completedAt ?? 0).getTime();

      return !latest || completedAt > latestCompletedAt ? session : latest;
    }, undefined);

    const timedOutSessions = readingSessions.filter((session) => (session.timerSummary?.unfinishedQuestions ?? 0) > 0 || session.timerSummary?.timedOut);
    const resolvedTimedOutSessions = timedOutSessions.filter((session) => hasResolvedUnfinished(session));
    const partTotals = new Map<MistakeKey, number>();
    let totalOvertimeMs = 0;
    let totalSpeedGap = 0;
    let speedGapCount = 0;
    let maxSpeedGapSession: OvertimeInsight['maxSpeedGapSession'];

    for (const session of resolvedTimedOutSessions) {
      const dual = estimateToeicSessionDualScore(session);
      const gap = Math.max(dual.potential.scaled - dual.strict.scaled, 0);
      const overtimeMs = session.timerSummary?.overtimeElapsedMs ?? 0;

      totalOvertimeMs += overtimeMs;
      totalSpeedGap += gap;
      speedGapCount += 1;

      if (!maxSpeedGapSession || gap > maxSpeedGapSession.gap) {
        maxSpeedGapSession = {
          id: session.id,
          label: session.label,
          gap,
          overtimeMs,
        };
      }

      for (const [part, mistakes] of Object.entries(session.overtimeMistakes ?? {}) as Array<[MistakeKey, number]>) {
        partTotals.set(part, (partTotals.get(part) ?? 0) + mistakes);
      }
    }

    const hotspotEntry = [...partTotals.entries()].sort((left, right) => right[1] - left[1])[0];
    const latestTimedOut = [...timedOutSessions].sort((left, right) => {
      const rightCompletedAt = new Date(right.timerSummary?.completedAt ?? 0).getTime();
      const leftCompletedAt = new Date(left.timerSummary?.completedAt ?? 0).getTime();
      return rightCompletedAt - leftCompletedAt;
    })[0];

    return {
      chartData: nextChartData,
      unfinishedSessions: nextUnfinishedSessions,
      totalUnfinished: nextUnfinishedSessions.reduce((sum, session) => sum + session.count, 0),
      currentUnfinished: nextChartData.find((session) => session.id === activeSessionId)?.count ?? 0,
      latestUnfinished: nextLatestUnfinished,
      overtimeInsight: {
        timedOutCount: timedOutSessions.length,
        resolvedCount: resolvedTimedOutSessions.length,
        totalOvertimeMs,
        averageSpeedGap: speedGapCount > 0 ? Number((totalSpeedGap / speedGapCount).toFixed(1)) : 0,
        maxSpeedGapSession,
        hotspotPart: hotspotEntry ? { part: hotspotEntry[0], mistakes: hotspotEntry[1] } : undefined,
        latestTimedOut,
      } satisfies OvertimeInsight,
    };
  }, [activeSessionId, locale, sessions]);

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
                        const { cx, cy, payload, index } = props;

                        if (cx === undefined || cy === undefined || !payload) {
                          return <g key={`unfinished-dot-empty-${index ?? 0}`} />;
                        }

                        const dotKey = `unfinished-dot-${payload.id ?? payload.label ?? index ?? 0}`;

                        return (
                          <circle
                            key={dotKey}
                            cx={cx}
                            cy={cy}
                            r={payload.active ? 6 : payload.hasBacklog ? 4.5 : 3}
                            fill={payload.hasBacklog ? '#ef7154' : '#f59e0b'}
                            stroke={payload.active ? '#111827' : '#ffffff'}
                            strokeWidth={payload.active ? 2 : 1.5}
                            className={payload.hasBacklog ? 'cursor-pointer' : 'cursor-default'}
                            onClick={() => openSession(payload.id)}
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
                    onClick={() => openSession(session.id)}
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
                          ? `仍有 ${session.count} 题未补录完成，点击后会直接进入该套题的补录模式。`
                          : `${session.count} questions are still unresolved. Jump back into the session and finish overtime entry.`}
                      </div>
                    </div>

                    <span
                      className={cn(
                        buttonVariants({ variant: session.active ? 'default' : 'outline', size: 'sm' }),
                        session.active
                          ? 'shrink-0 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200'
                          : 'shrink-0'
                      )}
                    >
                      {copy.openSession}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <div className="deck-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 pb-3 dark:border-white/8">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                  {locale === 'zh' ? '超时画像' : 'Overtime Profile'}
                </div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {locale === 'zh'
                    ? '把阅读超时后的速度损失和补录表现集中放在这里看。'
                    : 'Read the speed loss and overtime review outcomes for timed-out reading sets here.'}
                </div>
              </div>
              <div className="deck-pill text-[10px] tracking-[0.22em]">
                {locale === 'zh' ? `${overtimeInsight.timedOutCount} 次超时` : `${overtimeInsight.timedOutCount} timeouts`}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <TrackerStat
                icon={<TimerReset className="size-4" />}
                label={locale === 'zh' ? '超时场次' : 'Timed Out'}
                value={`${overtimeInsight.timedOutCount}`}
                helper={locale === 'zh' ? '进入过未完成流程的阅读套题' : 'Reading sets that entered the unfinished flow'}
                tone="coral"
              />
              <TrackerStat
                icon={<ClipboardList className="size-4" />}
                label={locale === 'zh' ? '已完成补录' : 'Resolved'}
                value={`${overtimeInsight.resolvedCount}`}
                helper={locale === 'zh' ? '已经写入 overtime 数据的套题' : 'Sets that already wrote overtime data'}
                tone="cyan"
              />
              <TrackerStat
                icon={<Orbit className="size-4" />}
                label={locale === 'zh' ? '累计加时' : 'Total Overtime'}
                value={formatMinutes(overtimeInsight.totalOvertimeMs)}
                helper={locale === 'zh' ? '所有已补录套题的额外耗时' : 'Extra time spent across resolved sets'}
                tone="amber"
              />
              <TrackerStat
                icon={<Orbit className="size-4" />}
                label={locale === 'zh' ? '平均速度损失' : 'Avg Speed Gap'}
                value={`${overtimeInsight.averageSpeedGap}`}
                helper={locale === 'zh' ? '潜力分减严格分的平均差值' : 'Average potential minus strict score gap'}
                tone="slate"
              />
            </div>
          </div>

          <div className="deck-surface-strong rounded-[28px] p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              {locale === 'zh' ? '关键观察' : 'Key Observations'}
            </div>
            <div className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {locale === 'zh'
                ? '这里不是简单的 backlog 数量，而是告诉你时间压力具体压垮了哪一侧。'
                : 'This is not just a backlog count. It shows where time pressure is actually breaking performance.'}
            </div>

            <div className="mt-4 space-y-3">
              <InsightTile
                title={locale === 'zh' ? '最大速度损失' : 'Largest Speed Gap'}
                body={overtimeInsight.maxSpeedGapSession
                  ? locale === 'zh'
                    ? `${overtimeInsight.maxSpeedGapSession.label} 拉开了 ${overtimeInsight.maxSpeedGapSession.gap} 分差，额外耗时 ${formatMinutes(overtimeInsight.maxSpeedGapSession.overtimeMs)}。`
                    : `${overtimeInsight.maxSpeedGapSession.label} opened a ${overtimeInsight.maxSpeedGapSession.gap}-point gap with ${formatMinutes(overtimeInsight.maxSpeedGapSession.overtimeMs)} of extra time.`
                  : locale === 'zh'
                    ? '还没有足够的已补录样本来计算速度损失。'
                    : 'There are not enough resolved overtime samples to compute a speed gap yet.'}
                actionLabel={overtimeInsight.maxSpeedGapSession ? copy.openSession : undefined}
                onClick={overtimeInsight.maxSpeedGapSession ? () => openSession(overtimeInsight.maxSpeedGapSession!.id) : undefined}
              />
              <InsightTile
                title={locale === 'zh' ? '补录热点 Part' : 'Overtime Hotspot'}
                body={overtimeInsight.hotspotPart
                  ? locale === 'zh'
                    ? `${overtimeInsight.hotspotPart.part} 在超时补录里累计错了 ${overtimeInsight.hotspotPart.mistakes} 题，说明这不是纯速度问题，还夹着理解断点。`
                    : `${overtimeInsight.hotspotPart.part} accumulated ${overtimeInsight.hotspotPart.mistakes} overtime mistakes, which suggests the issue is not pure speed but also comprehension breakdown.`
                  : locale === 'zh'
                    ? '目前还没有形成可用的 overtime 错题热点。'
                    : 'There is no usable overtime mistake hotspot yet.'}
              />
              <InsightTile
                title={locale === 'zh' ? '最近一次超时' : 'Latest Timeout'}
                body={overtimeInsight.latestTimedOut
                  ? locale === 'zh'
                    ? `${overtimeInsight.latestTimedOut.label} 有 ${overtimeInsight.latestTimedOut.timerSummary?.unfinishedQuestions ?? 0} 题超时，当前状态是${hasResolvedUnfinished(overtimeInsight.latestTimedOut) ? '已补录完成' : '仍待补录'}。`
                    : `${overtimeInsight.latestTimedOut.label} timed out with ${overtimeInsight.latestTimedOut.timerSummary?.unfinishedQuestions ?? 0} unfinished items and is currently ${hasResolvedUnfinished(overtimeInsight.latestTimedOut) ? 'resolved' : 'still pending'}.`
                  : locale === 'zh'
                    ? '目前还没有超时样本。'
                    : 'There is no timeout sample yet.'}
                actionLabel={overtimeInsight.latestTimedOut ? copy.openSession : undefined}
                onClick={overtimeInsight.latestTimedOut ? () => openSession(overtimeInsight.latestTimedOut!.id) : undefined}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightTile({
  title,
  body,
  actionLabel,
  onClick,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onClick?: () => void;
}) {
  return (
    <div className="deck-surface-soft rounded-[22px] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">{title}</div>
      <div className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{body}</div>
      {actionLabel && onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="mt-3 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-amber-300/60 hover:text-zinc-950 dark:border-white/8 dark:bg-zinc-950/70 dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
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