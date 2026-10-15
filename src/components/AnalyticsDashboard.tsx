'use client';

import type { ReactNode } from 'react';
import { useDeferredValue, useMemo } from 'react';
import { motion } from 'framer-motion';

import {
  CartesianGrid,
  Line,
  LineChart,
  ComposedChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
} from 'recharts';
import { TrendingDown, TrendingUp, Minus, AlertCircle, Sparkles } from 'lucide-react';

import {
  getAnalyticsDataConfidence,
  getSessionPartLossMap,
  hasRecordedSessionData,
  isSessionEstimateEligible,
  LISTENING_PARTS,
  type AnalyticsConfidence,
  type MistakeKey,
  PART_QUESTION_COUNTS,
  READING_PARTS,
} from '@/lib/toeic';
import { useStore } from '@/store/useStore';
import { getCopy, translatePart, translateReason } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type LossTrendPoint = {
  set: string;
  Listening?: number;
  Reading?: number;
  Total?: number;
  PairedTotal?: number;
  paired: boolean;
  [key: string]: string | number | boolean | undefined;
};

type LossTrendSummary = {
  availableCount: number;
  pairedCount: number;
  partialCount: number;
  latest?: LossTrendPoint;
  previous?: LossTrendPoint;
  best?: LossTrendPoint;
  worst?: LossTrendPoint;
  recentAverage?: number;
  recentRange?: number;
};

type RadarPoint = {
  partKey: MistakeKey;
  part: string;
  /** Short axis label that fits around the radar on a phone; the full name is in `part`. */
  axisLabel: string;
  group: 'Listening' | 'Reading';
  errorRate: number;
  lossShare: number;
  pressure: number;
  attempts: number;
  totalMistakes: number;
  totalQuestions: number;
};

type RadarSummary = {
  recordedSessions: number;
  totalTrackedLoss: number;
  hotspots: RadarPoint[];
  highestErrorRate?: RadarPoint;
  highestLossShare?: RadarPoint;
};

