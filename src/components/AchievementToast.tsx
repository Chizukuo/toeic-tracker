'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { ACHIEVEMENTS } from '@/lib/achievements';

export function AchievementToast() {
  const justUnlocked = useStore((state) => state.justUnlocked);
  const dismissAchievement = useStore((state) => state.dismissAchievement);
  const locale = useStore((state) => state.locale);
  
  const [activeToast, setActiveToast] = useState<typeof ACHIEVEMENTS[0] | null>(null);

  useEffect(() => {
    if (justUnlocked.length > 0 && !activeToast) {
      const nextId = justUnlocked[0];
      const detail = ACHIEVEMENTS.find(a => a.id === nextId);
      if (detail) {
        setActiveToast(detail);
      } else {
        // cleanup invalid ids
        dismissAchievement(nextId);
      }
    }
  }, [justUnlocked, activeToast, dismissAchievement]);

  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        dismissAchievement(activeToast.id);
        setActiveToast(null);
      }, 5000); // show for 5 seconds
      return () => clearTimeout(timer);
    }
  }, [activeToast, dismissAchievement]);

  return (
    <AnimatePresence>
      {activeToast && (
        <motion.div
          key={activeToast.id}
          initial={{ y: -100, opacity: 0, scale: 0.9 }}
          animate={{ y: 24, opacity: 1, scale: 1 }}
          exit={{ y: -100, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300, bounce: 0 }}
          className="fixed top-0 inset-x-0 mx-auto w-max max-w-[90vw] z-[100] pointer-events-auto"
        >
          <div className="bg-zinc-900/80 dark:bg-white/80 backdrop-blur-2xl border border-white/10 dark:border-black/5 shadow-2xl rounded-full p-2 pr-6 flex items-center gap-4 cursor-default overflow-hidden relative">
            {/* Shimmer Effect */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 dark:via-black/5 to-transparent skew-x-12" />
            
            <div className="relative z-10 flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 dark:bg-amber-500/10 dark:text-amber-600 border border-amber-500/30">
              <span className="text-xl leading-none drop-shadow-sm">{activeToast.icon}</span>
            </div>
            <div className="relative z-10 flex flex-col">
              <span className="text-[10px] font-bold text-amber-500/90 uppercase tracking-widest leading-none mb-1">
                {locale === 'zh' ? '达成成就' : 'Achievement Unlocked'}
              </span>
              <span className="text-[14px] font-semibold text-white dark:text-zinc-900 leading-none truncate max-w-[200px] sm:max-w-xs">
                {activeToast.title[locale]}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
