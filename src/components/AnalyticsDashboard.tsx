'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';

import {
  CartesianGrid,
  Legend,
  Line,
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
  BarChart,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getIncorrectAnswers,
  getSessionPartLossMap,
  getPartsForType,
  LISTENING_PARTS,
  type MistakeKey,
  PART_QUESTION_COUNTS,
  READING_PARTS,
} from '@/lib/toeic';
import { useStore } from '@/store/useStore';
import { getCopy, translatePart, translateReason } from '@/lib/i18n';

type LossTrendPoint = {
  set: string;
  Listening?: number;
  Reading?: number;
  Total?: number;
  paired: boolean;
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
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);

  const { trendData, lossSummary, radarData, radarSummary, reasonData } = useMemo(() => {
    const sessionMap = new Map(sessions.map((session) => [session.id, session]));
    const partMistakes = new Map<string, number>();
    const partAttempts = new Map<string, number>();
    const reasonCounts = new Map<string, number>();
    let totalTrackedLoss = 0;
    let recordedSessions = 0;

    for (const session of sessions) {
      if (session.status !== 'not-started') {
        recordedSessions += 1;
        const partLossMap = getSessionPartLossMap(session);

        for (const part of getPartsForType(session.type)) {
          partAttempts.set(part, (partAttempts.get(part) ?? 0) + 1);
          partMistakes.set(part, (partMistakes.get(part) ?? 0) + partLossMap[part]);
          totalTrackedLoss += partLossMap[part];
        }
      }

      for (const reason of session.reasons) {
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      }
    }

    const trendData: LossTrendPoint[] = Array.from({ length: 10 }, (_, index) => {
      const setNumber = index + 1;
      const listening = sessionMap.get(`L${setNumber}`);
      const reading = sessionMap.get(`R${setNumber}`);
      const listeningLoss = listening && listening.status !== 'not-started' ? getIncorrectAnswers(listening) : undefined;
      const readingLoss = reading && reading.status !== 'not-started' ? getIncorrectAnswers(reading) : undefined;
      const hasAnyData = listeningLoss !== undefined || readingLoss !== undefined;

      return {
        set: `S${setNumber}`,
        Listening: listeningLoss,
        Reading: readingLoss,
        Total: hasAnyData ? (listeningLoss ?? 0) + (readingLoss ?? 0) : undefined,
        paired: listeningLoss !== undefined && readingLoss !== undefined,
      };
    });

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
      lossSummary: summarizeLossTrend(trendData),
      radarData,
      radarSummary: {
        recordedSessions,
        totalTrackedLoss,
        hotspots: rankedRadar.slice(0, 3),
        highestErrorRate,
        highestLossShare,
      },
      reasonData,
    };
  }, [locale, sessions]);

  return (
    <section className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <LossTrendCard
          title={copy.mistakeTrend}
          description={copy.mistakeTrendDesc}
          data={trendData}
          summary={lossSummary}
          locale={locale}
          listeningLabel={copy.listeningSeries}
          readingLabel={copy.readingSeries}
        />

        <WeaknessRadarCard
          title={copy.weaknessRadar}
          description={copy.weaknessRadarDesc}
          data={radarData}
          summary={radarSummary}
          locale={locale}
        />
      </div>

      <ChartCard
        title={copy.rootCauseFrequency}
        description={copy.rootCauseFrequencyDesc}
      >
        {reasonData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reasonData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.15)" vertical={false} />
                <XAxis dataKey="reason" tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(251,191,36,0.07)' }}
                  contentStyle={{
                    background: 'var(--tooltip-bg)',
                    borderColor: 'var(--tooltip-border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: 'var(--tooltip-color)',
                  }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="deck-empty flex h-44 items-center justify-center px-6 text-center text-xs leading-6 text-zinc-400 dark:text-zinc-500">
            {copy.saveDebugToUnlock}
          </div>
        )}
      </ChartCard>
    </section>
  );
}

