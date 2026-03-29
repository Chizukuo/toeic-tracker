'use client';

import { startTransition, useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceArea,
} from 'recharts';
import {
  CircleGauge,
  Headphones,
  LibraryBig,
  Sigma,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getCopy, translatePart } from '@/lib/i18n';
import {
  estimateToeicCombinedDualScore,
  estimateToeicSessionDualScore,
  getCombinedDataConfidence,
  getCombinedEstimateBand,
  getSessionDataConfidence,
  getSectionEstimateBand,
  type DataConfidence,
  type SessionRecord,
  type ToeicCefrLevel,
  type ToeicCombinedEstimate,
  type ToeicSectionEstimate,
} from '@/lib/toeic';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { WhatIfSimulator } from '@/components/WhatIfSimulator';

type ScoreMode = 'L' | 'R' | 'T';

type ScoreTrendPoint = {
  label: string;
  score?: number;
  potentialScore?: number;
  rawCorrect?: number;
  adjustedRaw?: number;
  active: boolean;
};

type HistoricalTrendPoint = {
  id: string;
  label: string;
  listening: number;
  reading: number;
  total: number;
  fullDate: string;
  source: 'manual' | 'estimated';
  note?: string;
};

type PartBreakdownItem = {
  label: string;
  mistakes: number;
  rate: number;
  share: number;
};

type ActiveSummary = {
  title: string;
  score: number;
  rawCorrect: number;
  adjustedRawCorrect: number;
  mistakes: number;
  accuracy: number;
  band: string;
  interval: string;
  cefr: string;
  available: boolean;
  chart: ScoreTrendPoint[];
  color: string;
  scaleLabel: string;
  penaltyRaw: number;
  confidence: ConfidenceSummary;
  insights: string[];
  partBreakdown: PartBreakdownItem[];
  breakdownCards: Array<{
    label: string;
    score: number;
    interval: string;
    cefr: string;
  }>;
};

type ConfidenceSummary = {
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'coral';
};

