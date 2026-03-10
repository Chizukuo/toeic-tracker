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
    const delta = actualMinutes - baseline;

    return {
      name: segment.shortLabel,
      label: translatePart(locale, segment.key),
      baseline,
      actual: Number(actualMinutes.toFixed(1)),
      delta: Number(delta.toFixed(1)),
      fill: delta > 0 ? '#ef4444' : '#f59e0b',
    };
  });

  const totalBaseline = data.reduce((sum, entry) => sum + entry.baseline, 0);
  const totalActual = data.reduce((sum, entry) => sum + entry.actual, 0);
  const totalDelta = Number((totalActual - totalBaseline).toFixed(1));

  return (
    <Card className="deck-card">
      <CardHeader className="deck-card-header px-6 py-4">
        <CardTitle className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-600 dark:text-amber-400">
          {copy.readingTimeProfiling}
        </CardTitle>
        <CardDescription className="text-xs">
          {copy.readingTimeProfilingDesc}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <ProfilingStat
            label={locale === 'zh' ? '总实际耗时' : 'Total actual'}
            value={`${totalActual.toFixed(1)}m`}
          />
          <ProfilingStat
            label={locale === 'zh' ? '基准预算' : 'Budget'}
            value={`${totalBaseline.toFixed(1)}m`}
          />
          <ProfilingStat
            label={locale === 'zh' ? '总体偏移' : 'Total delta'}
            value={`${totalDelta > 0 ? '+' : ''}${totalDelta.toFixed(1)}m`}
            danger={totalDelta > 0}
          />
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={6} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.15)" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" />
              <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" unit="m" />
              <Tooltip
                cursor={{ fill: 'rgba(251,191,36,0.07)' }}
                contentStyle={{
                  background: 'var(--tooltip-bg)',
                  borderColor: 'var(--tooltip-border)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: 'var(--tooltip-color)',
                }}
                formatter={(value: number, key: string) => {
                  if (key === 'delta') {
                    return [`${value > 0 ? '+' : ''}${value.toFixed(1)}m`, copy.delta];
                  }

                  return [`${Number(value).toFixed(1)}m`, key === 'actual' ? copy.actual : copy.baseline];
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <ReferenceLine y={0} stroke="rgba(113,113,122,0.35)" />
              <Bar dataKey="baseline" name={copy.baseline} radius={[4, 4, 0, 0]} fill="#52525b" maxBarSize={40} />
              <Bar dataKey="actual" name={copy.actual} radius={[4, 4, 0, 0]} maxBarSize={40}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {data.map((entry) => (
            <div key={entry.name} className="deck-surface-soft flex items-center justify-between rounded-lg px-3 py-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{entry.label}</span>
              <span className={`font-mono font-medium ${entry.delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {entry.delta > 0 ? '+' : ''}{entry.delta.toFixed(1)}m
                <span className="ml-2 font-normal text-zinc-400 dark:text-zinc-500">
                  ({entry.actual.toFixed(1)}m / {entry.baseline.toFixed(1)}m)
                </span>
              </span>
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
    <Card className="deck-card">
      <CardHeader className="deck-card-header px-6 py-4">
        <CardTitle className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">{title}</CardTitle>
        <CardDescription className="text-xs">{body}</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="deck-empty flex h-44 items-center justify-center px-6 text-center text-xs leading-6 text-zinc-400 dark:text-zinc-500">
          {placeholder}
        </div>
      </CardContent>
    </Card>
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
    <div className="deck-surface-soft rounded-2xl p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">{label}</div>
      <div className={`mt-1.5 font-mono text-xl font-semibold tracking-tight ${danger ? 'text-red-500' : 'text-zinc-900 dark:text-zinc-50'}`}>{value}</div>
    </div>
  );
}
