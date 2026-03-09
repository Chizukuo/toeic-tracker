'use client';

import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";
import { LapTimer } from "@/components/LapTimer";
import { TimeWaterfallChart } from "@/components/TimeWaterfallChart";

export default function Home() {
  const { records, initRecords } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (records.length === 0) {
      initRecords();
    }
  }, [records, initRecords]);

  // Demo data fetching for Day 1 Reading
  const demoRecord = records.find(r => r.day === 1 && r.type === 'R');

  if (!mounted) return null;

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto font-sans selection:bg-amber-400/30">
      <header className="mb-12 border-b border-zinc-800 pb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 flex items-center gap-3">
            <div className="w-4 h-4 bg-amber-400 rounded-sm rotate-12"></div>
            Cheese TOEIC Tracker
          </h1>
          <p className="text-zinc-500 mt-2 font-mono text-sm">20-DAY SPRINT // ROOT_ACCESS_GRANTED</p>
        </div>
        <div className="text-right flex flex-col items-end">
           <div className="text-2xl font-mono font-bold text-amber-400">DAY 01</div>
           <div className="text-xs text-zinc-600 font-mono tracking-widest mt-1">HACK THE EXAM</div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-lg font-semibold text-zinc-300 mb-4 flex items-center gap-2">
            <span className="text-amber-400 font-mono text-sm">01_</span> STRICT TIMER ENGINE
          </h2>
          <LapTimer day={1} type="R" />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-300 mb-4 flex items-center gap-2">
            <span className="text-amber-400 font-mono text-sm">02_</span> TIME PROFILING (READING)
          </h2>
          {demoRecord && <TimeWaterfallChart record={demoRecord} />}
          {(!demoRecord || !demoRecord.laps || demoRecord.laps.length === 0) && (
            <div className="h-64 border border-dashed border-zinc-800 rounded-xl flex items-center justify-center text-zinc-600 font-mono text-sm">
              NO LAP DATA COLLECTED YET. START TIMER TO PROFILE.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
