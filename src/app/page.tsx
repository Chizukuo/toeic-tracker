'use client';

import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";
import { LapTimer } from "@/components/LapTimer";
import { TimeWaterfallChart } from "@/components/TimeWaterfallChart";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SprintDashboard } from "@/components/SprintDashboard";
import { DebugForm } from "@/components/DebugForm";

export default function Home() {
  const { records, initRecords, activeDay, activeType } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (records.length === 0) {
      initRecords();
    }
  }, [records, initRecords]);

  // Derived state based on current selection
  const currentRecord = records.find(r => r.day === activeDay && r.type === activeType);

  if (!mounted) return null;

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto font-sans selection:bg-amber-400/30">
      <header className="mb-10 border-b border-zinc-200 dark:border-zinc-800 pb-6 flex items-baseline justify-between transition-colors">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
            <div className="w-4 h-4 bg-amber-400 rounded-sm rotate-12"></div>
            Cheese TOEIC Tracker
          </h1>
          <p className="text-zinc-500 mt-2 font-mono text-sm leading-relaxed">20-DAY SPRINT // ROOT_ACCESS_GRANTED</p>
        </div>
        <div className="text-right flex items-center gap-6">
           <ThemeToggle />
           <div className="text-right">
             <div className="text-2xl font-mono font-bold text-amber-500 dark:text-amber-400">DAY {activeDay.toString().padStart(2, '0')}</div>
             <div className="text-xs text-zinc-400 dark:text-zinc-500 font-mono tracking-widest mt-1">
               {activeType === 'L' ? 'LISTENING' : 'READING'}
             </div>
           </div>
        </div>
      </header>

      <SprintDashboard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-8">
          <div>
            <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-300 mb-4 flex items-center gap-2">
              <span className="text-amber-500 dark:text-amber-400 font-mono text-sm">01_</span> STRICT TIMER ENGINE
            </h2>
            <LapTimer key={`timer-${activeDay}-${activeType}`} day={activeDay} type={activeType} />
          </div>
          
          <div>
            <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-300 mb-4 flex items-center gap-2">
              <span className="text-amber-500 dark:text-amber-400 font-mono text-sm">02_</span> DATA ENTRY & DEBUG
            </h2>
            {currentRecord && (
              <DebugForm key={`form-${activeDay}-${activeType}`} activeRecord={currentRecord} />
            )}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-300 mb-4 flex items-center gap-2">
            <span className="text-amber-500 dark:text-amber-400 font-mono text-sm">03_</span> TIME PROFILING (READING)
          </h2>
          {currentRecord && currentRecord.type === 'R' ? (
             <TimeWaterfallChart key={`chart-${activeDay}-${activeType}`} record={currentRecord} />
          ) : (
             <div className="h-64 border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/10 rounded-xl flex items-center justify-center text-zinc-400 dark:text-zinc-600 font-mono text-sm text-center px-4">
              {currentRecord?.type === 'L' ? "TIME PROFILING IS FOR READING SECTIONS ONLY." : "NO LAP DATA COLLECTED YET. START TIMER TO PROFILE."}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
