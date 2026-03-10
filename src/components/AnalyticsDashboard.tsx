'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
  getPartsForType,
  LISTENING_PARTS,
  PART_QUESTION_COUNTS,
  READING_PARTS,
  sumMistakes,
} from '@/lib/toeic';
import { useStore } from '@/store/useStore';
import { getCopy, translatePart, translateReason } from '@/lib/i18n';

export function AnalyticsDashboard() {
  const sessions = useStore((state) => state.sessions);
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);

  const { trendData, radarData, reasonData } = useMemo(() => {
    const sessionMap = new Map(sessions.map((session) => [session.id, session]));

    const trendData = Array.from({ length: 10 }, (_, index) => {
      const setNumber = index + 1;
      const listening = sessionMap.get(`L${setNumber}`);
      const reading = sessionMap.get(`R${setNumber}`);

      return {
        set: `S${setNumber}`,
        Listening: listening && listening.status !== 'not-started' ? sumMistakes(listening) : undefined,
        Reading: reading && reading.status !== 'not-started' ? sumMistakes(reading) : undefined,
      };
    });

    const radarData = [...LISTENING_PARTS, ...READING_PARTS].map((part) => {
      const matchingSessions = sessions.filter(
        (session) => session.status !== 'not-started' && getPartsForType(session.type).includes(part as never)
      );
      const totalMistakes = matchingSessions.reduce((sum, session) => sum + (session.mistakes[part] ?? 0), 0);
      const totalQuestions = PART_QUESTION_COUNTS[part] * Math.max(matchingSessions.length, 1);
      const errorRate = totalQuestions > 0 ? Number(((totalMistakes / totalQuestions) * 100).toFixed(1)) : 0;

      return {
        part: translatePart(locale, part),
        errorRate,
        baseline: 100,
      };
    });

    const reasonCounts = new Map<string, number>();
    for (const session of sessions) {
      for (const reason of session.reasons) {
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      }
    }

    const reasonData = [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason: translateReason(locale, reason), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return { trendData, radarData, reasonData };
  }, [locale, sessions]);

  return (
    <section className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title={copy.mistakeTrend}
          description={copy.mistakeTrendDesc}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.15)" vertical={false} />
                <XAxis dataKey="set" tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" allowDecimals={false} />
                <Tooltip
                  cursor={{ stroke: 'rgba(251,191,36,0.3)', strokeWidth: 1 }}
                  contentStyle={{
                    background: 'var(--tooltip-bg)',
                    borderColor: 'var(--tooltip-border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: 'var(--tooltip-color)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" name={copy.listeningSeries} dataKey="Listening" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 2.5 }} activeDot={{ r: 5 }} connectNulls />
                <Line type="monotone" name={copy.readingSeries} dataKey="Reading" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 2.5 }} activeDot={{ r: 5 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={copy.weaknessRadar}
          description={copy.weaknessRadarDesc}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="68%">
                <PolarGrid stroke="rgba(161,161,170,0.15)" />
                <PolarAngleAxis dataKey="part" tick={{ fill: '#71717a', fontSize: 10 }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar dataKey="errorRate" stroke="#ef4444" fill="#ef4444" fillOpacity={0.22} strokeWidth={2} />
                <Tooltip
                  formatter={(value: number) => [`${Number(value).toFixed(1)}%`, copy.errorRate]}
                  contentStyle={{
                    background: 'var(--tooltip-bg)',
                    borderColor: 'var(--tooltip-border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: 'var(--tooltip-color)',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
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
