'use client';

import { useStore } from '@/store/useStore';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { motion } from 'framer-motion';

export function AchievementPanel() {
  const unlockedAchievements = useStore((state) => state.unlockedAchievements);
  const achievementUnlocks = useStore((state) => state.achievementUnlocks);
  const locale = useStore((state) => state.locale);

  if (unlockedAchievements.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 px-1">
        {locale === 'zh' ? '成就墙' : 'Achievements'}
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar max-h-[180px] p-0.5 -m-0.5">
        {[...unlockedAchievements].reverse().map((id, index) => {
          const achievement = ACHIEVEMENTS.find((a) => a.id === id);
          if (!achievement) return null;

          const unlockTime = achievementUnlocks?.[id];
          let timeText = locale === 'zh' ? '已获得' : 'Unlocked';
          
          if (unlockTime) {
            const date = new Date(unlockTime);
            timeText = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
              month: 'short',
              day: 'numeric',
            }).format(date);
          }

          return (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.08, type: 'spring', damping: 20, stiffness: 300 }}
              whileHover={{ scale: 1.015, y: -1 }}
              whileTap={{ scale: 0.98 }}
              key={id}
              className="group relative flex items-center gap-3 p-3 bg-white hover:bg-zinc-50/80 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/60 rounded-[16px] border border-zinc-200/60 dark:border-white/5 shrink-0 shadow-sm transition-colors cursor-default overflow-hidden"
            >
              {/* Shine effect on hover */}
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-black/[0.03] dark:via-white/[0.05] to-transparent skew-x-12" />

              <div className="relative flex items-center justify-center size-10 rounded-[12px] bg-gradient-to-b from-amber-50 to-amber-100 dark:from-zinc-800 dark:to-zinc-800 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)] border border-amber-200/50 dark:border-white/10 text-xl font-bold shrink-0 text-amber-600 group-hover:scale-110 transition-transform duration-300">
                {achievement.icon}
              </div>
              <div className="flex flex-col flex-1 min-w-0 z-10">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {achievement.title[locale]}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                  {achievement.desc[locale]}
                </span>
              </div>
              <div className="shrink-0 text-[10px] font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-full whitespace-nowrap z-10 shadow-sm border border-amber-200/30 dark:border-amber-500/20">
                {timeText}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