function WeaknessRadarCard({
  title,
  description,
  data,
  summary,
  locale,
}: {
  title: string;
  description: string;
  data: RadarPoint[];
  summary: RadarSummary;
  locale: 'zh' | 'en';
}) {
  const hasRadarData = summary.recordedSessions > 0;
  const seriesLabelError = locale === 'zh' ? '错误率' : 'Error rate';
  const seriesLabelShare = locale === 'zh' ? '失分占比' : 'Loss share';
  const radarScale = getAdaptiveRadarScale(data);

  return (
    <Card className="deck-card">
      <CardHeader className="deck-card-header gap-3 px-6 py-4">
        <div className="space-y-1">
          <CardTitle className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-600 dark:text-amber-400">{title}</CardTitle>
          <CardDescription className="text-xs leading-6">{description}</CardDescription>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="deck-pill">
            {locale === 'zh' ? '已记录 session' : 'Recorded sessions'} {summary.recordedSessions}
          </span>
          <span className="deck-pill">
            {locale === 'zh' ? '纳入失分' : 'Tracked loss'} {summary.totalTrackedLoss}
          </span>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 p-6">
        {hasRadarData ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
              <div className="deck-surface-soft rounded-[24px] p-4">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={data} outerRadius="72%">
                      <PolarGrid stroke="rgba(161,161,170,0.16)" />
                      <PolarAngleAxis dataKey="part" tick={{ fill: '#71717a', fontSize: 10 }} />
                      <PolarRadiusAxis
                        domain={[0, radarScale.maxDomain]}
                        axisLine={false}
                        tick={{ fill: '#a1a1aa', fontSize: 10 }}
                        tickCount={radarScale.tickCount}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Radar
                        name={seriesLabelError}
                        dataKey="errorRate"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.18}
                        strokeWidth={2.25}
                      />
                      <Radar
                        name={seriesLabelShare}
                        dataKey="lossShare"
                        stroke="#06b6d4"
                        fill="#06b6d4"
                        fillOpacity={0.08}
                        strokeWidth={2}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          const point = payload?.[0]?.payload as RadarPoint | undefined;

                          if (!active || !point) {
                            return null;
                          }

                          return (
                            <div
                              className="min-w-47 rounded-2xl border px-3 py-2 text-xs shadow-xl"
                              style={{
                                background: 'var(--tooltip-bg)',
                                borderColor: 'var(--tooltip-border)',
                                color: 'var(--tooltip-color)',
                              }}
                            >
                              <div className="font-medium">{point.part}</div>
                              <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                {locale === 'zh'
                                  ? `${point.group === 'Listening' ? '听力' : '阅读'} · ${point.attempts} 次记录`
                                  : `${point.group} · ${point.attempts} attempts`}
                              </div>
                              <div className="mt-3 space-y-1.5">
                                <div className="flex items-center justify-between gap-4">
                                  <span>{seriesLabelError}</span>
                                  <span>{formatRadarPercent(point.errorRate)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span>{seriesLabelShare}</span>
                                  <span>{formatRadarPercent(point.lossShare)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span>{locale === 'zh' ? '累计失分' : 'Total loss'}</span>
                                  <span>{point.totalMistakes}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span>{locale === 'zh' ? '覆盖题量' : 'Question volume'}</span>
                                  <span>{point.totalQuestions}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span>{locale === 'zh' ? '压力指数' : 'Pressure index'}</span>
                                  <span>{formatRadarPercent(point.pressure)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid gap-3">
                <RadarMetric
                  label={locale === 'zh' ? '最高错误率' : 'Highest error rate'}
                  value={summary.highestErrorRate?.part ?? '--'}
                  hint={summary.highestErrorRate ? formatRadarPercent(summary.highestErrorRate.errorRate) : getEmptyMetricHint(locale)}
                />
                <RadarMetric
                  label={locale === 'zh' ? '最大失分占比' : 'Largest loss share'}
                  value={summary.highestLossShare?.part ?? '--'}
                  hint={summary.highestLossShare ? formatRadarPercent(summary.highestLossShare.lossShare) : getEmptyMetricHint(locale)}
                />
                <RadarMetric
                  label={locale === 'zh' ? '热点数量' : 'Hotspot count'}
                  value={`${summary.hotspots.length}`}
                  hint={locale === 'zh' ? '按压力指数排序' : 'Ranked by pressure index'}
                />
              </div>
            </div>

            <div className="deck-surface-soft rounded-[24px] p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                {locale === 'zh' ? '诊断摘要' : 'Diagnostic summary'}
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {buildRadarInsight({ locale, summary })}
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {summary.hotspots.map((item, index) => (
                <div key={item.partKey} className="deck-surface-soft rounded-[22px] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                    {locale === 'zh' ? `热点 ${index + 1}` : `Hotspot ${index + 1}`}
                  </div>
                  <div className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">{item.part}</div>
                  <div className="mt-3 grid gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="flex items-center justify-between gap-3">
                      <span>{seriesLabelError}</span>
                      <span>{formatRadarPercent(item.errorRate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{seriesLabelShare}</span>
                      <span>{formatRadarPercent(item.lossShare)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{locale === 'zh' ? '记录次数' : 'Attempts'}</span>
                      <span>{item.attempts}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{locale === 'zh' ? '累计失分' : 'Loss count'}</span>
                      <span>{item.totalMistakes}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="deck-empty flex h-104 items-center justify-center px-6 text-center text-xs leading-6 text-zinc-400 dark:text-zinc-500">
            {locale === 'zh'
              ? '至少完成一套听力或阅读后，这里才会显示各 Part 的错误率、失分占比和压力热点。'
              : 'Finish at least one listening or reading set to unlock error rate, loss share, and pressure hotspots by part.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="deck-card">
      <CardHeader className="deck-card-header px-6 py-4">
        <CardTitle className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-600 dark:text-amber-400">{title}</CardTitle>
        <CardDescription className="text-xs leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}

function LossTrendCard({
  title,
  description,
  data,
  summary,
  locale,
  listeningLabel,
  readingLabel,
}: {
  title: string;
  description: string;
  data: LossTrendPoint[];
  summary: LossTrendSummary;
  locale: 'zh' | 'en';
  listeningLabel: string;
  readingLabel: string;
}) {
  const latestDelta =
    summary.latest?.Total !== undefined && summary.previous?.Total !== undefined
      ? summary.latest.Total - summary.previous.Total
      : undefined;

  return (
    <Card className="deck-card">
      <CardHeader className="deck-card-header gap-3 px-6 py-4">
        <div className="space-y-1">
          <CardTitle className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-600 dark:text-amber-400">{title}</CardTitle>
          <CardDescription className="text-xs leading-6">{description}</CardDescription>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="deck-pill">
            {locale === 'zh' ? '已成对' : 'Paired'} {summary.pairedCount}/10
          </span>
          <span className="deck-pill">
            {locale === 'zh' ? '待补全' : 'Partial'} {summary.partialCount}
          </span>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LossMetric
            label={locale === 'zh' ? '最新总错题' : 'Latest total incorrect'}
            value={formatLossMetric(summary.latest?.Total, locale)}
            hint={summary.latest ? `${summary.latest.set}${summary.latest.paired ? '' : locale === 'zh' ? ' · 单科' : ' · partial'}` : getEmptyMetricHint(locale)}
          />
          <LossMetric
            label={locale === 'zh' ? '较上次变化' : 'Change vs previous'}
            value={formatDeltaMetric(latestDelta, locale)}
            hint={describeDelta(latestDelta, locale)}
          />
          <LossMetric
            label={locale === 'zh' ? '近 3 套均值' : 'Last 3-set avg'}
            value={formatLossMetric(summary.recentAverage, locale, 1)}
            hint={summary.availableCount >= 3 ? (locale === 'zh' ? '仅统计最近 3 个已记录套次' : 'Based on the last 3 recorded sets') : getEmptyMetricHint(locale)}
          />
          <LossMetric
            label={locale === 'zh' ? '最佳套次' : 'Best set'}
            value={summary.best?.set ?? '--'}
            hint={summary.best?.Total !== undefined ? `${formatLossMetric(summary.best.Total, locale)} ${locale === 'zh' ? '总错题' : 'total incorrect'}` : getEmptyMetricHint(locale)}
          />
        </div>

        <div className="deck-surface-soft rounded-[24px] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                {locale === 'zh' ? '诊断结论' : 'Diagnostic readout'}
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {buildLossInsight({ locale, summary, listeningLabel, readingLabel })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="deck-pill">
                {locale === 'zh' ? '最近波动' : 'Recent range'} {formatLossRange(summary.recentRange, locale)}
              </span>
              <span className="deck-pill">
                {locale === 'zh' ? '最差套次' : 'Worst set'} {summary.worst?.set ?? '--'}
              </span>
            </div>
          </div>
        </div>

        {summary.availableCount > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.15)" vertical={false} />
                <XAxis dataKey="set" tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(245,158,11,0.08)' }}
                  labelFormatter={(label, payload) => {
                    const point = payload?.[0]?.payload as LossTrendPoint | undefined;
                    if (!point) {
                      return String(label);
                    }

                    return point.paired
                      ? `${label} · ${locale === 'zh' ? '听读成对' : 'paired listening/reading'}`
                      : `${label} · ${locale === 'zh' ? '数据未补全' : 'partial data'}`;
                  }}
                  formatter={(value: number | string, name: string) => [
                    `${Number(value)}${locale === 'zh' ? ' 题' : ''}`,
                    name,
                  ]}
                  contentStyle={{
                    background: 'var(--tooltip-bg)',
                    borderColor: 'var(--tooltip-border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: 'var(--tooltip-color)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Listening" name={listeningLabel} stackId="loss" fill="#38bdf8" radius={[0, 0, 6, 6]} maxBarSize={30} />
                <Bar dataKey="Reading" name={readingLabel} stackId="loss" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={30} />
                <Line
                  type="monotone"
                  dataKey="Total"
                  name={locale === 'zh' ? '总错题' : 'Total incorrect'}
                  stroke="#fb7185"
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="deck-empty flex h-56 items-center justify-center px-6 text-center text-xs leading-6 text-zinc-400 dark:text-zinc-500">
            {locale === 'zh'
              ? '至少完成一套听力或阅读后，这里会显示错题结构、总错题与最近波动。'
              : 'Complete at least one listening or reading set to unlock the incorrect-answer breakdown, total incorrect count, and recent volatility.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LossMetric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="deck-surface-soft rounded-[22px] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</div>
      <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{hint}</div>
    </div>
  );
}

function RadarMetric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="deck-surface-soft rounded-[22px] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{value}</div>
      <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{hint}</div>
    </div>
  );
}

function summarizeLossTrend(data: LossTrendPoint[]): LossTrendSummary {
  const available = data.filter((point) => point.Total !== undefined);
  const pairedCount = data.filter((point) => point.paired).length;
  const partialCount = data.filter((point) => point.Total !== undefined && !point.paired).length;

  if (available.length === 0) {
    return {
      availableCount: 0,
      pairedCount,
      partialCount,
    };
  }

  const latest = available[available.length - 1];
  const previous = available.length > 1 ? available[available.length - 2] : undefined;
  const recent = available.slice(-3);
  const recentTotals = recent.map((point) => point.Total ?? 0);
  const recentAverage = recentTotals.reduce((sum, value) => sum + value, 0) / recentTotals.length;
  const recentRange = recentTotals.length > 1 ? Math.max(...recentTotals) - Math.min(...recentTotals) : 0;
  const best = available.reduce((lowest, point) => ((point.Total ?? Infinity) < (lowest.Total ?? Infinity) ? point : lowest), available[0]);
  const worst = available.reduce((highest, point) => ((point.Total ?? -Infinity) > (highest.Total ?? -Infinity) ? point : highest), available[0]);

  return {
    availableCount: available.length,
    pairedCount,
    partialCount,
    latest,
    previous,
    best,
    worst,
    recentAverage: Number(recentAverage.toFixed(1)),
    recentRange,
  };
}

function formatLossMetric(value: number | undefined, locale: 'zh' | 'en', digits = 0) {
  if (value === undefined) {
    return '--';
  }

  return digits > 0 ? value.toFixed(digits) : `${Math.round(value)}`;
}

function formatDeltaMetric(delta: number | undefined, locale: 'zh' | 'en') {
  if (delta === undefined) {
    return '--';
  }

  if (delta === 0) {
    return locale === 'zh' ? '持平' : 'Flat';
  }

  return `${delta > 0 ? '+' : ''}${delta}`;
}

function describeDelta(delta: number | undefined, locale: 'zh' | 'en') {
  if (delta === undefined) {
    return getEmptyMetricHint(locale);
  }

  if (delta < 0) {
    return locale === 'zh' ? '总错题下降，趋势在改善。' : 'Total incorrect answers are down, so the trend is improving.';
  }

  if (delta > 0) {
    return locale === 'zh' ? '总错题回升，需要排查波动来源。' : 'Total incorrect answers are up, so the recent spike needs review.';
  }

  return locale === 'zh' ? '与上一个已记录套次持平。' : 'Flat versus the previous recorded set.';
}

function formatLossRange(range: number | undefined, locale: 'zh' | 'en') {
  if (range === undefined) {
    return '--';
  }

  return `${range}${locale === 'zh' ? ' 题' : ''}`;
}

function formatRadarPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function getAdaptiveRadarScale(data: RadarPoint[]) {
  const recordedPoints = data.filter((item) => item.attempts > 0);

  if (recordedPoints.length === 0) {
    return {
      maxDomain: 100,
      tickCount: 6,
    };
  }

  const maxValue = recordedPoints.reduce((highest, item) => {
    return Math.max(highest, item.errorRate, item.lossShare);
  }, 0);
  const paddedMax = maxValue < 10 ? maxValue * 1.35 : maxValue * 1.18;
  const roundedMax = roundRadarDomain(Math.max(paddedMax, 20));
  const tickStep = getRadarTickStep(roundedMax);
  const tickCount = Math.floor(roundedMax / tickStep) + 1;

  return {
    maxDomain: roundedMax,
    tickCount,
  };
}

function roundRadarDomain(value: number) {
  if (value <= 25) {
    return 25;
  }

  if (value <= 50) {
    return Math.ceil(value / 5) * 5;
  }

  if (value <= 80) {
    return Math.ceil(value / 10) * 10;
  }

  return 100;
}

function getRadarTickStep(maxDomain: number) {
  if (maxDomain <= 25) {
    return 5;
  }

  if (maxDomain <= 50) {
    return 10;
  }

  return 20;
}

function getEmptyMetricHint(locale: 'zh' | 'en') {
  return locale === 'zh' ? '记录更多套次后显示' : 'More recorded sets needed';
}

function buildRadarInsight({
  locale,
  summary,
}: {
  locale: 'zh' | 'en';
  summary: RadarSummary;
}) {
  if (summary.recordedSessions === 0 || summary.hotspots.length === 0) {
    return locale === 'zh'
      ? '当前还没有足够的 Part 级数据。先完成并保存训练记录，系统才会开始识别高压热点。'
      : 'There is not enough part-level data yet. Save completed training records before the dashboard starts identifying pressure hotspots.';
  }

  const lead = summary.hotspots[0];
  const errorPart = summary.highestErrorRate;
  const sharePart = summary.highestLossShare;

  if (locale === 'zh') {
    return `${lead.part} 当前是综合压力最高的模块，压力指数 ${formatRadarPercent(lead.pressure)}。${errorPart ? `${errorPart.part} 的纯错误率最高，达到 ${formatRadarPercent(errorPart.errorRate)}。` : ''}${sharePart ? `${sharePart.part} 占全部失分的 ${formatRadarPercent(sharePart.lossShare)}，说明它对总损失的拖拽最强。` : ''}`.trim();
  }

  return `${lead.part} is the strongest overall pressure point at ${formatRadarPercent(lead.pressure)}. ${errorPart ? `${errorPart.part} carries the highest pure error rate at ${formatRadarPercent(errorPart.errorRate)}.` : ''} ${sharePart ? `${sharePart.part} contributes ${formatRadarPercent(sharePart.lossShare)} of all tracked loss, making it the heaviest drag on the total result.` : ''}`.trim();
}

function buildLossInsight({
  locale,
  summary,
  listeningLabel,
  readingLabel,
}: {
  locale: 'zh' | 'en';
  summary: LossTrendSummary;
  listeningLabel: string;
  readingLabel: string;
}) {
  if (!summary.latest || summary.latest.Total === undefined) {
    return locale === 'zh'
      ? '当前还没有足够数据做诊断。先完成至少一套听力或阅读，系统才会开始判断错题结构和波动。'
      : 'There is not enough data for diagnostics yet. Finish at least one listening or reading set before the dashboard can evaluate incorrect-answer structure and volatility.';
  }

  const latestDominant = getDominantLabel(summary.latest, locale, listeningLabel, readingLabel);
  const delta =
    summary.previous?.Total !== undefined ? (summary.latest.Total ?? 0) - summary.previous.Total : undefined;
  const deltaText =
    delta === undefined
      ? locale === 'zh'
        ? '这是首个可用套次。'
        : 'This is the first recorded set.'
      : delta < 0
        ? locale === 'zh'
          ? `较上次减少 ${Math.abs(delta)} 题。`
          : `Down ${Math.abs(delta)} from the previous set.`
        : delta > 0
          ? locale === 'zh'
            ? `较上次增加 ${delta} 题。`
            : `Up ${delta} from the previous set.`
          : locale === 'zh'
            ? '与上次持平。'
            : 'Flat versus the previous set.';

  const stabilityText =
    summary.recentRange === undefined
      ? ''
      : locale === 'zh'
        ? `最近波动区间 ${summary.recentRange} 题。`
        : `Recent range is ${summary.recentRange}.`;

  return locale === 'zh'
    ? `最新 ${summary.latest.set} 总错题 ${summary.latest.Total} 题，当前压力主要来自${latestDominant}。${deltaText} ${stabilityText}`.trim()
    : `${summary.latest.set} closed at ${summary.latest.Total} incorrect answers, with ${latestDominant} currently contributing more pressure. ${deltaText} ${stabilityText}`.trim();
}

function getDominantLabel(
  point: LossTrendPoint,
  locale: 'zh' | 'en',
  listeningLabel: string,
  readingLabel: string
) {
  const listening = point.Listening ?? 0;
  const reading = point.Reading ?? 0;

  if (listening === reading) {
    return locale === 'zh' ? '听读均衡' : 'a balanced split';
  }

  return listening > reading ? listeningLabel : readingLabel;
}
