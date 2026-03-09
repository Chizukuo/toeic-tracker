'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { useStore, type DayRecord } from '@/store/useStore';

const READING_LAPS_BASELINE: Record<string, number> = {
  'Part 5 (10m)': 10,
  'Part 6 (8m)': 8,
  'Part 7 Single (25m)': 25,
  'Part 7 Multiple (32m)': 32,
};

export function TimeWaterfallChart({ record }: { record: DayRecord }) {
  if (record.type !== 'R' || !record.laps || record.laps.length === 0) return null;

  const data = record.laps.map(lap => {
    const actualMinutes = lap.timeSpentMs / (60 * 1000);
    const baselineMinutes = READING_LAPS_BASELINE[lap.part] || 0;
    const diff = actualMinutes - baselineMinutes;
    
    return {
      name: lap.part.replace(/ \(.+\)/, ''), // e.g., 'Part 5'
      actual: Number(actualMinutes.toFixed(1)),
      baseline: baselineMinutes,
      diff: Number(diff.toFixed(1)),
      isOverTime: diff > 0
    };
  });

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/30 transition-colors">
      <CardHeader>
        <CardTitle className="text-sm text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-wider flex items-center justify-between">
          <span>Time Profiling</span>
          <span className="text-xs font-sans text-zinc-400 dark:text-zinc-500 normal-case">vs Baseline</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" vertical={false} />
              <XAxis dataKey="name" stroke="currentColor" className="text-zinc-500 dark:text-zinc-500" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" className="text-zinc-500 dark:text-zinc-500" fontSize={12} tickLine={false} axisLine={false} unit="m" />
              <Tooltip 
                cursor={{ fill: 'currentColor', opacity: 0.05 }}
                contentStyle={{ backgroundColor: 'var(--tooltip-bg, #ffffff)', borderColor: 'var(--tooltip-border, #e4e4e7)', borderRadius: '8px', color: 'var(--tooltip-color, #18181b)' }}
              />
              <ReferenceLine y={0} stroke="currentColor" className="text-zinc-300 dark:text-zinc-700" />
              <Bar dataKey="actual" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.isOverTime ? '#ef4444' : '#fbbf24'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-4 text-xs text-zinc-500 dark:text-zinc-500 font-mono">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-400 rounded-sm"></div>
            <span>Within Time</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
            <span>Over Time</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}