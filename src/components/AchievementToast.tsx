'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { ACHIEVEMENTS } from '@/lib/achievements';

function ParticleBurst() {
  const [particles] = useState(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      angle: (i * 360) / 12,
      delay: Math.random() * 0.15,
      distance: 50 + Math.random() * 40,
    }));
  });

  return (
    <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center">
      {particles.map(({ angle, delay, distance }, i) => {
        return (
          <motion.div
            key={i}
            initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
            animate={{
              opacity: 0,
              scale: [0, 1.5, 0],
              x: Math.cos((angle * Math.PI) / 180) * distance,
              y: Math.sin((angle * Math.PI) / 180) * distance,
            }}
            transition={{
              duration: 0.8,
              delay,
              ease: 'easeOut',
            }}
            className="absolute size-1.5 md:size-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
          />
        );
      })}
    </div>
  );
}

export function AchievementToast() {
  const justUnlocked = useStore((state) => state.justUnlocked);
  const dismissAchievement = useStore((state) => state.dismissAchievement);
  const locale = useStore((state) => state.locale);

  const activeToast = useMemo(() => {
    const nextId = justUnlocked[0];
    if (!nextId) return null;
    return ACHIEVEMENTS.find((item) => item.id === nextId) ?? null;
  }, [justUnlocked]);

  useEffect(() => {
    if (justUnlocked.length === 0) {
      return;
    }

    if (!activeToast) {
      dismissAchievement(justUnlocked[0]);
      return;
    }

    // Trigger haptic feedback for physical dopamine hit (supported on Android and some web environments)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([15, 60, 20]);
    }

    const timer = window.setTimeout(() => {
      dismissAchievement(activeToast.id);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [activeToast, dismissAchievement, justUnlocked]);

  return (
    <AnimatePresence>
      {activeToast && (
        <motion.div
          key={activeToast.id}
          initial={{ y: -120, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -100, opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
          transition={{ type: 'spring', damping: 14, stiffness: 350 }}
          className="fixed top-0 mt-[calc(env(safe-area-inset-top,16px)+16px)] inset-x-0 mx-auto w-max max-w-[92vw] sm:max-w-md z-[100] pointer-events-auto flex justify-center"
        >
          <ParticleBurst />
          <div className="bg-zinc-900/90 dark:bg-white/95 backdrop-blur-3xl border border-amber-500/20 shadow-[0_16px_50px_-12px_rgba(245,158,11,0.4)] rounded-full p-2 pr-6 flex items-center gap-4 cursor-default overflow-hidden relative">
            {/* Glossy highlight line */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent dark:from-white/50 opacity-20 pointer-events-none rounded-full" />
            
            {/* Shimmer Effect */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-amber-200/10 dark:via-black/5 to-transparent skew-x-12" />
            
            <motion.div 
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: 'spring', damping: 10, stiffness: 400 }}
              className="relative z-10 flex size-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[inset_0_-2px_6px_rgba(0,0,0,0.2)] border border-amber-500/50"
            >
              <span className="text-2xl leading-none drop-shadow-md">{activeToast.icon}</span>
            </motion.div>
            
            <div className="relative z-10 flex flex-col pt-1 pb-1">
              <motion.span 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="text-[10px] font-extrabold text-amber-500 dark:text-amber-600 uppercase tracking-widest leading-none mb-1.5"
              >
                {locale === 'zh' ? '达成成就' : 'Achievement Unlocked'}
              </motion.span>
              <motion.span 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="text-[15px] font-bold text-white dark:text-zinc-900 leading-none truncate max-w-[200px] sm:max-w-xs drop-shadow-xs"
              >
                {activeToast.title[locale]}
              </motion.span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