export function ScoreEstimatorPanel() {
  const sessions = useStore((state) => state.sessions);
  const locale = useStore((state) => state.locale);
  const historicalScores = useStore((state) => state.historicalScores);
  const targetScore = useStore((state) => state.targetScore);
  const setTargetScore = useStore((state) => state.setTargetScore);
  const addHistoricalScore = useStore((state) => state.addHistoricalScore);
  const removeHistoricalScore = useStore((state) => state.removeHistoricalScore);
  const copy = getCopy(locale);

  const [mode, setMode] = useState<ScoreMode>('T');
  const [selectedPair, setSelectedPair] = useState('1');
  const [chartView, setChartView] = useState<'estimated' | 'official'>('estimated');
  const [historyDate, setHistoryDate] = useState('');
  const [historyListening, setHistoryListening] = useState('350');
  const [historyReading, setHistoryReading] = useState('330');
  
  const deferredSessions = useDeferredValue(sessions);
  const deferredHistoricalScores = useDeferredValue(historicalScores);

  const { dualEstimateMap, listeningSessions, readingSessions, sessionMap } = useMemo(() => {
    const nextSessionMap = new Map(deferredSessions.map((session) => [session.id, session]));
    const nextEstimateMap = new Map(deferredSessions.map((session) => [session.id, estimateToeicSessionDualScore(session)]));

    return {
      sessionMap: nextSessionMap,
      dualEstimateMap: nextEstimateMap,
      listeningSessions: deferredSessions.filter((session) => session.type === 'L'),
      readingSessions: deferredSessions.filter((session) => session.type === 'R'),
    };
  }, [deferredSessions]);

  const selectedListeningId = `L${selectedPair}`;
  const selectedReadingId = `R${selectedPair}`;
  const selectedListening = sessionMap.get(selectedListeningId) ?? listeningSessions[0];
  const selectedReading = sessionMap.get(selectedReadingId) ?? readingSessions[0];
  const selectedPairListening = sessionMap.get(`L${selectedPair}`) ?? listeningSessions[0];
  const selectedPairReading = sessionMap.get(`R${selectedPair}`) ?? readingSessions[0];

  const listeningEstimate = selectedListening ? dualEstimateMap.get(selectedListening.id)?.strict : undefined;
  const readingEstimate = selectedReading ? dualEstimateMap.get(selectedReading.id)?.strict : undefined;
  const pairEstimate = useMemo(
    () => estimateToeicCombinedDualScore(selectedPairListening, selectedPairReading),
    [selectedPairListening, selectedPairReading]
  );
  const pairStrictEstimate = pairEstimate.strict;

  const listeningTrend = useMemo(
    () =>
      listeningSessions.map((session) => {
        const estimate = dualEstimateMap.get(session.id);
        return {
          label: session.label,
          score: estimate?.strict.available ? estimate.strict.scaled : undefined,
          potentialScore: estimate?.potential.available ? estimate.potential.scaled : undefined,
          rawCorrect: estimate?.strict.available ? estimate.strict.rawCorrect : undefined,
          adjustedRaw: estimate?.strict.available ? estimate.strict.adjustedRawCorrect : undefined,
          active: session.id === selectedListeningId,
        };
      }),
    [dualEstimateMap, listeningSessions, selectedListeningId]
  );

  const readingTrend = useMemo(
    () =>
      readingSessions.map((session) => {
        const estimate = dualEstimateMap.get(session.id);
        return {
          label: session.label,
          score: estimate?.strict.available ? estimate.strict.scaled : undefined,
          potentialScore: estimate?.potential.available ? estimate.potential.scaled : undefined,
          rawCorrect: estimate?.strict.available ? estimate.strict.rawCorrect : undefined,
          adjustedRaw: estimate?.strict.available ? estimate.strict.adjustedRawCorrect : undefined,
          active: session.id === selectedReadingId,
        };
      }),
    [dualEstimateMap, readingSessions, selectedReadingId]
  );

  const totalTrend = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => {
        const pair = `${index + 1}`;
        const listening = sessionMap.get(`L${pair}`);
        const reading = sessionMap.get(`R${pair}`);
        const estimateCombined = estimateToeicCombinedDualScore(listening, reading);
        const estimate = estimateCombined.strict;

        return {
          label: `S${pair}`,
          score: estimate.available ? estimate.total : undefined,
          potentialScore: estimateCombined.potential.available ? estimateCombined.potential.total : undefined,
          rawCorrect: estimate.available ? estimate.rawCorrect : undefined,
          adjustedRaw: estimate.available ? estimate.adjustedRawCorrect : undefined,
          active: selectedPair === pair,
        };
      }),
    [selectedPair, sessionMap]
  );

  const historicalTrend = useMemo<HistoricalTrendPoint[]>(() => {
    return deferredHistoricalScores.map((item) => ({
      id: item.id,
      label: formatShortDate(item.date, locale),
      listening: item.listening,
      reading: item.reading,
      total: item.total,
      fullDate: item.date,
      source: item.source,
      note: item.note,
    }));
  }, [deferredHistoricalScores, locale]);

  const manualTotalPreview = safeNumber(historyListening) + safeNumber(historyReading);

  const activeSummary = useMemo<ActiveSummary | null>(() => {
    if (mode === 'L' && selectedListening && listeningEstimate) {
      return buildSectionSummary({
        record: selectedListening,
        estimate: listeningEstimate,
        locale,
        title: `${copy.scoreListeningLabel} · Set ${selectedPair}`,
        chart: listeningTrend,
        color: '#f59e0b',
        label: copy.scoreListeningLabel,
      });
    }

    if (mode === 'R' && selectedReading && readingEstimate) {
      return buildSectionSummary({
        record: selectedReading,
        estimate: readingEstimate,
        locale,
        title: `${copy.scoreReadingLabel} · Set ${selectedPair}`,
        chart: readingTrend,
        color: '#38bdf8',
        label: copy.scoreReadingLabel,
      });
    }

    if (selectedPairListening && selectedPairReading) {
      return buildTotalSummary({
        estimate: pairStrictEstimate,
        listeningRecord: selectedPairListening,
        readingRecord: selectedPairReading,
        locale,
        title: `${locale === 'zh' ? '总成绩' : 'Total Score'} · Set ${selectedPair}`,
        chart: totalTrend,
        color: '#ef4444',
        label: copy.scoreTotalLabel,
      });
    }

    return null;
  }, [
    copy.scoreListeningLabel,
    copy.scoreReadingLabel,
    copy.scoreTotalLabel,
    listeningEstimate,
    listeningTrend,
    locale,
    mode,
    pairStrictEstimate,
    readingEstimate,
    readingTrend,
    selectedListening,
    selectedPair,
    selectedPairListening,
    selectedPairReading,
    selectedReading,
    totalTrend,
  ]);

  function handleAddHistoricalScore() {
    if (!historyDate) {
      return;
    }
    startTransition(() => {
      addHistoricalScore({
        date: historyDate,
        listening: safeNumber(historyListening),
        reading: safeNumber(historyReading),
        total: manualTotalPreview,
        source: 'manual',
      });
    });
    setHistoryDate('');
  }

  function handleAutoAddEstimatedScore() {
    if (!pairStrictEstimate.available || !pairStrictEstimate.listening || !pairStrictEstimate.reading) return;
    startTransition(() => {
      addHistoricalScore({
        date: historyDate || getTodayDateLocal(),
        listening: pairStrictEstimate.listening!.scaled,
        reading: pairStrictEstimate.reading!.scaled,
        total: pairStrictEstimate.total,
        source: 'estimated',
        note: `Set ${selectedPair}`,
      });
    });
    setHistoryDate('');
  }

  const canAutoRecordEstimate = mode === 'T' && pairStrictEstimate.available;

  return (
    <motion.div 
      className="w-full space-y-6"
      variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
      initial="hidden" animate="show"
    >
      {/* ── Segmented Control & Selector ── */}
      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0 } } }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex bg-zinc-100/80 dark:bg-[#1C1C1E] p-1 rounded-[14px] shadow-sm border border-black/5 dark:border-white/5">
          <SegmentButton active={mode === 'L'} label={locale === 'zh' ? '听力' : 'Listening'} icon={<Headphones className="size-4" />} onClick={() => setMode('L')} />
          <SegmentButton active={mode === 'R'} label={locale === 'zh' ? '阅读' : 'Reading'} icon={<LibraryBig className="size-4" />} onClick={() => setMode('R')} />
          <SegmentButton active={mode === 'T'} label={locale === 'zh' ? '总分' : 'Total'} icon={<Sigma className="size-4" />} onClick={() => setMode('T')} />
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-medium text-zinc-500">{locale === 'zh' ? '测验套次' : 'Test Set'}</span>
          <select 
            value={selectedPair} 
            onChange={(e) => setSelectedPair(e.target.value)}
            className="h-9 px-3 rounded-[10px] bg-white dark:bg-[#2C2C2E] border border-black/5 dark:border-white/10 text-[14px] font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-sm transition-shadow"
          >
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={`${i + 1}`}>Set {i + 1}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* ── Hero: Score Display ── */}
      {!activeSummary || !activeSummary.available ? (
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1, transition: { type: 'spring', bounce: 0 } } }} className="flex flex-col items-center justify-center py-10 text-center rounded-[24px] bg-white dark:bg-[#1C1C1E] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-black/[0.04] dark:border-white/[0.04]">
          <CircleGauge className="size-8 text-zinc-300 dark:text-zinc-600 mb-3" />
          <p className="max-w-xs text-[14px] font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {locale === 'zh'
              ? '完成练习并记录数据后，系统将为您生成准确的分数预估。'
              : 'Complete a test run to unlock your score estimate.'}
          </p>
        </motion.div>
      ) : (
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1, transition: { type: 'spring', bounce: 0 } } }} className="rounded-[24px] bg-white dark:bg-[#1C1C1E] shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none border border-black/[0.04] dark:border-white/[0.04] p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left shrink-0">
            <span className="text-[12px] font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase mb-1">
              {activeSummary.title}
            </span>
            <div className="flex items-baseline gap-4">
              <span className="text-[64px] md:text-[72px] font-bold tracking-tighter text-zinc-900 dark:text-zinc-50 leading-none">
                {activeSummary.score}
              </span>
              {mode === 'T' && (
                <div className="flex flex-col gap-1 hidden md:flex">
                  <span className="text-[12px] font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                    <Target className="size-3" />
                    {locale === 'zh' ? '目标分' : 'Target'}
                  </span>
                  <input
                    type="number"
                    min="10" max="990" step="5"
                    value={targetScore}
                    onChange={(e) => setTargetScore(Number(e.target.value) || 850)}
                    className="w-[72px] bg-transparent text-[24px] font-bold text-zinc-300 dark:text-zinc-600 focus:text-amber-500 focus:outline-none transition-colors border-b border-transparent focus:border-amber-500/30"
                  />
                </div>
              )}
            </div>
            
            <div className="mt-3 flex flex-wrap items-center justify-center md:justify-start gap-2">
              {mode === 'T' && (
                <span className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold border",
                  activeSummary.score >= targetScore
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                    : "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400"
                )}>
                  {activeSummary.score >= targetScore
                    ? (locale === 'zh' ? `已达标 (+${activeSummary.score - targetScore})` : `Target Met (+${activeSummary.score - targetScore})`)
                    : (locale === 'zh' ? `距目标分 ${targetScore - activeSummary.score}` : `Gap to Target: ${targetScore - activeSummary.score}`)}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-md bg-zinc-50 dark:bg-[#2C2C2E] text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                {locale === 'zh' ? '波动' : 'Range'} {activeSummary.interval}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-zinc-50 dark:bg-[#2C2C2E] text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                CEFR {activeSummary.cefr}
              </span>
              <span className={cn('px-2.5 py-1 rounded-md text-[11px] font-medium', confidenceBadgeClassName(activeSummary.confidence.tone))}>
                {activeSummary.confidence.label}
              </span>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-4 gap-2 w-full md:w-auto md:flex-1 max-w-lg">
            <MetricBox label={copy.scoreRawCorrect} value={`${activeSummary.rawCorrect}${mode === 'T' ? '/200' : '/100'}`} />
            <MetricBox label={locale === 'zh' ? '调整分' : 'Adj.'} value={`${activeSummary.adjustedRawCorrect}`} />
            <MetricBox label={copy.scoreMistakes} value={`${activeSummary.mistakes}`} />
            <MetricBox label={copy.scoreAccuracy} value={`${activeSummary.accuracy}%`} />
          </div>
        </motion.div>
      )}

      {/* ── Sub-Sections ── */}
      {activeSummary?.available && (
        <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0 } } }} className="grid md:grid-cols-2 gap-6">
          {/* Section Breakdown if Total Mode */}
          {mode === 'T' && activeSummary.breakdownCards.length > 1 && (
            <div className="md:col-span-2 grid sm:grid-cols-3 gap-4">
              {activeSummary.breakdownCards.map((item) => (
                <div key={item.label} className="bg-white dark:bg-[#1C1C1E] rounded-[24px] p-6 shadow-sm border border-black/[0.04] dark:border-white/[0.04]">
                  <div className="text-[12px] font-semibold text-zinc-400 uppercase tracking-widest">{item.label}</div>
                  <div className="mt-2 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{item.score}</div>
                  <div className="mt-3 flex gap-2 text-[12px] font-medium text-zinc-500">
                    <span className="bg-zinc-50 dark:bg-[#2C2C2E] px-2 py-1 rounded-md">CEFR {item.cefr}</span>
                    <span className="bg-zinc-50 dark:bg-[#2C2C2E] px-2 py-1 rounded-md">{item.interval}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Diagnostic Insights */}
          <div className={cn("bg-white dark:bg-[#1C1C1E] rounded-[28px] p-8 shadow-sm border border-black/[0.04] dark:border-white/[0.04]", mode !== 'T' ? 'md:col-span-1' : 'md:col-span-1')}>
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="size-5 text-amber-500" />
              <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50">{locale === 'zh' ? '诊断与建议' : 'Diagnosis'}</h3>
            </div>
            <div className="space-y-4">
              {activeSummary.insights.map((item, index) => (
                <p key={index} className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {item}
                </p>
              ))}
            </div>
          </div>

          {/* Error Distribution List */}
          <div className={cn("bg-white dark:bg-[#1C1C1E] rounded-[28px] p-8 shadow-sm border border-black/[0.04] dark:border-white/[0.04]", mode !== 'T' ? 'md:col-span-1' : 'md:col-span-1')}>
            <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50 mb-5">{locale === 'zh' ? '失分分布' : 'Loss Distribution'}</h3>
            <div className="flex flex-col rounded-[16px] bg-zinc-50/80 dark:bg-[#2C2C2E]/80 overflow-hidden">
              {activeSummary.partBreakdown.map((item, index) => (
                <div key={item.label} className={cn(
                  "flex items-center gap-4 p-4",
                  index !== activeSummary.partBreakdown.length - 1 && "border-b border-black/[0.04] dark:border-white/[0.04]"
                )}>
                  <div className="flex-1">
                    <div className="flex justify-between text-[14px] mb-2">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">{item.label}</span>
                      <span className="font-medium text-zinc-500">{(item.rate * 100).toFixed(0)}% err</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full" style={{ width: `${Math.max(item.rate * 100, 3)}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0 min-w-[32px]">
                    <span className="text-[17px] font-bold text-zinc-900 dark:text-zinc-50">{item.mistakes}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Simulator (Total Mode Only) */}
      {mode === 'T' && activeSummary?.available && (
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1, transition: { type: 'spring', bounce: 0 } } }}>
          <WhatIfSimulator listeningSession={selectedPairListening} readingSession={selectedPairReading} />
        </motion.div>
      )}

      {/* ── Charts & History Section ── */}
      <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0 } } }} className="bg-white dark:bg-[#1C1C1E] rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none border border-black/[0.04] dark:border-white/[0.04] flex flex-col lg:flex-row overflow-hidden">
        {/* Trend Chart */}
        <div className="flex-1 p-6 lg:p-10 flex flex-col border-b lg:border-b-0 lg:border-r border-black/[0.04] dark:border-white/[0.04]">
          <div className="mb-8">
            <h3 className="text-[20px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{locale === 'zh' ? '成绩走势' : 'Score Trend'}</h3>
            <p className="mt-1.5 text-[14px] text-zinc-500">
              {locale === 'zh' ? '预估分数与历史正式成绩记录对比' : 'Estimated scores vs historical official records'}
            </p>
          </div>
          
          <div className="flex-1 min-h-[320px]">
            {historicalTrend.length > 0 || (activeSummary && activeSummary.chart.length > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalTrend.length > 0 ? historicalTrend : activeSummary?.chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="currentColor" opacity={0.04} vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.4 }} dy={10} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.4 }} domain={['dataMin - 20', 'dataMax + 20']} dx={-10} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255, 255, 255, 0.85)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(0,0,0,0.06)',
                      borderRadius: '16px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                      fontSize: '13px',
                      color: '#18181b',
                      padding: '12px 16px'
                    }}
                    itemStyle={{ color: '#18181b', fontWeight: 600 }}
                  />
                  {(historicalTrend.length > 0 || mode === 'T') && (
                    <>
                      <ReferenceArea y1={120} y2={220} fill="#f43f5e" fillOpacity={0.03} />
                      <ReferenceArea y1={225} y2={545} fill="#f97316" fillOpacity={0.03} />
                      <ReferenceArea y1={550} y2={780} fill="#eab308" fillOpacity={0.03} />
                      <ReferenceArea y1={785} y2={940} fill="#22c55e" fillOpacity={0.03} />
                      <ReferenceArea y1={945} y2={990} fill="#3b82f6" fillOpacity={0.03} />
                    </>
                  )}
                  {historicalTrend.length > 0 ? (
                    <>
                      <Line key="total" type="monotone" dataKey="total" name={locale === 'zh' ? '总分' : 'Total'} stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 7, strokeWidth: 0 }} />
                      <Line key="listening" type="monotone" dataKey="listening" name={locale === 'zh' ? '听力' : 'Listening'} stroke="#f59e0b" strokeWidth={2.5} strokeOpacity={0.6} dot={false} />
                      <Line key="reading" type="monotone" dataKey="reading" name={locale === 'zh' ? '阅读' : 'Reading'} stroke="#38bdf8" strokeWidth={2.5} strokeOpacity={0.6} dot={false} />
                    </>
                  ) : (
                    <>
                      <Line
                        key="active-score"
                        type="monotone"
                        dataKey="score"
                        name={mode === 'L' ? copy.scoreListeningLabel : mode === 'R' ? copy.scoreReadingLabel : copy.scoreTotalLabel}
                        stroke={activeSummary?.color || "#18181b"}
                        strokeWidth={3}
                        dot={(props) => {
                          const { cx, cy, payload, index } = props;
                          if (cx === undefined || cy === undefined || !payload) return <g key={`dot-empty-${index}`} />;
                          return <circle key={`dot-${payload.label}-${index}`} cx={cx} cy={cy} r={payload.active ? 7 : 4} fill={payload.active ? (activeSummary?.color || "#18181b") : '#fff'} stroke={activeSummary?.color || "#18181b"} strokeWidth={2} />;
                        }}
                      />
                      <Line
                        key="active-potential"
                        type="monotone"
                        dataKey="potentialScore"
                        name={locale === 'zh' ? '最高潜力' : 'Potential'}
                        stroke={activeSummary?.color || "#18181b"}
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        strokeOpacity={0.4}
                        dot={false}
                        activeDot={false}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[14px] text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/20 rounded-[20px] border border-dashed border-zinc-200 dark:border-zinc-800">
                {locale === 'zh' ? '暂无趋势数据，请添加记录' : 'No trend data yet, add a record'}
              </div>
            )}
          </div>
        </div>

        {/* History Data Vault */}
        <div className="w-full lg:w-[380px] bg-zinc-50/50 dark:bg-zinc-900/20 p-6 lg:p-10 flex flex-col gap-8">
          <div>
            <h3 className="text-[16px] font-semibold text-zinc-900 dark:text-zinc-50 mb-5 flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[12px]">+</span>
              {locale === 'zh' ? '记录正式成绩' : 'Add Official Record'}
            </h3>
            
            <div className="bg-white dark:bg-[#1C1C1E] rounded-[20px] overflow-hidden border border-black/[0.04] dark:border-white/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 dark:border-white/5">
                <span className="text-[14px] font-medium text-zinc-500 dark:text-zinc-400">{locale === 'zh' ? '日期' : 'Date'}</span>
                <input type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} className="bg-transparent text-right text-[14px] font-semibold text-zinc-900 dark:text-zinc-50 outline-none w-[130px] cursor-pointer" />
              </div>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 dark:border-white/5">
                <span className="text-[14px] font-medium text-zinc-500 dark:text-zinc-400">Listening</span>
                <input type="number" min="5" max="495" step="5" value={historyListening} onChange={(e) => setHistoryListening(e.target.value)} className="w-16 bg-transparent text-right text-[15px] font-semibold text-zinc-900 dark:text-zinc-50 outline-none" placeholder="0" />
              </div>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 dark:border-white/5">
                <span className="text-[14px] font-medium text-zinc-500 dark:text-zinc-400">Reading</span>
                <input type="number" min="5" max="495" step="5" value={historyReading} onChange={(e) => setHistoryReading(e.target.value)} className="w-16 bg-transparent text-right text-[15px] font-semibold text-zinc-900 dark:text-zinc-50 outline-none" placeholder="0" />
              </div>
              <div className="flex items-center justify-between px-5 py-4 bg-zinc-50/80 dark:bg-[#2C2C2E]/80">
                <span className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">{locale === 'zh' ? '总分预览' : 'Total Preview'}</span>
                <span className="text-[18px] font-bold text-zinc-900 dark:text-zinc-50">{manualTotalPreview}</span>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <Button onClick={handleAddHistoricalScore} className="w-full rounded-[14px] bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 h-11 font-medium shadow-sm transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96]">
                {locale === 'zh' ? '保存至成绩单' : 'Save to Vault'}
              </Button>
              {canAutoRecordEstimate && (
                <Button variant="outline" onClick={handleAutoAddEstimatedScore} className="w-full rounded-[14px] border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1C1C1E] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 h-11 font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96]">
                  {locale === 'zh' ? '快捷保存当前估分' : 'Quick Save Estimate'}
                </Button>
              )}
            </div>
          </div>

          {/* History List */}
          {deferredHistoricalScores.length > 0 && (
            <div className="flex-1">
              <h3 className="text-[13px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4">
                {locale === 'zh' ? '历史记录' : 'History Log'}
              </h3>
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2 no-scrollbar">
                {[...deferredHistoricalScores].reverse().map((item) => (
                  <div key={item.id} className="flex items-center justify-between group bg-white dark:bg-[#1C1C1E] p-4 rounded-[16px] border border-black/[0.04] dark:border-white/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                    <div>
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-[20px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{item.total}</span>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                          item.source === 'estimated' 
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" 
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                        )}>
                          {item.source === 'estimated' ? 'EST' : 'MAN'}
                        </span>
                      </div>
                      <div className="text-[13px] text-zinc-500 mt-1 font-medium flex gap-2">
                        <span>{item.date}</span>
                        <span>·</span>
                        <span>L{item.listening} R{item.reading}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => startTransition(() => removeHistoricalScore(item.id))}
                      className="p-2.5 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* --- Sub Components --- */

function SegmentButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-[10px] transition-all duration-200',
        active
          ? 'bg-white text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.1)] dark:bg-[#3A3A3C] dark:text-white'
          : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center p-3 rounded-[16px] bg-zinc-50 dark:bg-[#2C2C2E]">
      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">{label}</span>
      <span className="text-[20px] font-bold text-zinc-900 dark:text-zinc-50 mt-1">{value}</span>
    </div>
  );
}

/* --- Helpers --- */

function buildSectionSummary({
  record,
  estimate,
  locale,
  title,
  chart,
  color,
  label,
}: {
  record: SessionRecord;
  estimate: ToeicSectionEstimate;
  locale: 'zh' | 'en';
  title: string;
  chart: ScoreTrendPoint[];
  color: string;
  label: string;
}): ActiveSummary {
  return {
    title,
    score: estimate.scaled,
    rawCorrect: estimate.rawCorrect,
    adjustedRawCorrect: estimate.adjustedRawCorrect,
    mistakes: 100 - estimate.rawCorrect,
    accuracy: Number(((estimate.rawCorrect / 100) * 100).toFixed(1)),
    band: getSectionEstimateBand(estimate.scaled),
    interval: formatInterval(estimate.interval.min, estimate.interval.max),
    cefr: formatCefr(estimate.cefr),
    available: estimate.available,
    chart,
    color,
    scaleLabel: label,
    penaltyRaw: estimate.bias.penaltyRaw,
    confidence: buildConfidenceSummary(getSessionDataConfidence(record), locale),
    insights: buildSectionInsights(estimate, locale),
    partBreakdown: estimate.partStats.slice(0, 4).map((item) => ({
      label: translatePart(locale, item.part),
      mistakes: item.mistakes,
      rate: item.errorRate,
      share: item.shareOfLoss,
    })),
    breakdownCards: [
      {
        label,
        score: estimate.scaled,
        interval: formatInterval(estimate.interval.min, estimate.interval.max),
        cefr: formatCefr(estimate.cefr),
      },
    ],
  };
}

function buildTotalSummary({
  estimate,
  listeningRecord,
  readingRecord,
  locale,
  title,
  chart,
  color,
  label,
}: {
  estimate: ToeicCombinedEstimate;
  listeningRecord?: SessionRecord;
  readingRecord?: SessionRecord;
  locale: 'zh' | 'en';
  title: string;
  chart: ScoreTrendPoint[];
  color: string;
  label: string;
}): ActiveSummary {
  const partBreakdown = [
    ...(estimate.listening?.partStats ?? []).map((item) => ({
      label: `${locale === 'zh' ? '听力' : 'L'} · ${translatePart(locale, item.part)}`,
      mistakes: item.mistakes,
      rate: item.errorRate,
      share: item.shareOfLoss,
    })),
    ...(estimate.reading?.partStats ?? []).map((item) => ({
      label: `${locale === 'zh' ? '阅读' : 'R'} · ${translatePart(locale, item.part)}`,
      mistakes: item.mistakes,
      rate: item.errorRate,
      share: item.shareOfLoss,
    })),
  ]
    .sort((left, right) => right.rate - left.rate)
    .slice(0, 5);

  return {
    title,
    score: estimate.total,
    rawCorrect: estimate.rawCorrect,
    adjustedRawCorrect: estimate.adjustedRawCorrect,
    mistakes: estimate.totalMistakes,
    accuracy: estimate.accuracy,
    band: getCombinedEstimateBand(estimate.total),
    interval: formatInterval(estimate.interval.min, estimate.interval.max),
    cefr: formatCefr(estimate.cefr),
    available: estimate.available,
    chart,
    color,
    scaleLabel: label,
    penaltyRaw: Number(
      (((estimate.listening?.bias.penaltyRaw ?? 0) + (estimate.reading?.bias.penaltyRaw ?? 0)).toFixed(1))
    ),
    confidence: buildConfidenceSummary(getCombinedDataConfidence(listeningRecord, readingRecord), locale),
    insights: buildTotalInsights(estimate, locale),
    partBreakdown,
    breakdownCards: [
      {
        label: locale === 'zh' ? '听力' : 'Listening',
        score: estimate.listening?.scaled ?? 0,
        interval: estimate.listening ? formatInterval(estimate.listening.interval.min, estimate.listening.interval.max) : '--',
        cefr: estimate.listening ? formatCefr(estimate.listening.cefr) : '--',
      },
      {
        label: locale === 'zh' ? '阅读' : 'Reading',
        score: estimate.reading?.scaled ?? 0,
        interval: estimate.reading ? formatInterval(estimate.reading.interval.min, estimate.reading.interval.max) : '--',
        cefr: estimate.reading ? formatCefr(estimate.reading.cefr) : '--',
      },
      {
        label: locale === 'zh' ? '总分' : 'Total',
        score: estimate.total,
        interval: formatInterval(estimate.interval.min, estimate.interval.max),
        cefr: formatCefr(estimate.cefr),
      },
    ],
  };
}

function buildSectionInsights(estimate: ToeicSectionEstimate, locale: 'zh' | 'en') {
  const insights: string[] = [];

  if (estimate.bias.penaltyRaw >= 1) {
    insights.push(
      locale === 'zh'
        ? `答题模式波动：基础题错误率偏高。模型已应用惩罚，下调 ${estimate.bias.penaltyRaw} 个原始分。这说明基础仍需夯实。`
        : `Response pattern variance: Error rate in foundational questions is high. Model applied a penalty of ${estimate.bias.penaltyRaw} raw points.`
    );
  } else {
    insights.push(
      locale === 'zh'
        ? `答题发挥稳定，未检测到异常的高低分分布失衡。`
        : `Performance is stable, no aberrant score distribution detected.`
    );
  }

  if (estimate.weakestPart) {
    insights.push(getPartWeaknessNarrative(estimate.weakestPart, locale));
  }

  return insights;
}

function buildTotalInsights(estimate: ToeicCombinedEstimate, locale: 'zh' | 'en') {
  const insights: string[] = [];

  if (estimate.listening && estimate.reading) {
    const weaker = estimate.listening.scaled >= estimate.reading.scaled ? 'reading' : 'listening';
    insights.push(
      locale === 'zh'
        ? `目前突破的瓶颈在${weaker === 'reading' ? '阅读' : '听力'}部分，补齐短板可快速提升总分。`
        : `The current bottleneck is ${weaker}. Focusing on this will lift the total score.`
    );
  }

  if (estimate.sem > 0) {
    insights.push(
      locale === 'zh'
        ? `受测验误差影响，真实水平有高概率落在 ${formatInterval(estimate.interval.min, estimate.interval.max)} 区间内。`
        : `Accounting for SEM, your true ability likely falls within ${formatInterval(estimate.interval.min, estimate.interval.max)}.`
    );
  }

  return insights;
}

function getPartWeaknessNarrative(part: ToeicSectionEstimate['weakestPart'], locale: 'zh' | 'en') {
  switch (part) {
    case 'Part 1': return locale === 'zh' ? 'Part 1 图像题出错较多，需加强基础词汇和动作状态听辨。' : 'Part 1 needs work on concrete vocabulary and actions.';
    case 'Part 2': return locale === 'zh' ? 'Part 2 错题多，功能句型识别与瞬间反应速度是瓶颈。' : 'Part 2 indicates bottlenecks in quick functional response.';
    case 'Part 3': return locale === 'zh' ? 'Part 3 最弱，对话追踪和隐含意图推断能力需要提升。' : 'Part 3 is weak; multi-speaker tracking needs improvement.';
    case 'Part 4': return locale === 'zh' ? 'Part 4 是主要痛点，长段独白的信息保持能力不足。' : 'Part 4 points to weak information retention in long talks.';
    case 'Part 5': return locale === 'zh' ? 'Part 5 丢分多，说明词汇与语法基础不牢，会拖慢后续阅读。' : 'Part 5 loss suggests weak grammar/vocab foundations.';
    case 'Part 6': return locale === 'zh' ? 'Part 6 表现较弱，长篇衔接与语境推断需加强。' : 'Part 6 shows weakness in context and discourse cohesion.';
    case 'Part 7 Single': return locale === 'zh' ? 'Part 7 单篇阅读慢或失分，长文本定位扫读效率是关键。' : 'Part 7 Single indicates slow long-text scanning.';
    case 'Part 7 Multiple': return locale === 'zh' ? 'Part 7 多篇错题率最高，跨文本信息整合与深层推断是最大挑战。' : 'Part 7 Multiple is the main drag; cross-text integration is lacking.';
    default: return locale === 'zh' ? '需要更多样本以定位明确短板。' : 'More samples needed to locate weak spots.';
  }
}

function formatInterval(min: number, max: number) { return `${min}-${max}`; }
function formatCefr(level: ToeicCefrLevel) { return level === 'Below A1' ? '<A1' : level; }

function buildConfidenceSummary(confidence: DataConfidence, locale: 'zh' | 'en'): ConfidenceSummary {
  if (confidence.level === 'high') {
    return {
      label: locale === 'zh' ? '高可信度' : 'High Confidence',
      detail: locale === 'zh' ? '当前数据包含严格的计时和完整的复盘，估分能客观反映真实水平趋势。' : 'Data contains strict timing and full reviews, making it a reliable reflection of your true level.',
      tone: 'emerald',
    };
  }

  if (confidence.level === 'medium') {
    return {
      label: locale === 'zh' ? '中等可信度' : 'Medium Confidence',
      detail: locale === 'zh' ? '测验记录基本可用，但可能缺少部分复盘或部分题目未完成，估分有一定保留。' : 'The record is usable but may lack full review or completion, making the estimate conservative.',
      tone: 'amber',
    };
  }

  return {
    label: locale === 'zh' ? '低可信度' : 'Low Confidence',
    detail: locale === 'zh' ? '当前数据不完整。请确保完成完整测试、记录严格用时，并提交错题。' : 'Incomplete data. Please finish full tests, track time strictly, and record mistakes.',
    tone: 'coral',
  };
}

function confidenceBadgeClassName(tone: ConfidenceSummary['tone']) {
  if (tone === 'emerald') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400';
  if (tone === 'amber') return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400';
  return 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400';
}

function formatShortDate(value: string, locale: 'zh' | 'en') {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' }).format(date);
}

function getTodayDateLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function safeNumber(value: string) {
  const parsed = Number(value);
  return !Number.isFinite(parsed) ? 0 : Math.max(0, parsed);
}
