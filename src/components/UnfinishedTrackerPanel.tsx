'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
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
    <motion.section 
      className="w-full max-w-6xl mx-auto space-y-6"
      variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
      initial="hidden" animate="show"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {copy.unfinishedTrackerTitle}
          </h1>
          <p className="mt-1 text-[15px] text-zinc-500 dark:text-zinc-400">
            {copy.unfinishedTrackerDescription}
          </p>
        </div>
      </div>

      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0 } } }} className="grid gap-4 md:grid-cols-3">
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
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0 } } }} className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
            <WidgetCard className="flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/6 dark:border-white/6 pb-4">
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    {copy.unfinishedQueue}
                  </div>
                  <div className="mt-1 text-[13px] text-zinc-500">
                    {copy.unfinishedChartHint}
                  </div>
                </div>
                <div className="px-3 py-1 bg-white dark:bg-[#2C2C2E] rounded-full text-[10px] font-bold tracking-widest border border-black/4 dark:border-white/4 shadow-sm">
                  {copy.unfinished(totalUnfinished)}
                </div>
              </div>

              {unfinishedSessions.length === 0 ? (
                <div className="mt-6 flex min-h-64 flex-col items-center justify-center px-6 py-8 text-center rounded-[20px] border border-dashed border-zinc-200 dark:border-zinc-800">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ClipboardList className="size-6" />
                  </div>
                  <div className="mt-4 text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {copy.unfinishedNone}
                  </div>
                  <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-zinc-500">
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
                          background: 'rgba(255, 255, 255, 0.85)',
                          backdropFilter: 'blur(20px)',
                          border: '1px solid rgba(0,0,0,0.06)',
                          borderRadius: '12px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                          fontSize: '12px',
                          color: '#18181b',
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
                          if (cx === undefined || cy === undefined || !payload) return <g key={`dot-${index}`} />;
                          return (
                            <circle
                              key={`dot-${payload.id}-${index}`}
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
            </WidgetCard>

            <WidgetCard className="flex flex-col">
              <div className="text-[12px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                {locale === 'zh' ? '处理清单' : 'Resolution Queue'}
              </div>
              <div className="mt-2 text-[14px] leading-relaxed text-zinc-500">
                {locale === 'zh'
                  ? '优先清掉仍有遗漏的 session，避免后面的分析与估分失真。'
                  : 'Resolve leftover sessions first so analytics and projections stay trustworthy.'}
              </div>

              <div className="mt-5 space-y-3">
                {unfinishedSessions.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[14px] text-zinc-400 rounded-[20px] border border-dashed border-zinc-200 dark:border-zinc-800">
                    {copy.unfinishedNoneDescription}
                  </div>
                ) : (
                  unfinishedSessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => openSession(session.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-[20px] border p-4 text-left transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96]',
                        session.active
                          ? 'border-amber-400/40 bg-amber-400/5 dark:bg-amber-400/10 shadow-sm'
                          : 'border-black/4 dark:border-white/4 bg-white dark:bg-[#1C1C1E] hover:bg-zinc-50 dark:hover:bg-[#2C2C2E]'
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                            {session.label}
                          </span>
                          <span className="rounded-full border border-red-500/10 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400">
                            {session.tag}
                          </span>
                        </div>
                        <div className="mt-1 text-[13px] text-zinc-500 leading-normal">
                          {locale === 'zh'
                            ? `仍有 ${session.count} 题未补录完成。`
                            : `${session.count} questions pending.`}
                        </div>
                      </div>
                      <span className={cn(
                        buttonVariants({ variant: session.active ? 'default' : 'outline', size: 'sm' }),
                        "rounded-[12px] h-9 px-4 text-[13px] font-medium transition-all duration-300",
                        session.active ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900' : ''
                      )}>
                        {copy.openSession}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </WidgetCard>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0 } } }} className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
            <WidgetCard className="flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/6 dark:border-white/6 pb-4">
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    {locale === 'zh' ? '超时画像' : 'Overtime Profile'}
                  </div>
                  <div className="mt-1 text-[13px] text-zinc-500">
                    {locale === 'zh'
                      ? '阅读超时后的速度损失和补录表现。'
                      : 'Speed loss and overtime performance.'}
                  </div>
                </div>
                <div className="px-3 py-1 bg-white dark:bg-[#2C2C2E] rounded-full text-[10px] font-bold tracking-widest border border-black/4 dark:border-white/4 shadow-sm">
                  {locale === 'zh' ? `${overtimeInsight.timedOutCount} 次超时` : `${overtimeInsight.timedOutCount} timeouts`}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <TrackerStat
                  icon={<TimerReset className="size-4" />}
                  label={locale === 'zh' ? '超时场次' : 'Timed Out'}
                  value={`${overtimeInsight.timedOutCount}`}
                  helper={locale === 'zh' ? '阅读套题' : 'Sets'}
                  tone="coral"
                />
                <TrackerStat
                  icon={<ClipboardList className="size-4" />}
                  label={locale === 'zh' ? '已完成补录' : 'Resolved'}
                  value={`${overtimeInsight.resolvedCount}`}
                  helper={locale === 'zh' ? '已写入数据' : 'Resolved'}
                  tone="cyan"
                />
                <TrackerStat
                  icon={<Orbit className="size-4" />}
                  label={locale === 'zh' ? '累计加时' : 'Total Overtime'}
                  value={formatMinutes(overtimeInsight.totalOvertimeMs)}
                  helper={locale === 'zh' ? '额外耗时' : 'Extra time'}
                  tone="amber"
                />
                <TrackerStat
                  icon={<Orbit className="size-4" />}
                  label={locale === 'zh' ? '平均速度' : 'Avg Gap'}
                  value={`${overtimeInsight.averageSpeedGap}`}
                  helper={locale === 'zh' ? '分数差值' : 'Score gap'}
                  tone="slate"
                />
              </div>
            </WidgetCard>

            <WidgetCard className="flex flex-col">
              <div className="text-[12px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                {locale === 'zh' ? '关键观察' : 'Key Observations'}
              </div>
              <div className="mt-2 text-[14px] leading-relaxed text-zinc-500">
                {locale === 'zh'
                  ? '衡量时间压力具体压垮了哪一侧。'
                  : 'Measures where time pressure is breaking performance.'}
              </div>

              <div className="mt-5 space-y-3">
                <InsightTile
                  title={locale === 'zh' ? '最大速度损失' : 'Largest Speed Gap'}
                  body={overtimeInsight.maxSpeedGapSession
                    ? `${overtimeInsight.maxSpeedGapSession.label} 拉开了 ${overtimeInsight.maxSpeedGapSession.gap} 分差。`
                    : locale === 'zh' ? '样本不足。' : 'Insufficient samples.'}
                  actionLabel={overtimeInsight.maxSpeedGapSession ? copy.openSession : undefined}
                  onClick={overtimeInsight.maxSpeedGapSession ? () => openSession(overtimeInsight.maxSpeedGapSession!.id) : undefined}
                />
                <InsightTile
                  title={locale === 'zh' ? '补录热点 Part' : 'Overtime Hotspot'}
                  body={overtimeInsight.hotspotPart
                    ? `${overtimeInsight.hotspotPart.part} 累计错了 ${overtimeInsight.hotspotPart.mistakes} 题。`
                    : locale === 'zh' ? '样本不足。' : 'Insufficient samples.'}
                />
                <InsightTile
                  title={locale === 'zh' ? '最近一次超时' : 'Latest Timeout'}
                  body={overtimeInsight.latestTimedOut
                    ? `${overtimeInsight.latestTimedOut.label} 有 ${overtimeInsight.latestTimedOut.timerSummary?.unfinishedQuestions ?? 0} 题超时。`
                    : locale === 'zh' ? '样本不足。' : 'Insufficient samples.'}
                  actionLabel={overtimeInsight.latestTimedOut ? copy.openSession : undefined}
                  onClick={overtimeInsight.latestTimedOut ? () => openSession(overtimeInsight.latestTimedOut!.id) : undefined}
                />
              </div>
            </WidgetCard>
          </motion.div>
    </motion.section>
  );
}

function WidgetCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      "bg-white dark:bg-[#1C1C1E] rounded-[24px] p-6 lg:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/4 dark:border-white/4",
      className
    )}>
      {children}
    </div>
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
    <div className="p-4 rounded-[20px] bg-white dark:bg-[#1C1C1E] border border-black/4 dark:border-white/4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{title}</div>
      <div className="mt-2 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-300">{body}</div>
      {actionLabel && onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="mt-3 inline-flex items-center px-3 py-1.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 active:scale-[0.96]"
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
      ? 'border-amber-400/20 bg-amber-400/5 dark:bg-amber-400/10'
      : tone === 'coral'
        ? 'border-red-400/20 bg-red-400/5 dark:bg-red-400/10'
        : tone === 'cyan'
          ? 'border-cyan-400/20 bg-cyan-400/5 dark:bg-cyan-400/10'
          : 'border-black/[0.04] dark:border-white/[0.04] bg-zinc-50/50 dark:bg-zinc-900/20';

  return (
    <div className={cn('rounded-[24px] border p-5 shadow-sm transition-all', toneClass)}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{label}</div>
        <div className="text-zinc-400">{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-2 text-[12px] font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap overflow-hidden text-ellipsis">{helper}</div>
    </div>
  );
}

function UnfinishedStat({
  label,
  value,
  helper,
  icon,
  tone = 'amber',
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  tone?: 'amber' | 'slate' | 'coral' | 'cyan';
}) {
  const toneClass =
    tone === 'amber' ? 'border-amber-500/10 bg-amber-500/5 text-amber-600' :
    tone === 'coral' ? 'border-rose-500/10 bg-rose-500/5 text-rose-600' :
    tone === 'cyan' ? 'border-cyan-500/10 bg-cyan-500/5 text-cyan-600' :
    'border-zinc-500/10 bg-zinc-500/5 text-zinc-500';

  return (
    <div className={cn('rounded-[24px] border p-5 shadow-sm transition-all', toneClass)}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{label}</div>
        <div className="text-zinc-400">{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-2 text-[12px] font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap overflow-hidden text-ellipsis">{helper}</div>
    </div>
  );
}
