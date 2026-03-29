const fs = require('fs');

const file = fs.readFileSync('src/components/ScoreEstimatorPanel.tsx', 'utf8');

const mainCompEndIndex = file.indexOf('function buildSectionSummary');
if (mainCompEndIndex === -1) {
    console.error("Could not find buildSectionSummary");
    process.exit(1);
}

const helperFunctions = file.slice(mainCompEndIndex);

const newMainComponent = `
'use client';

import { memo, startTransition, useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Calculator,
  CircleGauge,
  Headphones,
  LibraryBig,
  Plus,
  Sigma,
  Sparkles,
  Trash2,
  TrendingUp,
  History,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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

type ScoreMode = 'L' | 'R' | 'T';

type ScoreTrendPoint = {
  label: string;
  score?: number;
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
  const addHistoricalScore = useStore((state) => state.addHistoricalScore);
  const removeHistoricalScore = useStore((state) => state.removeHistoricalScore);
  const copy = getCopy(locale);

  const [mode, setMode] = useState<ScoreMode>('T');
  const [showPotential, setShowPotential] = useState(false);
  const [selectedListeningId, setSelectedListeningId] = useState('L1');
  const [selectedReadingId, setSelectedReadingId] = useState('R1');
  const [selectedPair, setSelectedPair] = useState('1');
  
  const [historyDate, setHistoryDate] = useState('');
  const [historyListening, setHistoryListening] = useState('350');
  const [historyReading, setHistoryReading] = useState('330');
  const [isAddHistoryOpen, setIsAddHistoryOpen] = useState(false);

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

  const selectedListening = sessionMap.get(selectedListeningId) ?? listeningSessions[0];
  const selectedReading = sessionMap.get(selectedReadingId) ?? readingSessions[0];
  const selectedPairListening = sessionMap.get(`L\${selectedPair}`) ?? listeningSessions[0];
  const selectedPairReading = sessionMap.get(`R\${selectedPair}`) ?? readingSessions[0];

  const listeningEstimate = selectedListening ? dualEstimateMap.get(selectedListening.id)?.strict : undefined;
  const listeningPotentialEstimate = selectedListening ? dualEstimateMap.get(selectedListening.id)?.potential : undefined;
  const readingEstimate = selectedReading ? dualEstimateMap.get(selectedReading.id)?.strict : undefined;
  const readingPotentialEstimate = selectedReading ? dualEstimateMap.get(selectedReading.id)?.potential : undefined;
  const pairEstimate = useMemo(
    () => estimateToeicCombinedDualScore(selectedPairListening, selectedPairReading),
    [selectedPairListening, selectedPairReading]
  );
  const pairStrictEstimate = pairEstimate.strict;
  const pairPotentialEstimate = pairEstimate.potential;

  const listeningTrend = useMemo(
    () =>
      listeningSessions.map((session) => {
        const estimate = dualEstimateMap.get(session.id);
        return {
          label: session.label,
          score: estimate?.strict.available ? estimate.strict.scaled : undefined,
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
        const pair = `\${index + 1}`;
        const listening = sessionMap.get(`L\${pair}`);
        const reading = sessionMap.get(`R\${pair}`);
        const estimate = estimateToeicCombinedDualScore(listening, reading).strict;

        return {
          label: `S\${pair}`,
          score: estimate.available ? estimate.total : undefined,
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

  const latestHistorical = deferredHistoricalScores[deferredHistoricalScores.length - 1];
  const manualTotalPreview = safeNumber(historyListening) + safeNumber(historyReading);

  const getSummaryForMode = (isPotential: boolean) => {
    if (mode === 'L' && selectedListening) {
      const est = isPotential ? listeningPotentialEstimate : listeningEstimate;
      if (est) return buildSectionSummary({ record: selectedListening, estimate: est, locale, title: `\${copy.scoreListeningLabel} · \${selectedListening.label}`, chart: listeningTrend, color: '#f59e0b', label: copy.scoreListeningLabel });
    }
    if (mode === 'R' && selectedReading) {
      const est = isPotential ? readingPotentialEstimate : readingEstimate;
      if (est) return buildSectionSummary({ record: selectedReading, estimate: est, locale, title: `\${copy.scoreReadingLabel} · \${selectedReading.label}`, chart: readingTrend, color: '#38bdf8', label: copy.scoreReadingLabel });
    }
    if (mode === 'T' && selectedPairListening && selectedPairReading) {
      const est = isPotential ? pairPotentialEstimate : pairStrictEstimate;
      return buildTotalSummary({ estimate: est, listeningRecord: selectedPairListening, readingRecord: selectedPairReading, locale, title: `\${selectedPairListening.label} + \${selectedPairReading.label}`, chart: totalTrend, color: '#f97316', label: copy.scoreTotalLabel });
    }
    return null;
  };

  const activeSummary = getSummaryForMode(false);
  const displaySummary = getSummaryForMode(showPotential) ?? activeSummary;
  
  const potentialDelta = activeSummary && displaySummary ? displaySummary.score - activeSummary.score : 0;

  function handleAddHistoricalScore() {
    if (!historyDate) return;
    startTransition(() => {
      addHistoricalScore({ date: historyDate, listening: safeNumber(historyListening), reading: safeNumber(historyReading), total: manualTotalPreview, source: 'manual' });
    });
    setHistoryDate('');
    setIsAddHistoryOpen(false);
  }

  function handleAutoAddEstimatedScore() {
    if (!pairStrictEstimate.available || !pairStrictEstimate.listening || !pairStrictEstimate.reading) return;
    startTransition(() => {
      addHistoricalScore({ date: historyDate || getTodayDateLocal(), listening: pairStrictEstimate.listening.scaled, reading: pairStrictEstimate.reading.scaled, total: pairStrictEstimate.total, source: 'estimated', note: `\${selectedPairListening.label} + \${selectedPairReading.label}` });
    });
    setHistoryDate('');
    setIsAddHistoryOpen(false);
  }

  const canAutoRecordEstimate = mode === 'T' && pairStrictEstimate.available;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12">
      {/* Sleek Segmented Control and Session Selector */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-2 pl-4 pr-2 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl rounded-full border border-white/40 dark:border-white/10 shadow-sm relative z-20">
        
        {/* Animated Segmented Control */}
        <div className="flex bg-zinc-200/50 dark:bg-zinc-800/50 p-1 rounded-full relative w-full md:w-auto">
          {['L', 'R', 'T'].map((tab) => {
             const labels: Record<string, string> = { L: copy.scoreModeListening, R: copy.scoreModeReading, T: copy.scoreModeTotal };
             const icons: Record<string, ReactNode> = { L: <Headphones className="w-4 h-4 mr-2" />, R: <LibraryBig className="w-4 h-4 mr-2" />, T: <Sigma className="w-4 h-4 mr-2" /> };
             const isActive = mode === tab;
             
             return (
               <button
                 key={tab}
                 onClick={() => setMode(tab as ScoreMode)}
                 className={cn(
                   "relative flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 text-sm font-medium transition-colors z-10",
                   isActive ? (tab === 'L' ? 'text-amber-950 dark:text-amber-950' : tab === 'R' ? 'text-sky-950 dark:text-sky-950' : 'text-zinc-900 dark:text-zinc-900') : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                 )}
               >
                 {isActive && (
                   <motion.div
                     layoutId="mode-tab-indicator"
                     className={cn("absolute inset-0 rounded-full shadow-sm", tab === 'L' ? 'bg-amber-400' : tab === 'R' ? 'bg-sky-400' : 'bg-white dark:bg-zinc-300')}
                     transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                   />
                 )}
                 <span className="relative z-20 flex items-center">{icons[tab]}{labels[tab]}</span>
               </button>
             );
          })}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto px-4 md:px-0 z-20">
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hidden md:inline">
             {locale === 'zh' ? '选择套次' : 'Select Set'}
          </span>
          <div className="w-full md:w-48 relative z-20">
             {mode === 'L' ? (
                <SessionSelect value={selectedListeningId} onValueChange={setSelectedListeningId} sessions={listeningSessions} placeholder={copy.scoreSelectListening} />
              ) : mode === 'R' ? (
                <SessionSelect value={selectedReadingId} onValueChange={setSelectedReadingId} sessions={readingSessions} placeholder={copy.scoreSelectReading} />
              ) : (
                <PairSelect value={selectedPair} onValueChange={setSelectedPair} placeholder={copy.scoreSelectPair} />
              )}
          </div>
        </div>
      </div>

      {/* Main Score Hero Widget */}
      {!displaySummary || !displaySummary.available ? (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[40px] border border-dashed border-zinc-300/80 bg-white/30 dark:border-zinc-800 dark:bg-zinc-900/30 flex min-h-[400px] flex-col items-center justify-center p-8 text-center backdrop-blur-xl z-10">
          <div className="flex size-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 mb-6 shadow-inner">
            <CircleGauge className="size-8" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {copy.scoreUnavailable}
          </h2>
          <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400 max-w-md leading-relaxed">
            {locale === 'zh'
              ? '先完成一次计时或至少保存按 Part 的错题数据，系统才能进行能力推断并输出估分。'
              : 'Finish a timed run or save part-level mistake data first for a meaningful estimate.'}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 relative z-10">
          
          {/* Left Column: Big Score */}
          <div className="flex flex-col gap-6">
            <Card className="overflow-hidden rounded-[40px] border border-white/40 bg-white/40 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-3xl dark:border-white/10 dark:bg-zinc-900/40 relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent dark:from-white/5 opacity-50 pointer-events-none" />
              
              <CardContent className="p-8 md:p-12 relative z-10 flex flex-col items-center justify-center text-center min-h-[380px]">
                <AnimatePresence mode="wait">
                  <motion.div 
                     key={displaySummary.title + showPotential + mode}
                     initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                     animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                     exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                     transition={{ duration: 0.3 }}
                     className="flex flex-col items-center"
                  >
                    <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/50 bg-white/60 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-600 shadow-sm dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-300 mb-8">
                      {displaySummary.title}
                    </div>
                    
                    <div className="relative">
                      <h1 className={cn(
                        "font-mono text-[8rem] md:text-[10rem] font-bold tracking-tighter leading-none transition-colors",
                        showPotential ? "text-cyan-500 dark:text-cyan-400" : "text-zinc-950 dark:text-zinc-50"
                      )}>
                        {displaySummary.score}
                      </h1>
                      <AnimatePresence>
                        {showPotential && potentialDelta > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0, x: -20 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0 }}
                            className="absolute -top-4 -right-8 md:-right-12 rounded-full bg-cyan-100 text-cyan-700 px-3 py-1 font-mono text-lg font-bold shadow-sm dark:bg-cyan-900/50 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/50"
                          >
                            +{potentialDelta}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                      <span className="rounded-full bg-zinc-100/80 backdrop-blur-md px-4 py-1.5 font-mono text-sm font-medium text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300">
                        {displaySummary.band}
                      </span>
                      <span className="rounded-full bg-zinc-100/80 backdrop-blur-md px-4 py-1.5 font-mono text-sm font-medium text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300">
                        CEFR {displaySummary.cefr}
                      </span>
                      <span className={cn('rounded-full px-4 py-1.5 font-mono text-sm font-medium border backdrop-blur-md', confidenceBadgeClassName(displaySummary.confidence.tone))}>
                        {displaySummary.confidence.label}
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </CardContent>

              {/* Bottom Bar of Hero: The Toggle */}
              <div className="border-t border-white/50 dark:border-white/10 bg-white/30 dark:bg-zinc-950/30 p-5 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 bg-white/50 dark:bg-zinc-800/50 p-2 rounded-full px-4 border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm transition-all hover:shadow-md cursor-pointer" onClick={() => setShowPotential(!showPotential)}>
                  <Switch 
                     id="potential-mode" 
                     checked={showPotential} 
                     onCheckedChange={setShowPotential} 
                     className="data-[state=checked]:bg-cyan-500 pointer-events-none"
                  />
                  <Label htmlFor="potential-mode" className="text-sm font-medium pointer-events-none select-none">
                    {locale === 'zh' ? '展示潜力分 (包含补录)' : 'Show Potential Score (Includes Overtime)'}
                  </Label>
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium font-mono uppercase tracking-widest bg-zinc-100/50 dark:bg-zinc-800/50 px-4 py-2 rounded-full border border-zinc-200/50 dark:border-zinc-700/50">
                  {locale === 'zh' ? '预测区间' : 'SEM Range'} {displaySummary.interval}
                </div>
              </div>
            </Card>

            {/* Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ScoreMetric label={copy.scoreRawCorrect} value={`\${displaySummary.rawCorrect}\${mode === 'T' ? '/200' : '/100'}`} />
              <ScoreMetric label={locale === 'zh' ? '修正原始分' : 'Adjusted Raw'} value={`\${displaySummary.adjustedRawCorrect}`} />
              <ScoreMetric label={copy.scoreMistakes} value={`\${displaySummary.mistakes}`} />
              <ScoreMetric label={copy.scoreAccuracy} value={`\${displaySummary.accuracy}%`} />
            </div>
            
            {/* Chart directly underneath */}
            <ProjectionTrendChart
               data={displaySummary.chart}
               lineColor={displaySummary.color}
               lineLabel={mode === 'L' ? copy.scoreListeningLabel : mode === 'R' ? copy.scoreReadingLabel : copy.scoreTotalLabel}
               locale={locale}
            />
          </div>

          {/* Right Column: Insights & Details */}
          <div className="flex flex-col gap-6">
            <div className="rounded-[36px] border border-white/40 bg-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/40 p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <Sparkles className="size-5" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {locale === 'zh' ? '诊断与建议' : 'Insights'}
                </h3>
              </div>
              
              <div className="flex flex-col gap-3">
                {displaySummary.insights.map((item, index) => (
                  <div key={`\${item}-\${index}`} className="rounded-[24px] bg-white/60 dark:bg-zinc-900/60 p-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 shadow-sm border border-white/50 dark:border-white/5">
                    {item}
                  </div>
                ))}
              </div>
              
              {displaySummary.penaltyRaw > 0 && (
                <div className="mt-2 rounded-[24px] bg-red-50/80 dark:bg-red-900/10 p-4 border border-red-100/50 dark:border-red-900/20 flex justify-between items-center shadow-sm">
                  <span className="text-sm font-medium text-red-800 dark:text-red-300">
                    {locale === 'zh' ? '分布异常惩罚' : 'Distribution Penalty'}
                  </span>
                  <span className="font-mono font-bold text-red-600 dark:text-red-400">
                    -{displaySummary.penaltyRaw}
                  </span>
                </div>
              )}
            </div>

            {mode === 'T' && (
              <BreakdownCard locale={locale} title={locale === 'zh' ? '分项明细' : 'Section Breakdown'} items={displaySummary.breakdownCards} />
            )}

            {mode !== 'T' && (
              <PartBreakdownCard locale={locale} items={displaySummary.partBreakdown} />
            )}
            
            {/* Confidence details hidden behind info */}
            <div className={cn('mt-2 rounded-[28px] border px-5 py-4 text-sm leading-6 shadow-sm', confidencePanelClassName(displaySummary.confidence.tone))}>
               <div className="flex items-center gap-2 font-semibold mb-1">
                 <Info className="size-4" />
                 {locale === 'zh' ? '可信度说明' : 'Confidence Note'}
               </div>
               {displaySummary.confidence.detail}
            </div>
          </div>

        </div>
      )}

      {/* History Section */}
      <div className="mt-12 relative z-10">
        <div className="flex items-center justify-between mb-6 px-2">
           <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-3 text-zinc-900 dark:text-white">
             <History className="size-6 text-zinc-400" />
             {locale === 'zh' ? '历史成绩' : 'Score History'}
           </h2>
           
           <Dialog open={isAddHistoryOpen} onOpenChange={setIsAddHistoryOpen}>
             <DialogTrigger asChild>
               <Button className="rounded-full bg-zinc-900 text-white shadow-md hover:bg-zinc-800 hover:scale-105 transition-all dark:bg-white dark:text-zinc-900 border border-zinc-800 dark:border-zinc-200">
                 <Plus className="size-4 mr-2" />
                 {locale === 'zh' ? '添加记录' : 'Add Record'}
               </Button>
             </DialogTrigger>
             <DialogContent className="max-w-md rounded-[40px] p-0 overflow-hidden border-white/40 bg-white/90 backdrop-blur-3xl dark:border-white/10 dark:bg-zinc-900/90 shadow-2xl">
                <DialogHeader className="p-8 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/50">
                  <DialogTitle className="text-2xl font-semibold">
                    {locale === 'zh' ? '录入成绩' : 'Log Score'}
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-zinc-500">
                    {locale === 'zh' ? '手动录入历史模考或真实考试成绩。' : 'Manually add historical mock or official scores.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="p-8 flex flex-col gap-6">
                   <div className="space-y-3">
                     <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500">{locale === 'zh' ? '日期' : 'Date'}</Label>
                     <Input type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} className="h-14 rounded-[20px] bg-zinc-100/80 dark:bg-zinc-800/80 border-0 text-base font-medium focus-visible:ring-2 focus-visible:ring-amber-400 transition-shadow" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-3">
                       <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500">{copy.scoreListeningLabel}</Label>
                       <Input type="number" min="5" max="495" step="5" value={historyListening} onChange={(e) => setHistoryListening(e.target.value)} className="h-14 rounded-[20px] bg-zinc-100/80 dark:bg-zinc-800/80 border-0 text-lg font-mono font-semibold text-center focus-visible:ring-2 focus-visible:ring-amber-400 transition-shadow" />
                     </div>
                     <div className="space-y-3">
                       <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500">{copy.scoreReadingLabel}</Label>
                       <Input type="number" min="5" max="495" step="5" value={historyReading} onChange={(e) => setHistoryReading(e.target.value)} className="h-14 rounded-[20px] bg-zinc-100/80 dark:bg-zinc-800/80 border-0 text-lg font-mono font-semibold text-center focus-visible:ring-2 focus-visible:ring-amber-400 transition-shadow" />
                     </div>
                   </div>
                   <div className="flex justify-between items-center p-5 rounded-[24px] bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 mt-2 shadow-inner">
                      <span className="text-sm font-semibold uppercase tracking-wider">{locale === 'zh' ? '总分' : 'Total'}</span>
                      <span className="font-mono text-3xl font-bold">{manualTotalPreview}</span>
                   </div>
                </div>
                <DialogFooter className="p-6 pt-4 bg-zinc-50/80 dark:bg-zinc-950/80 border-t border-zinc-200/50 dark:border-zinc-800/50 flex flex-col sm:flex-row sm:justify-between items-center gap-3">
                   <Button variant="ghost" onClick={() => setIsAddHistoryOpen(false)} className="rounded-full w-full sm:w-auto h-12">
                     {locale === 'zh' ? '取消' : 'Cancel'}
                   </Button>
                   <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
                     {canAutoRecordEstimate && (
                        <Button variant="secondary" onClick={handleAutoAddEstimatedScore} className="rounded-full w-full sm:w-auto h-12 shadow-sm">
                          {locale === 'zh' ? '用当前估分' : 'Use Estimate'}
                        </Button>
                     )}
                     <Button onClick={handleAddHistoricalScore} disabled={!historyDate} className="rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 w-full sm:w-auto h-12 shadow-md">
                       {locale === 'zh' ? '保存记录' : 'Save'}
                     </Button>
                   </div>
                </DialogFooter>
             </DialogContent>
           </Dialog>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
           <HistoricalScoreChart data={historicalTrend} locale={locale} />
           
           <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto no-scrollbar pb-4 pr-2">
             {deferredHistoricalScores.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center rounded-[36px] border border-dashed border-zinc-300/80 bg-white/30 px-6 text-center dark:border-zinc-800 dark:bg-zinc-900/30 text-sm text-zinc-500 backdrop-blur-md">
                  {locale === 'zh' ? '暂无历史记录' : 'No history records'}
                </div>
             ) : (
                [...deferredHistoricalScores].reverse().map((item) => (
                  <div key={item.id} className="relative overflow-hidden rounded-[28px] border border-white/50 bg-white/40 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/40 p-5 group transition-all hover:bg-white hover:shadow-md dark:hover:bg-zinc-800/80">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col">
                        <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">{item.date}</span>
                        <span className="font-mono text-4xl font-bold text-zinc-950 dark:text-zinc-50 tracking-tighter">{item.total}</span>
                        <div className="flex items-center gap-3 mt-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100/80 dark:bg-zinc-800/80 py-1.5 px-3 rounded-full w-fit border border-zinc-200/50 dark:border-zinc-700/50">
                          <span className="text-amber-600 dark:text-amber-400">L: {item.listening}</span>
                          <span className="text-sky-600 dark:text-sky-400">R: {item.reading}</span>
                        </div>
                        {item.note && <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{item.note}</div>}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full bg-white dark:bg-zinc-950 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
                           {item.source === 'estimated' ? (locale === 'zh' ? '估分' : 'Est.') : locale === 'zh' ? '手动' : 'Man.'}
                        </span>
                        <button
                          onClick={() => startTransition(() => removeHistoricalScore(item.id))}
                          className="mt-3 p-2.5 rounded-full bg-red-50 text-red-400 hover:bg-red-500 hover:text-white dark:bg-red-900/20 dark:hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
             )}
           </div>
        </div>
      </div>
    </div>
  );
}

`;

const finalContent = newMainComponent + helperFunctions;
fs.writeFileSync('src/components/ScoreEstimatorPanel.tsx', finalContent, 'utf8');

