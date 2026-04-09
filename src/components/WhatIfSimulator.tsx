'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCcw, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCopy, translatePart } from '@/lib/i18n';
import {
  LISTENING_PARTS,
  READING_PARTS,
  PART_QUESTION_COUNTS,
  estimateToeicSessionDualScore,
  type MistakeKey,
  type SessionRecord,
} from '@/lib/toeic';
import { useStore } from '@/store/useStore';

export function WhatIfSimulator({
  listeningSession,
  readingSession,
}: {
  listeningSession?: SessionRecord;
  readingSession?: SessionRecord;
}) {
  const locale = useStore((state) => state.locale);
  const targetScore = useStore((state) => state.targetScore);

  // Baseline mistakes from actual records (or 0 if none)
  const baselineListening = useMemo(() => {
    const m = listeningSession?.mistakes;
    return Object.fromEntries(LISTENING_PARTS.map((p) => [p, m?.[p] ?? 0])) as Record<MistakeKey, number>;
  }, [listeningSession]);

  const baselineReading = useMemo(() => {
    const m = readingSession?.mistakes;
    return Object.fromEntries(READING_PARTS.map((p) => [p, m?.[p] ?? 0])) as Record<MistakeKey, number>;
  }, [readingSession]);

  // Simulated mistakes
  const [simListening, setSimListening] = useState<Record<MistakeKey, number>>(baselineListening);
  const [simReading, setSimReading] = useState<Record<MistakeKey, number>>(baselineReading);

  const resetSimulation = () => {
    setSimListening(baselineListening);
    setSimReading(baselineReading);
  };

  const isDirty = useMemo(() => {
    return (
      LISTENING_PARTS.some((p) => simListening[p] !== baselineListening[p]) ||
      READING_PARTS.some((p) => simReading[p] !== baselineReading[p])
    );
  }, [simListening, simReading, baselineListening, baselineReading]);

  // Calculate baseline scores
  const baselineScores = useMemo(() => {
    const L = listeningSession ? estimateToeicSessionDualScore(listeningSession).strict.scaled : 0;
    const R = readingSession ? estimateToeicSessionDualScore(readingSession).strict.scaled : 0;
    return { L, R, T: L + R };
  }, [listeningSession, readingSession]);

  // Calculate simulated scores using dummy sessions
  const simScores = useMemo(() => {
    const dummyL = {
      ...listeningSession,
      status: 'debugged',
      type: 'L',
      mistakes: simListening,
    } as SessionRecord;
    const dummyR = {
      ...readingSession,
      status: 'debugged',
      type: 'R',
      mistakes: simReading,
    } as SessionRecord;

    const L = estimateToeicSessionDualScore(dummyL).strict.scaled;
    const R = estimateToeicSessionDualScore(dummyR).strict.scaled;
    return { L, R, T: L + R };
  }, [listeningSession, readingSession, simListening, simReading]);

  const handleSliderChange = (part: MistakeKey, value: number, type: 'L' | 'R') => {
    if (type === 'L') {
      setSimListening({ ...simListening, [part]: value });
    } else {
      setSimReading({ ...simReading, [part]: value });
    }
  };

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none border border-black/4 dark:border-white/4 overflow-hidden">
      <div className="p-6 border-b border-black/4 dark:border-white/4 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-amber-500" />
            <h3 className="text-[18px] font-bold text-zinc-900 dark:text-zinc-50">
              {locale === 'zh' ? 'What-If 提分模拟器' : 'What-If Simulator'}
            </h3>
          </div>
          <p className="mt-1 text-[13px] text-zinc-500">
            {locale === 'zh'
              ? '如果你在某些重点题型少错几题，总分能提升多少？'
              : 'How much higher would you score if you made fewer mistakes in key sections?'}
          </p>
        </div>
        <div className="flex items-center gap-4 bg-white dark:bg-[#2C2C2E] p-3 rounded-2xl shadow-sm border border-black/5 dark:border-white/5">
          <div className="flex flex-col items-end">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">{locale === 'zh' ? '当前' : 'Current'}</span>
            <span className="text-[20px] font-bold text-zinc-500 line-through decoration-rose-500/50 decoration-2">{baselineScores.T}</span>
          </div>
          <ArrowRight className="size-5 text-zinc-300 dark:text-zinc-600" />
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-amber-500 uppercase tracking-widest">{locale === 'zh' ? '模拟总分' : 'Simulated'}</span>
            <span className={cn(
              "text-[28px] font-bold leading-none",
              simScores.T >= targetScore ? "text-emerald-500" : "text-zinc-900 dark:text-zinc-50"
            )}>
              {simScores.T}
            </span>
          </div>
          {isDirty && (
            <button onClick={resetSimulation} className="p-2 ml-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
              <RefreshCcw className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 grid lg:grid-cols-2 gap-8 lg:gap-12">
        <SliderGroup title={locale === 'zh' ? '听力' : 'Listening'} parts={LISTENING_PARTS} state={simListening} baseline={baselineListening} onChange={(p, v) => handleSliderChange(p, v, 'L')} locale={locale} />
        <SliderGroup title={locale === 'zh' ? '阅读' : 'Reading'} parts={READING_PARTS} state={simReading} baseline={baselineReading} onChange={(p, v) => handleSliderChange(p, v, 'R')} locale={locale} />
      </div>
    </div>
  );
}

function SliderGroup({
  title,
  parts,
  state,
  baseline,
  onChange,
  locale,
}: {
  title: string;
  parts: readonly MistakeKey[];
  state: Record<MistakeKey, number>;
  baseline: Record<MistakeKey, number>;
  onChange: (part: MistakeKey, val: number) => void;
  locale: 'zh' | 'en';
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-[14px] font-bold tracking-wider text-zinc-400 uppercase">{title}</h4>
      <div className="space-y-5">
        {parts.map((part) => {
          const max = PART_QUESTION_COUNTS[part];
          const val = state[part];
          const base = baseline[part];
          const isImproved = val < base;

          return (
            <div key={part} className="group relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">{translatePart(locale, part)}</span>
                <div className="text-[13px] font-mono">
                  <span className={isImproved ? "text-emerald-500 font-bold" : "text-zinc-500"}>
                    {val}
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-600"> / {max} err</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max={max}
                value={val}
                onChange={(e) => onChange(part, Number(e.target.value))}
                className={cn(
                  "w-full h-1.5 rounded-full appearance-none bg-zinc-100 dark:bg-zinc-800 outline-none transition-all",
                  "accent-amber-500 hover:accent-amber-400 cursor-grab active:cursor-grabbing",
                  isImproved && "accent-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
                )}
                style={{
                  background: isImproved 
                    ? `linear-gradient(to right, #10b981 ${(val / max) * 100}%, transparent ${(val / max) * 100}%)`
                    : `linear-gradient(to right, #f59e0b ${(val / max) * 100}%, transparent ${(val / max) * 100}%)`
                }}
              />
              <style jsx>{`
                input[type='range']::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background: currentColor;
                  border: 2px solid white;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  transition: transform 0.1s;
                }
                input[type='range']:active::-webkit-slider-thumb {
                  transform: scale(1.2);
                }
              `}</style>
            </div>
          );
        })}
      </div>
    </div>
  );
}