export function AnalyticsDashboard() {
  const sessions = useStore((state) => state.sessions);
  const sprintConfig = useStore((state) => state.sprintConfig);
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);
  const deferredSessions = useDeferredValue(sessions);

  const { trendData, lossSummary, radarData, radarSummary, reasonData, analyticsConfidence } = useMemo(() => {
    const sessionMap = new Map(deferredSessions.map((session) => [session.id, session]));
    const partMistakes = new Map<string, number>();
    const partAttempts = new Map<string, number>();
    const reasonCounts = new Map<string, number>();
    let totalTrackedLoss = 0;
    let recordedSessions = 0;

    for (const session of deferredSessions) {
      if (hasRecordedSessionData(session)) {
        recordedSessions += 1;
      }

      for (const reason of session.reasons) {
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      }
    }

    const trendCount = Math.max(sprintConfig.listeningCount, sprintConfig.readingCount);
    const trendData: LossTrendPoint[] = [];
    for (let index = 0; index < trendCount; index++) {
      const setNumber = index + 1;
      const listening = sessionMap.get(`L${setNumber}`);
      const reading = sessionMap.get(`R${setNumber}`);
      // Only scored sections count: an attempt that hasn't been reviewed has no real mistake
      // count yet, and a section that wasn't done is missing data, not 100% wrong.
      const listeningScored = listening ? isSessionEstimateEligible(listening) : false;
      const readingScored = reading ? isSessionEstimateEligible(reading) : false;

      const listeningLossMap = listeningScored && listening ? getSessionPartLossMap(listening) : undefined;
      const readingLossMap = readingScored && reading ? getSessionPartLossMap(reading) : undefined;

      const listeningLoss = listeningLossMap
        ? LISTENING_PARTS.reduce((sum, part) => sum + (listeningLossMap[part] ?? 0), 0)
        : undefined;
      const readingLoss = readingLossMap
        ? READING_PARTS.reduce((sum, part) => sum + (readingLossMap[part] ?? 0), 0)
        : undefined;
      const hasAnyData = listeningLoss !== undefined || readingLoss !== undefined;

      const listeningMistakes: Record<string, number> = listeningLossMap
        ? Object.fromEntries(LISTENING_PARTS.map((part) => [part, listeningLossMap[part] ?? 0]))
        : {};
      const readingMistakes: Record<string, number> = readingLossMap
        ? Object.fromEntries(READING_PARTS.map((part) => [part, readingLossMap[part] ?? 0]))
        : {};

      if (listeningLossMap) {
        for (const part of LISTENING_PARTS) {
          const loss = listeningLossMap[part] ?? 0;
          partAttempts.set(part, (partAttempts.get(part) ?? 0) + 1);
          partMistakes.set(part, (partMistakes.get(part) ?? 0) + loss);
          totalTrackedLoss += loss;
        }
      }

      if (readingLossMap) {
        for (const part of READING_PARTS) {
          const loss = readingLossMap[part] ?? 0;
          partAttempts.set(part, (partAttempts.get(part) ?? 0) + 1);
          partMistakes.set(part, (partMistakes.get(part) ?? 0) + loss);
          totalTrackedLoss += loss;
        }
      }

      trendData.push({
        set: `S${setNumber}`,
        Listening: listeningLoss,
        Reading: readingLoss,
        Total: hasAnyData ? (listeningLoss ?? 0) + (readingLoss ?? 0) : undefined,
        // The total line only joins full sets, so a half-done set can't look like a big drop.
        PairedTotal: listeningLoss !== undefined && readingLoss !== undefined ? listeningLoss + readingLoss : undefined,
        paired: listeningLoss !== undefined && readingLoss !== undefined,
        ...listeningMistakes,
        ...readingMistakes,
      });
    }

    const radarData: RadarPoint[] = [...LISTENING_PARTS, ...READING_PARTS].map((part) => {
      const totalMistakes = partMistakes.get(part) ?? 0;
      const attempts = partAttempts.get(part) ?? 0;
      const totalQuestions = PART_QUESTION_COUNTS[part] * attempts;
      const errorRate = totalQuestions > 0 ? Number(((totalMistakes / totalQuestions) * 100).toFixed(1)) : 0;
      const lossShare = totalTrackedLoss > 0 ? Number(((totalMistakes / totalTrackedLoss) * 100).toFixed(1)) : 0;
      const pressure = Number((errorRate * 0.68 + lossShare * 0.32).toFixed(1));

      return {
        partKey: part,
        part: translatePart(locale, part),
        axisLabel: (locale === 'zh' ? RADAR_AXIS_LABELS_ZH : RADAR_AXIS_LABELS_EN)[part],
        group: LISTENING_PARTS.includes(part as (typeof LISTENING_PARTS)[number]) ? 'Listening' : 'Reading',
        errorRate,
        lossShare,
        pressure,
        attempts,
        totalMistakes,
        totalQuestions,
      };
    });

    const rankedRadar = [...radarData]
      .filter((item) => item.attempts > 0)
      .sort((left, right) => right.pressure - left.pressure || right.errorRate - left.errorRate || right.lossShare - left.lossShare);

    const highestErrorRate = rankedRadar.reduce<RadarPoint | undefined>((highest, item) => {
      if (!highest || item.errorRate > highest.errorRate) {
        return item;
      }
      return highest;
    }, undefined);

    const highestLossShare = rankedRadar.reduce<RadarPoint | undefined>((highest, item) => {
      if (!highest || item.lossShare > highest.lossShare) {
        return item;
      }
      return highest;
    }, undefined);

    const reasonData = [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason: translateReason(locale, reason), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      trendData,
      analyticsConfidence: getAnalyticsDataConfidence(deferredSessions),
      lossSummary: summarizeLossTrend(trendData),
      // Untested Parts would sit at 0% and read as "strong"; leave them off the radar entirely.
      radarData: radarData.filter((item) => item.attempts > 0),
      radarSummary: {
        recordedSessions,
        totalTrackedLoss,
        hotspots: rankedRadar.slice(0, 3),
        highestErrorRate,
        highestLossShare,
      },
      reasonData,
    };
  }, [deferredSessions, locale, sprintConfig]);

  return (
    <motion.section 
      className="w-full max-w-6xl mx-auto space-y-6"
      variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
      initial="hidden" animate="show"
    >
      <HeaderInsight locale={locale} confidence={analyticsConfidence} summary={lossSummary} radarSummary={radarSummary} />

      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0 } } }}>
        <WidgetCard>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{copy.mistakeTrend}</h2>
            <p className="mt-1 text-[14px] text-zinc-500 dark:text-zinc-400">
              {buildLossInsight({ locale, summary: lossSummary })}
            </p>
          </div>
          {lossSummary.latest?.Total !== undefined && (
            <div className="flex flex-col items-end">
              <span className="text-[12px] font-medium text-zinc-400 uppercase tracking-widest">{lossSummary.latest.paired ? (locale === 'zh' ? '最近一整套错题' : 'Latest full set') : (locale === 'zh' ? '最新错题' : 'Latest Loss')}</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{lossSummary.latest.Total}</span>
                <TrendIndicator delta={lossSummary.latest.Total - (lossSummary.previous?.Total ?? lossSummary.latest.Total)} />
              </div>
            </div>
          )}
        </div>

        {lossSummary.availableCount > 0 ? (
          <>
          <div className="h-70 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="currentColor" opacity={0.04} vertical={false} />
                <XAxis dataKey="set" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.4 }} dy={10} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.4 }} allowDecimals={false} dx={-10} />
                <Tooltip
                  cursor={{ fill: 'currentColor', opacity: 0.03 }}
                  contentStyle={{
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(0,0,0,0.06)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    fontSize: '13px',
                    color: '#18181b',
                    padding: '8px 12px'
                  }}
                  itemStyle={{ color: '#18181b', fontWeight: 500 }}
                  labelStyle={{ color: '#71717a', marginBottom: '2px', fontWeight: 500 }}
                  formatter={(value: number, name: string) => [`${value}`, name === 'Total' ? (locale === 'zh' ? '总错题' : 'Total') : name]}
                />
                <Bar key="listening-bar" dataKey="Listening" name={copy.listeningSeries} stackId="loss" fill="#38bdf8" radius={[0, 0, 4, 4]} maxBarSize={32} opacity={0.9} />
                <Bar key="reading-bar" dataKey="Reading" name={copy.readingSeries} stackId="loss" fill="#fbbf24" radius={[4, 4, 0, 0]} maxBarSize={32} opacity={0.9} />
                <Line
                  key="total-line"
                  type="monotone"
                  dataKey="PairedTotal"
                  name="Total"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#ef4444' }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-sky-400" />{locale === 'zh' ? '听力错题' : 'Listening'}</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-amber-400" />{locale === 'zh' ? '阅读错题' : 'Reading'}</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded-full bg-red-500" />{locale === 'zh' ? '整套总错题（两项都做了才连线）' : 'Full-set total (only sets with both sections)'}</span>
          </div>
          </>
        ) : (
          <EmptyState message={locale === 'zh' ? '完成一套练习以查看趋势' : 'Complete a set to view trends'} />
        )}
        </WidgetCard>
      </motion.div>

      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0 } } }} className="grid md:grid-cols-2 gap-6">
        <WidgetCard className="flex flex-col">
          <div className="mb-5">
            <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{locale === 'zh' ? '重点突破' : 'Priority Targets'}</h2>
            <p className="mt-1 text-[14px] text-zinc-500 dark:text-zinc-400">
              {locale === 'zh' ? '基于错误率与失分的综合评估' : 'Based on error rate and loss share'}
            </p>
          </div>
          
          <div className="flex-1 flex flex-col justify-center">
            {radarSummary.hotspots.length > 0 ? (
              <div className="flex flex-col rounded-[16px] bg-zinc-50/80 dark:bg-[#2C2C2E]/80 overflow-hidden">
                {radarSummary.hotspots.map((item, index) => (
                  <div key={item.partKey} className={cn(
                    "flex items-center justify-between p-4",
                    index !== radarSummary.hotspots.length - 1 && "border-b border-black/4 dark:border-white/4"
                  )}>
                    <div className="flex items-center gap-3.5">
                      <div className="flex size-7 items-center justify-center rounded-full bg-white dark:bg-[#1C1C1E] text-[13px] font-bold text-zinc-700 dark:text-zinc-300 shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-black/2 dark:border-white/5">
                        {index + 1}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{item.part}</span>
                        <div className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-500">
                          <span className="whitespace-nowrap">{locale === 'zh' ? `错误率 ${item.errorRate.toFixed(0)}%` : `${item.errorRate.toFixed(0)}% wrong`}</span>
                          <span>·</span>
                          <span className="whitespace-nowrap">{locale === 'zh' ? `占失分 ${item.lossShare.toFixed(0)}%` : `${item.lossShare.toFixed(0)}% of lost points`}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[17px] font-bold text-zinc-900 dark:text-zinc-50">{item.pressure.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message={locale === 'zh' ? '暂无足够的数据' : 'Not enough data yet'} />
            )}
          </div>
        </WidgetCard>

        <WidgetCard className="flex flex-col">
          <div className="mb-2">
            <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{copy.weaknessRadar}</h2>
            <p className="mt-1 text-[14px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
              {buildRadarInsight({ locale, summary: radarSummary })}
            </p>
          </div>
          
          <div className="flex-1 min-h-55 relative mt-2">
            {radarSummary.recordedSessions > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="70%">
                  <PolarGrid stroke="currentColor" opacity={0.05} />
                  <PolarAngleAxis dataKey="axisLabel" tick={{ fill: 'currentColor', opacity: 0.55, fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 'auto']} axisLine={false} tick={false} />
                  <Radar
                    name={locale === 'zh' ? '错误率' : 'Error rate'}
                    dataKey="errorRate"
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    fill="#ef4444"
                    fillOpacity={0.1}
                  />
                  <Radar
                    name={locale === 'zh' ? '失分占比' : 'Loss share'}
                    dataKey="lossShare"
                    stroke="#0ea5e9"
                    strokeWidth={1.5}
                    fill="#0ea5e9"
                    fillOpacity={0.1}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255, 255, 255, 0.85)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(0,0,0,0.06)',
                      borderRadius: '12px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                      fontSize: '13px',
                      color: '#18181b',
                      padding: '8px 12px'
                    }}
                    itemStyle={{ color: '#18181b', fontWeight: 500 }}
                    labelFormatter={(_, payload) => (payload?.[0]?.payload as RadarPoint | undefined)?.part ?? ''}
                    formatter={(value) => `${value}%`}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
               <EmptyState message={locale === 'zh' ? '完成测试以生成雷达图' : 'Complete a test for radar chart'} />
            )}
          </div>
          {radarData.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-red-500" />{locale === 'zh' ? '错误率' : 'Error rate'}</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-500" />{locale === 'zh' ? '占总失分' : 'Share of lost points'}</span>
              {radarData.every((item) => item.group === 'Listening') && (
                <span>{locale === 'zh' ? '阅读还没有记录，暂只显示听力' : 'No reading yet; listening only'}</span>
              )}
              {radarData.every((item) => item.group === 'Reading') && (
                <span>{locale === 'zh' ? '听力还没有记录，暂只显示阅读' : 'No listening yet; reading only'}</span>
              )}
            </div>
          )}
        </WidgetCard>

        {/* Hotspot Convergence Chart */}
        <WidgetCard className="flex flex-col md:col-span-2">
          <div className="mb-5">
            <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{locale === 'zh' ? '弱点收敛趋势' : 'Hotspot Convergence'}</h2>
            <p className="mt-1 text-[14px] text-zinc-500 dark:text-zinc-400">
              {locale === 'zh' ? '最高错题率题型的演变过程' : 'Mistake trend for highest pressure parts'}
            </p>
          </div>
          
          <div className="flex-1 min-h-65">
            {radarSummary.hotspots.length > 0 && lossSummary.availableCount > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="currentColor" opacity={0.04} vertical={false} />
                  <XAxis dataKey="set" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.4 }} dy={10} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.4 }} allowDecimals={false} dx={-10} />
                  <Tooltip
                    cursor={{ stroke: 'currentColor', strokeOpacity: 0.1, strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{
                      background: 'rgba(255, 255, 255, 0.85)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(0,0,0,0.06)',
                      borderRadius: '12px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                      fontSize: '13px',
                      color: '#18181b',
                      padding: '10px 14px'
                    }}
                    itemStyle={{ color: '#18181b', fontWeight: 600 }}
                    labelStyle={{ color: '#71717a', marginBottom: '4px', fontWeight: 500 }}
                    formatter={(value: number, name: string) => [locale === 'zh' ? `错 ${value} 题` : `${value} wrong`, name]}
                  />
                  {radarSummary.hotspots.map((h, i) => {
                    const colors = ['#ef4444', '#f59e0b', '#38bdf8'];
                    return (
                      <Line
                        key={h.partKey}
                        type="monotone"
                        dataKey={h.partKey}
                        name={h.part}
                        stroke={colors[i % colors.length]}
                        strokeWidth={2.5}
                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0, fill: colors[i % colors.length] }}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message={locale === 'zh' ? '需要更多历史记录生成趋势' : 'More history needed for convergence chart'} />
            )}
          </div>
          {radarSummary.hotspots.length > 0 && lossSummary.availableCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {radarSummary.hotspots.map((h, i) => (
                <span key={h.partKey} className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 rounded-full" style={{ background: ['#ef4444', '#f59e0b', '#38bdf8'][i % 3] }} />
                  {h.part}
                </span>
              ))}
            </div>
          )}
        </WidgetCard>
      </motion.div>

      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0 } } }}>
        <WidgetCard>
        <div className="mb-6">
          <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{copy.rootCauseFrequency}</h2>
          <p className="mt-1 text-[14px] text-zinc-500 dark:text-zinc-400">
            {copy.rootCauseFrequencyDesc}
          </p>
        </div>
        
        {reasonData.length > 0 ? (
          <div className="flex flex-col gap-4 mt-2 max-w-3xl">
            {reasonData.map((item) => {
              const maxCount = reasonData[0]?.count || 1;
              const percentage = Math.max((item.count / maxCount) * 100, 2);
              return (
                <div key={item.reason} className="flex items-center gap-4">
                  <div className="w-27.5 sm:w-35 shrink-0">
                    <span className="text-[14px] font-medium text-zinc-700 dark:text-zinc-300 truncate block">
                      {item.reason}
                    </span>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="h-2.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-zinc-800 dark:bg-zinc-200 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-[15px] font-bold text-zinc-900 dark:text-zinc-50 min-w-7 text-right">
                      {item.count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState message={copy.saveDebugToUnlock} />
        )}
        </WidgetCard>
      </motion.div>
    </motion.section>
  );
}

function HeaderInsight({ locale, confidence, summary, radarSummary }: { locale: 'zh' | 'en'; confidence: AnalyticsConfidence; summary: LossTrendSummary; radarSummary: RadarSummary }) {
  const isHigh = confidence.level === 'high';
  const isMedium = confidence.level === 'medium';
  const riskLabel = confidence.issues[0] ? formatConfidenceIssue(locale, confidence.issues[0]) : null;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 bg-zinc-50 dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 p-4 rounded-[16px] shadow-sm">
      <div className="flex flex-1 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100/50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500">
          <Sparkles className="size-5" />
        </div>
        <p className="text-[14px] font-medium text-zinc-700 dark:text-zinc-300 leading-snug">
          {buildHeroInsight(locale, summary, radarSummary)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 self-start whitespace-nowrap text-[13px] bg-white dark:bg-[#2C2C2E] px-3 py-1.5 rounded-[14px] md:rounded-full md:shrink-0 border border-black/5 dark:border-white/5 shadow-sm">
        <span className={cn(
          "font-medium",
          isHigh ? "text-emerald-600 dark:text-emerald-400" : isMedium ? "text-amber-600 dark:text-amber-400" : "text-zinc-500"
        )}>
          {isHigh ? (locale === 'zh' ? '高可信度' : 'Stable Data') : isMedium ? (locale === 'zh' ? '中等可信度' : 'Usable Data') : (locale === 'zh' ? '数据不足' : 'Sparse Data')}
        </span>
        <span className="hidden text-zinc-300 md:inline dark:text-zinc-700">|</span>
        <span className="text-zinc-500 dark:text-zinc-400 font-medium">
          {confidence.recordedSessions} <span className="font-normal">{locale === 'zh' ? '套测验' : 'sets'}</span>
        </span>
        {riskLabel && (
          <>
            <span className="hidden text-zinc-300 md:inline dark:text-zinc-700">|</span>
            <span className="flex items-center gap-1 text-red-500 font-medium">
              <AlertCircle className="size-3.5" />
              {riskLabel}
            </span>
          </>
        )}
      </div>
    </div>
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-40 w-full items-center justify-center rounded-[16px] border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
      <p className="text-[14px] font-medium text-zinc-400 dark:text-zinc-500">{message}</p>
    </div>
  );
}

function TrendIndicator({ delta }: { delta: number }) {
  if (delta === 0) {
    return <div className="flex items-center text-zinc-400"><Minus className="size-3.5" /></div>;
  }
  if (delta < 0) {
    return (
      <div className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 text-[13px] font-medium">
        <TrendingDown className="size-3.5" />
        {Math.abs(delta)}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-0.5 text-red-500 dark:text-red-400 text-[13px] font-medium">
      <TrendingUp className="size-3.5" />
      {delta}
    </div>
  );
}


/* --- Helper Functions --- */

function formatConfidenceIssue(locale: 'zh' | 'en', issue: AnalyticsConfidence['issues'][number]) {
  switch (issue) {
    case 'unfinished-backlog': return locale === 'zh' ? '包含未完成题目' : 'Clear backlog';
    case 'missing-review': return locale === 'zh' ? '部分未复盘' : 'Finish review';
    case 'sparse-history': return locale === 'zh' ? '数据样本过少' : 'Too few samples';
    case 'missing-timer': return locale === 'zh' ? '缺乏计时数据' : 'Timer missing';
    case 'timer-running': return locale === 'zh' ? '计时仍在进行' : 'Timer running';
    default: return locale === 'zh' ? '无' : 'None';
  }
}

const RADAR_AXIS_LABELS_ZH: Record<MistakeKey, string> = {
  'Part 1': 'P1 看图',
  'Part 2': 'P2 应答',
  'Part 3': 'P3 对话',
  'Part 4': 'P4 独白',
  'Part 5': 'P5 语法',
  'Part 6': 'P6 填空',
  'Part 7 Single': 'P7 单篇',
  'Part 7 Multiple': 'P7 多篇',
};

const RADAR_AXIS_LABELS_EN: Record<MistakeKey, string> = {
  'Part 1': 'P1 Photos',
  'Part 2': 'P2 Q&A',
  'Part 3': 'P3 Conv.',
  'Part 4': 'P4 Talks',
  'Part 5': 'P5 Grammar',
  'Part 6': 'P6 Text',
  'Part 7 Single': 'P7 Single',
  'Part 7 Multiple': 'P7 Multi',
};

function summarizeLossTrend(data: LossTrendPoint[]): LossTrendSummary {
  const available = data.filter((point) => point.Total !== undefined);
  const pairedCount = data.filter((point) => point.paired).length;
  const partialCount = data.filter((point) => point.Total !== undefined && !point.paired).length;

  if (available.length === 0) {
    return { availableCount: 0, pairedCount, partialCount };
  }

  // Compare like with like: a set with only one section done would look like a huge improvement
  // next to a full set. Use sets with both sections once any exist.
  const paired = available.filter((point) => point.paired);
  const basis = paired.length > 0 ? paired : available;
  const latest = basis[basis.length - 1];
  const previous = basis.length > 1 ? basis[basis.length - 2] : undefined;
  const recent = basis.slice(-3);
  const recentTotals = recent.map((point) => point.Total ?? 0);
  const recentAverage = recentTotals.reduce((sum, value) => sum + value, 0) / recentTotals.length;
  const recentRange = recentTotals.length > 1 ? Math.max(...recentTotals) - Math.min(...recentTotals) : 0;
  const best = basis.reduce((lowest, point) => ((point.Total ?? Infinity) < (lowest.Total ?? Infinity) ? point : lowest), basis[0]);
  const worst = basis.reduce((highest, point) => ((point.Total ?? -Infinity) > (highest.Total ?? -Infinity) ? point : highest), basis[0]);

  return { availableCount: available.length, pairedCount, partialCount, latest, previous, best, worst, recentAverage: Number(recentAverage.toFixed(1)), recentRange };
}

function buildHeroInsight(locale: 'zh' | 'en', summary: LossTrendSummary, radarSummary: RadarSummary) {
  if (summary.availableCount === 0) {
    return locale === 'zh' ? '准备好开始追踪你的测验表现了吗？' : 'Ready to start tracking your progress?';
  }
  
  let insight = '';
  const latest = summary.latest?.Total ?? 0;
  const previous = summary.previous?.Total;
  const hotspot = radarSummary.hotspots[0]?.part;

  if (previous !== undefined) {
    const delta = latest - previous;
    if (delta < 0) {
      insight = locale === 'zh' ? `近期表现提升，错题减少了 ${Math.abs(delta)} 题。` : `Performance improved, mistakes down by ${Math.abs(delta)}. `;
    } else if (delta > 0) {
      insight = locale === 'zh' ? `近期错题增加了 ${delta} 题，需要关注。` : `Mistakes increased by ${delta}, requires attention. `;
    } else {
      insight = locale === 'zh' ? `整体表现保持稳定。` : `Overall performance is stable. `;
    }
  } else {
    insight = locale === 'zh' ? `最新测验产生了 ${latest} 个错题。` : `You had ${latest} mistakes in the latest set. `;
  }

  if (hotspot) {
    insight += locale === 'zh' ? `接下来的攻坚重点是 ${hotspot}。` : `Next, focus your efforts on ${hotspot}.`;
  }

  return insight;
}

function buildRadarInsight({ locale, summary }: { locale: 'zh' | 'en'; summary: RadarSummary }) {
  if (summary.recordedSessions === 0 || summary.hotspots.length === 0) {
    return locale === 'zh'
      ? '暂无足够数据。完成练习后系统将自动识别薄弱环节。'
      : 'Not enough data. Complete tests to unlock weakness insights.';
  }

  const errorPart = summary.highestErrorRate;
  const sharePart = summary.highestLossShare;

  if (locale === 'zh') {
    return `${errorPart ? `错误率最高项为 ${errorPart.part} (${errorPart.errorRate.toFixed(1)}%)。` : ''}${sharePart && sharePart.part !== errorPart?.part ? `同时 ${sharePart.part} 贡献了主要的失分 (${sharePart.lossShare.toFixed(1)}%)。` : ''}`.trim();
  }

  return `${errorPart ? `${errorPart.part} has the highest error rate (${errorPart.errorRate.toFixed(1)}%). ` : ''}${sharePart && sharePart.part !== errorPart?.part ? `${sharePart.part} accounts for ${sharePart.lossShare.toFixed(1)}% of total loss.` : ''}`.trim();
}

function buildLossInsight({ locale, summary }: { locale: 'zh' | 'en'; summary: LossTrendSummary }) {
  if (!summary.latest || summary.latest.Total === undefined) {
    return locale === 'zh'
      ? '积累数据后，这里将展示详细的趋势分析。'
      : 'Trend analysis will appear here after more data is recorded.';
  }

  const stability = summary.recentRange !== undefined && summary.pairedCount >= 3
      ? (locale === 'zh' ? `近三套波动范围在 ${summary.recentRange} 题左右。` : `Recent variation is around ${summary.recentRange} questions.`)
      : '';

  // With only one section recorded there is nothing to compare, so don't name a "dominant" side.
  if (!summary.latest.paired) {
    const onlyListening = summary.latest.Listening !== undefined;
    return locale === 'zh'
      ? `目前只有${onlyListening ? '听力' : '阅读'}的记录，做完同一套的${onlyListening ? '阅读' : '听力'}后才能比较两边。`
      : `Only ${onlyListening ? 'listening' : 'reading'} is recorded so far; finish the matching ${onlyListening ? 'reading' : 'listening'} set to compare.`;
  }

  const listening = summary.latest.Listening ?? 0;
  const reading = summary.latest.Reading ?? 0;
  
  const dominant = listening > reading ? (locale === 'zh' ? '听力' : 'Listening') : reading > listening ? (locale === 'zh' ? '阅读' : 'Reading') : (locale === 'zh' ? '听力与阅读' : 'Listening and Reading');

  return locale === 'zh'
    ? `当前失分主要集中在${dominant}部分。${stability}`
    : `Loss is mostly concentrated in ${dominant}. ${stability}`;
}
