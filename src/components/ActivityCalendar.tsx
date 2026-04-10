'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

const COLOR_LEVELS = [
  'bg-zinc-100 dark:bg-[#2C2C2E]',           // 0
  'bg-amber-200 dark:bg-amber-800/60',       // 1
  'bg-amber-300 dark:bg-amber-700/80',       // 2
  'bg-amber-400 dark:bg-amber-600',          // 3
  'bg-amber-500 dark:bg-amber-500',          // 4+
];

export function ActivityCalendar() {
  const sessions = useStore((state) => state.sessions);
  const historicalScores = useStore((state) => state.historicalScores);
  const locale = useStore((state) => state.locale);

  // Tooltip state
  const [hoverStyle, setHoverStyle] = useState({ x: 0, y: 0, opacity: 0 });
  const [hoverData, setHoverData] = useState<{ dateStr: string; count: number } | null>(null);

  // Generate the last 84 days (12 weeks * 7 days)
  const countsByDate = new Map<string, number>();

  for (const session of sessions) {
    if (session.status === 'debugged' && session.timerSummary?.completedAt) {
      const dateStr = session.timerSummary.completedAt.split('T')[0];
      countsByDate.set(dateStr, (countsByDate.get(dateStr) ?? 0) + 1);
    }
  }

  for (const score of historicalScores) {
    const dateStr = score.date;
    countsByDate.set(dateStr, (countsByDate.get(dateStr) ?? 0) + 1);
  }

  const today = new Date();
  // Use local timezone to map the days, to match exactly what the user sees as 'today'
  const days = 84;

  const results = [];
  for (let i = days - 1; i >= 0; i--) {
    const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    const count = countsByDate.get(dateStr) ?? 0;
    results.push({
      dateStr,
      count,
      level: Math.min(count, 4), // Cap at level 4 for colors
    });
  }

  // group by week (7 days each)
  const weeks = [];
  for (let i = 0; i < results.length; i += 7) {
    weeks.push(results.slice(i, i + 7));
  }

  const heatmapData = { weeks, maxStreak: calculateStreak(countsByDate) };

  // Streak calculation
  function calculateStreak(countsByDate: Map<string, number>) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    
    if (!countsByDate.has(todayStr) && !countsByDate.has(yesterdayStr)) return 0;

    let streak = 0;
    let checkDate = countsByDate.has(todayStr) ? today : yesterday;
    
    let hasActiveDay = true;
    while (hasActiveDay) {
      const checkStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (countsByDate.has(checkStr)) {
        streak++;
        checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate() - 1);
      } else {
        hasActiveDay = false;
      }
    }
    return streak;
  }

  // Effect to hide tooltip on scroll to prevent detachment
  useEffect(() => {
    const handleScroll = () => {
      if (hoverStyle.opacity > 0) {
        setHoverStyle(prev => ({ ...prev, opacity: 0 }));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hoverStyle.opacity]);

  return (
    <div className="flex flex-col gap-4 relative">
      <div className="flex items-baseline justify-between px-1">
         <div>
             <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {locale === 'zh' ? '专注日历' : 'Focus Calendar'}
             </h2>
             <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
                {locale === 'zh' ? '记录每一个练习与提升的日子' : 'Tracking every day you practiced'}
             </p>
         </div>
         <span className="flex items-center gap-1.5 text-[14px] font-medium text-amber-600 dark:text-amber-500 py-1 px-3 bg-amber-50 dark:bg-amber-500/10 rounded-full border border-amber-200/50 dark:border-amber-500/20">
            {locale === 'zh' ? `${heatmapData.maxStreak} 天连续` : `${heatmapData.maxStreak} Day Streak`} 
            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
         </span>
      </div>
      
      <div 
        className="bg-white/60 dark:bg-[#1C1C1E] border border-black/[0.04] dark:border-white/[0.04] rounded-[20px] p-5 shadow-(--shadow-soft) overflow-x-auto no-scrollbar"
        onMouseLeave={() => setHoverStyle(prev => ({ ...prev, opacity: 0 }))}
      >
        <div className="flex flex-col gap-3 min-w-max">
          <div className="flex gap-[4px]">
            {heatmapData.weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-[4px]">
                {week.map((day) => (
                  <motion.div
                    key={day.dateStr}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (wIdx * 7 + week.indexOf(day)) * 0.005 }}
                    onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoverStyle({
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8,
                        opacity: 1
                      });
                      setHoverData({ dateStr: day.dateStr, count: day.count });
                    }}
                    className={cn(
                      'size-[14px] sm:size-[16px] rounded-[3px] transition-all hover:ring-2 hover:ring-zinc-400 dark:hover:ring-zinc-500 hover:ring-offset-1 dark:hover:ring-offset-[#1C1C1E]',
                      COLOR_LEVELS[day.level]
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 text-[11px] font-medium text-zinc-400 mt-1">
            <span>{locale === 'zh' ? '少' : 'Less'}</span>
            <div className="flex gap-[4px]">
               {COLOR_LEVELS.map((color, i) => (
                 <div key={i} className={cn('size-[10px] rounded-[2px]', color)} />
               ))}
            </div>
            <span>{locale === 'zh' ? '多' : 'More'}</span>
          </div>
        </div>
      </div>

      {hoverStyle.opacity > 0 && hoverData && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full flex flex-col items-center"
          style={{
            left: hoverStyle.x,
            top: hoverStyle.y,
            transition: 'opacity 0.15s ease, transform 0.15s ease'
          }}
        >
          <div className="bg-zinc-900/95 dark:bg-zinc-100/95 backdrop-blur-sm text-zinc-50 dark:text-zinc-900 px-3 py-1.5 rounded-[8px] text-[12px] font-medium shadow-xl border border-white/10 dark:border-black/10 flex flex-col gap-0.5 min-w-max">
            <span className="opacity-80 text-[11px]">{hoverData.dateStr}</span>
            <span>
              {hoverData.count} {locale === 'zh' ? '次练习记录' : 'activities'}
            </span>
          </div>
          {/* Arrow */}
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-zinc-900/95 dark:border-t-zinc-100/95" />
        </div>
      )}
    </div>
  );
}

