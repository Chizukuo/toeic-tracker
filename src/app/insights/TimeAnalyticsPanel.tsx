'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import dynamic from 'next/dynamic';

const TimeWaterfallChart = dynamic(() => import('@/components/TimeWaterfallChart').then(mod => mod.TimeWaterfallChart), {
  ssr: false,
  loading: () => <div className="animate-pulse h-[400px] bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
});
import { cn } from '@/lib/utils';
import { TimerReset, Activity, ChevronRight } from 'lucide-react';
import { formatMinutes } from '@/lib/toeic';

export function TimeAnalyticsPanel() {
  const sessions = useStore((state) => state.sessions);
  const locale = useStore((state) => state.locale);
  
  const readingSessions = useMemo(() => sessions.filter(s => s.type === 'R'), [sessions]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(readingSessions[0]?.id ?? null);
  
  const selectedSession = useMemo(
    () => readingSessions.find((s) => s.id === selectedSessionId) ?? readingSessions[0],
    [readingSessions, selectedSessionId]
  );
  
  const hasHistory = readingSessions.length > 0;

  return (
    <motion.section 
      className="w-full max-w-6xl mx-auto space-y-6"
      variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
      initial="hidden" animate="show"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 bg-zinc-50 dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 p-4 rounded-[16px] shadow-sm">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500">
            <TimerReset className="size-5" />
          </div>
          <p className="text-[14px] font-medium text-zinc-700 dark:text-zinc-300 leading-snug">
            {locale === 'zh' 
              ? '时间分配分析基于《分段计时法》，对比不同题型的预算时间与实际用时。'
              : 'Time allocation analysis compares budgeted pacing with actual time spent per part.'}
          </p>
        </div>
      </div>
      
      {hasHistory ? (
        <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0 } } }} className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 px-1">
              {locale === 'zh' ? '阅读训练记录' : 'Reading History'}
            </h3>
            <div className="flex flex-col gap-2">
              {readingSessions.map(session => {
                const isActive = session.id === selectedSessionId || (!selectedSessionId && session.id === selectedSession?.id);
                const isOvertime = session.timerSummary?.timedOut;
                
                return (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-2xl border transition-all text-left group",
                      isActive 
                        ? "border-blue-500/30 bg-blue-50/80 dark:bg-blue-900/15 shadow-[0_2px_12px_rgba(59,130,246,0.08)]" 
                        : "border-black/5 dark:border-white/5 bg-white dark:bg-[#1C1C1E] hover:border-black/10 dark:hover:border-white/10 shadow-sm"
                    )}
                  >
                    <div className="flex flex-col gap-1 max-w-full min-w-0 pr-2">
                      <span className={cn(
                        "text-[15px] font-semibold truncate transition-colors",
                        isActive ? "text-blue-600 dark:text-blue-400" : "text-zinc-900 dark:text-zinc-50"
                      )}>
                        {session.label}
                      </span>
                      <div className="flex items-center gap-1.5 text-[13px]">
                        <span className={cn(
                          "font-medium tabular-nums",
                          isOvertime ? "text-red-500 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"
                        )}>
                          {formatMinutes(session.timerSummary?.totalElapsedMs ?? 0)}
                        </span>
                        {isOvertime && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-700">&middot;</span>
                            <span className="text-red-500 font-medium">Overtime</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      "size-4 shrink-0 transition-transform duration-200",
                      isActive 
                        ? "text-blue-500 translate-x-0.5" 
                        : "text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-400"
                    )} />
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="lg:col-span-3 min-h-[500px]">
             <AnimatePresence mode="wait">
               {selectedSession ? (
                 <motion.div
                   key={selectedSession.id}
                   initial={{ opacity: 0, x: 10, filter: 'blur(2px)' }}
                   animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                   exit={{ opacity: 0, x: -10, filter: 'blur(2px)' }}
                   transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                   className="h-full"
                 >
                   {/* Wrapping in the new unified visual style */}
                   <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] p-2 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/4 dark:border-white/4 h-full">
                      <TimeWaterfallChart session={selectedSession} />
                   </div>
                 </motion.div>
               ) : (
                 <motion.div 
                   key="empty"
                   initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                   className="flex h-full min-h-[400px] items-center justify-center rounded-[24px] border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#1C1C1E]/50"
                  >
                   <p className="text-sm font-medium text-zinc-400">Select a session to view analysis.</p>
                 </motion.div>
               )}
             </AnimatePresence>
          </div>
        </motion.div>
      ) : (
        <div className="flex h-[400px] w-full flex-col items-center justify-center rounded-[24px] border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#1C1C1E]/50">
          <Activity className="size-10 text-zinc-300 dark:text-zinc-700 mb-4" />
          <p className="text-sm font-medium text-zinc-500 mb-1">
            {locale === 'zh' ? '暂无阅读测验数据' : 'No reading sessions data'}
          </p>
          <p className="text-xs text-zinc-400">
            {locale === 'zh' ? '完成一次带分段计时的阅读模拟考以查看分析' : 'Complete a reading simulation with lap timer to view insights'}
          </p>
        </div>
      )}
    </motion.section>
  );
}