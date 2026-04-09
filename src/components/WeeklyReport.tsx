'use client';

import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getIncorrectAnswers } from '@/lib/toeic';

export function WeeklyReport() {
  const sessions = useStore((state) => state.sessions);
  const locale = useStore((state) => state.locale);

  const report = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    let thisWeekCount = 0;
    let thisWeekMistakes = 0;
    let lastWeekCount = 0;
    let lastWeekMistakes = 0;

    for (const s of sessions) {
      if (s.status === 'debugged' && s.timerSummary?.completedAt) {
        const completedAt = new Date(s.timerSummary.completedAt);
        if (completedAt >= oneWeekAgo) {
          thisWeekCount++;
          thisWeekMistakes += getIncorrectAnswers(s);
        } else if (completedAt >= twoWeeksAgo && completedAt < oneWeekAgo) {
          lastWeekCount++;
          lastWeekMistakes += getIncorrectAnswers(s);
        }
      }
    }

    const thisWeekErrorRate = thisWeekCount > 0 ? thisWeekMistakes / thisWeekCount : 0;
    const lastWeekErrorRate = lastWeekCount > 0 ? lastWeekMistakes / lastWeekCount : 0;

    return {
      thisWeekCount,
      lastWeekCount,
      countDiff: thisWeekCount - lastWeekCount,
      thisWeekErrorRate,
      lastWeekErrorRate,
      errorRateDiff: thisWeekErrorRate - lastWeekErrorRate,
    };
  }, [sessions]);

  if (report.thisWeekCount === 0 && report.lastWeekCount === 0) {
    return (
      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-[16px] border border-black/5 dark:border-white/5 opacity-60 grayscale">
        <div className="flex flex-col pr-4">
          <span className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
            {locale === 'zh' ? '本周回顾' : 'Weekly Digest'}
          </span>
          <span className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
            {locale === 'zh' ? '暂无练习数据，期待你的新产出。' : 'No records yet. Ready when you are.'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-[16px] border border-black/5 dark:border-white/5">
      <div className="flex flex-col pr-4">
        <span className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
          {locale === 'zh' ? '本周回顾' : 'Weekly Digest'}
        </span>
        <span className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
          {locale === 'zh'
            ? `本周完成了 ${report.thisWeekCount} 个练习，比上周${report.countDiff >= 0 ? `高产 ${report.countDiff}` : `少 ${Math.abs(report.countDiff)}`} 个。`
            : `Completed ${report.thisWeekCount} sessions this week (${report.countDiff > 0 ? '+' : ''}${report.countDiff} vs last week).`}
        </span>
      </div>
      {(report.thisWeekCount > 0 && report.lastWeekCount > 0) && (
        <div className="flex flex-col items-end shrink-0">
          <div className="flex items-center gap-1.5">
            {report.errorRateDiff < 0 ? (
              <TrendingDown className="size-3.5 text-emerald-500" />
            ) : report.errorRateDiff > 0 ? (
              <TrendingUp className="size-3.5 text-rose-500" />
            ) : (
              <Minus className="size-3.5 text-zinc-400" />
            )}
            <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
              {Math.abs(report.errorRateDiff).toFixed(1)}
            </span>
          </div>
          <span className="text-[10px] font-medium text-zinc-400 mt-0.5">
             {locale === 'zh' ? '均错浮动' : 'Err diff'}
          </span>
        </div>
      )}
    </div>
  );
}
