'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCopy, translatePart } from '@/lib/i18n';
import { READING_LAP_SEGMENTS, type SessionRecord } from '@/lib/toeic';
import { useStore } from '@/store/useStore';

export function TimeWaterfallChart({ session }: { session: SessionRecord }) {
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);

  if (session.type !== 'R') {
    return (
      <PlaceholderCard
        title={copy.timeProfilingLocked}
        body={copy.timeProfilingLockedBody}
        placeholder={copy.strictPacingPlaceholder}
      />
    );
  }

  const hasLapData = READING_LAP_SEGMENTS.some((segment) => session.readingLapTimes[segment.key] !== undefined);

  if (!hasLapData) {
    return (
      <PlaceholderCard
        title={copy.noReadingLapData}
        body={copy.noReadingLapDataBody}
        placeholder={copy.strictPacingPlaceholder}
      />
    );
  }

  const data = READING_LAP_SEGMENTS.map((segment) => {
    const actualMinutes = (session.readingLapTimes[segment.key] ?? 0) / 60000;
    const baseline = segment.baselineMinutes;
    // If actual time is 0 (or almost 0), it usually means the part was skipped/not reached (e.g. timed out before reaching here)
    const isSkipped = actualMinutes === 0;
    const delta = isSkipped ? 0 : actualMinutes - baseline;

    return {
      name: segment.shortLabel,
      label: translatePart(locale, segment.key),
      baseline,
      actual: Number(actualMinutes.toFixed(1)),
      delta: Number(delta.toFixed(1)),
      isSkipped,
      fill: isSkipped ? '#a1a1aa' : (delta > 0 ? '#ef4444' : '#f59e0b'),
    };
  });

  const validData = data.filter(d => !d.isSkipped);
  const totalBaseline = data.reduce((sum, entry) => sum + entry.baseline, 0); // Keep original budget for the total
  const totalActual = data.reduce((sum, entry) => sum + entry.actual, 0);
  const totalDelta = Number((totalActual - validData.reduce((sum, entry) => sum + entry.baseline, 0)).toFixed(1));

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-4 sm:px-6 pt-6 pb-2">
        <CardTitle className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {locale === 'zh' ? '用时瀑布' : 'Pacing Waterfall'}
        </CardTitle>
        <CardDescription className="mt-1 text-[14px] text-zinc-500 dark:text-zinc-400">
          {copy.readingTimeProfilingDesc}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <ProfilingStat
            label={locale === 'zh' ? '总实际耗时' : 'Total actual'}
            value={`${totalActual.toFixed(1)}m`}
          />
          <ProfilingStat
            label={locale === 'zh' ? '预算分布' : 'Budget'}
            value={`${totalBaseline.toFixed(1)}m`}
          />
          <ProfilingStat
            label={locale === 'zh' ? '总体偏移' : 'Total delta'}
            value={`${totalDelta > 0 ? '+' : ''}${totalDelta.toFixed(1)}m`}
            danger={totalDelta > 0}
          />
        </div>

        <div className="h-64 sm:h-72 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={6} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="currentColor" opacity={0.04} vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.4 }} dy={10} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.4 }} unit="m" dx={-10} />
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
                  padding: '10px 14px'
                }}
                itemStyle={{ color: '#18181b', fontWeight: 600 }}
                labelStyle={{ color: '#71717a', marginBottom: '4px', fontWeight: 500 }}
                formatter={(value: number, key: string, props: { payload?: { isSkipped?: boolean } }) => {
                  const isSkipped = props.payload?.isSkipped;
                  if (key === 'delta') {
                    if (isSkipped) return [locale === 'zh' ? '超时未做' : 'Not Reached', copy.delta];
                    return [`${value > 0 ? '+' : ''}${value.toFixed(1)}m`, copy.delta];
                  }

                  if (key === 'actual' && isSkipped) {
                     return [locale === 'zh' ? '-' : '-', copy.actual];
                  }
                  return [`${Number(value).toFixed(1)}m`, key === 'actual' ? copy.actual : copy.baseline];
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.2} />
              <Bar dataKey="baseline" name={copy.baseline} radius={[4, 4, 0, 0]} fill="#a1a1aa" maxBarSize={32} opacity={0.6} />
              <Bar dataKey="actual" name={copy.actual} radius={[4, 4, 0, 0]} maxBarSize={32} opacity={0.9}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-8 grid gap-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between rounded-xl px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/30 border border-black/5 dark:border-white/5">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{entry.label}</span>
              {entry.isSkipped ? (
                <span className="font-semibold tracking-tight text-zinc-400 dark:text-zinc-500">
                  {locale === 'zh' ? '未触及/跳过' : 'Not Reached'}
                  <span className="ml-2.5 font-medium text-[13px] text-zinc-400/70 dark:text-zinc-600">
                    - / {entry.baseline.toFixed(1)}
                  </span>
                </span>
              ) : (
                <span className={`font-semibold tabular-nums tracking-tight ${entry.delta > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {entry.delta > 0 ? '+' : ''}{entry.delta.toFixed(1)} min
                  <span className="ml-2.5 font-medium text-[13px] text-zinc-400 dark:text-zinc-500">
                    {entry.actual.toFixed(1)} / {entry.baseline.toFixed(1)}
                  </span>
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PlaceholderCard({
  title,
  body,
  placeholder,
}: {
  title: string;
  body: string;
  placeholder: string;
}) {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-[24px] border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#1C1C1E]/50 p-6 text-center">
      <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50 mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 mb-6 max-w-sm">{body}</p>
      <div className="rounded-2xl bg-white dark:bg-[#2C2C2E] px-6 py-4 shadow-sm border border-black/5 dark:border-white/5">
        <p className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400">{placeholder}</p>
      </div>
    </div>
  );
}

function ProfilingStat({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-[16px] bg-zinc-50 dark:bg-[#2C2C2E] p-4 flex flex-col justify-center items-center shadow-sm border border-black/2 dark:border-white/5">
      <div className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tracking-tight tabular-nums ${danger ? 'text-red-500 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-50'}`}>
        {value}
      </div>
    </div>
  );
}
