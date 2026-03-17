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
} from 'lucide-react';

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

  const [mode, setMode] = useState<ScoreMode>('L');
  const [selectedListeningId, setSelectedListeningId] = useState('L1');
  const [selectedReadingId, setSelectedReadingId] = useState('R1');
  const [selectedPair, setSelectedPair] = useState('1');
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

  const selectedListening = sessionMap.get(selectedListeningId) ?? listeningSessions[0];
  const selectedReading = sessionMap.get(selectedReadingId) ?? readingSessions[0];
  const selectedPairListening = sessionMap.get(`L${selectedPair}`) ?? listeningSessions[0];
  const selectedPairReading = sessionMap.get(`R${selectedPair}`) ?? readingSessions[0];

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
        const pair = `${index + 1}`;
        const listening = sessionMap.get(`L${pair}`);
        const reading = sessionMap.get(`R${pair}`);
        const estimate = estimateToeicCombinedDualScore(listening, reading).strict;

        return {
          label: `S${pair}`,
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

  const activeSummary = useMemo<ActiveSummary | null>(() => {
    if (mode === 'L' && selectedListening && listeningEstimate) {
      return buildSectionSummary({
        record: selectedListening,
        estimate: listeningEstimate,
        locale,
        title: `${copy.scoreListeningLabel} · ${selectedListening.label}`,
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
        title: `${copy.scoreReadingLabel} · ${selectedReading.label}`,
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
        title: `${selectedPairListening.label} + ${selectedPairReading.label}`,
        chart: totalTrend,
        color: '#f97316',
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
    selectedPairListening,
    selectedPairReading,
    selectedReading,
    totalTrend,
  ]);

  const potentialSummary = useMemo<ActiveSummary | null>(() => {
    if (mode === 'L' && selectedListening && listeningPotentialEstimate) {
      return buildSectionSummary({
        record: selectedListening,
        estimate: listeningPotentialEstimate,
        locale,
        title: `${copy.scoreListeningLabel} · ${selectedListening.label}`,
        chart: listeningTrend,
        color: '#f59e0b',
        label: copy.scoreListeningLabel,
      });
    }

    if (mode === 'R' && selectedReading && readingPotentialEstimate) {
      return buildSectionSummary({
        record: selectedReading,
        estimate: readingPotentialEstimate,
        locale,
        title: `${copy.scoreReadingLabel} · ${selectedReading.label}`,
        chart: readingTrend,
        color: '#38bdf8',
        label: copy.scoreReadingLabel,
      });
    }

    if (selectedPairListening && selectedPairReading) {
      return buildTotalSummary({
        estimate: pairPotentialEstimate,
        listeningRecord: selectedPairListening,
        readingRecord: selectedPairReading,
        locale,
        title: `${selectedPairListening.label} + ${selectedPairReading.label}`,
        chart: totalTrend,
        color: '#f97316',
        label: copy.scoreTotalLabel,
      });
    }

    return null;
  }, [
    copy.scoreListeningLabel,
    copy.scoreReadingLabel,
    copy.scoreTotalLabel,
    listeningPotentialEstimate,
    listeningTrend,
    locale,
    mode,
    pairPotentialEstimate,
    readingPotentialEstimate,
    readingTrend,
    selectedListening,
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
    if (!pairStrictEstimate.available || !pairStrictEstimate.listening || !pairStrictEstimate.reading) {
      return;
    }

    const listeningEstimate = pairStrictEstimate.listening;
    const readingEstimate = pairStrictEstimate.reading;

    startTransition(() => {
      addHistoricalScore({
        date: historyDate || getTodayDateLocal(),
        listening: listeningEstimate.scaled,
        reading: readingEstimate.scaled,
        total: pairStrictEstimate.total,
        source: 'estimated',
        note: `${selectedPairListening.label} + ${selectedPairReading.label}`,
      });
    });

    setHistoryDate('');
  }

  const canAutoRecordEstimate = mode === 'T' && pairStrictEstimate.available;

  return (
    <div className="grid gap-5">
      {/* ── Hero: Score + Mode Selector ── */}
      <div className="overflow-hidden rounded-[40px] bg-white/50 shadow-[0_8px_40px_rgba(0,0,0,0.06)] backdrop-blur-2xl ring-1 ring-black/5 dark:bg-zinc-900/50 dark:ring-white/8">
        {/* Toolbar: mode switcher + session picker inline */}
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200/50 px-6 py-4 dark:border-white/8">
          <div className="flex rounded-[12px] bg-zinc-100/80 p-1 dark:bg-zinc-800/60">
            <ModeButton active={mode === 'L'} label={copy.scoreModeListening} icon={<Headphones className="size-3.5" />} onClick={() => setMode('L')} />
            <ModeButton active={mode === 'R'} label={copy.scoreModeReading} icon={<LibraryBig className="size-3.5" />} onClick={() => setMode('R')} />
            <ModeButton active={mode === 'T'} label={copy.scoreModeTotal} icon={<Sigma className="size-3.5" />} onClick={() => setMode('T')} />
          </div>
          <div className="min-w-40 flex-1">
            {mode === 'L' ? (
              <SessionSelect value={selectedListeningId} onValueChange={setSelectedListeningId} sessions={listeningSessions} placeholder={copy.scoreSelectListening} />
            ) : mode === 'R' ? (
              <SessionSelect value={selectedReadingId} onValueChange={setSelectedReadingId} sessions={readingSessions} placeholder={copy.scoreSelectReading} />
            ) : (
              <PairSelect value={selectedPair} onValueChange={setSelectedPair} placeholder={copy.scoreSelectPair} />
            )}
          </div>
          <div className="shrink-0 rounded-full bg-zinc-100/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            PEASEA
          </div>
        </div>

        {/* Score display */}
        {!activeSummary || !activeSummary.available ? (
          <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
            <CircleGauge className="size-8 text-zinc-300 dark:text-zinc-600" />
            <p className="max-w-sm text-sm leading-6 text-zinc-400 dark:text-zinc-500">
              {locale === 'zh'
                ? '先完成一次计时，或至少保存按 Part 的错题数据，模型才会输出有效估分。'
                : 'Finish a timed run or save part-level mistake data first for a valid estimate.'}
            </p>
          </div>
        ) : (
          <>
            <div className="px-8 pt-10 pb-6">
              {/* Main score hero */}
              <div className="flex flex-wrap items-end gap-4">
                <div className="font-mono text-[88px] font-semibold leading-none tracking-[-0.06em] text-zinc-950 dark:text-zinc-50">
                  {activeSummary.score}
                </div>
                <div className="mb-3 flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-zinc-100 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {activeSummary.band}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      CEFR {activeSummary.cefr}
                    </span>
                    <span className={cn('rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-[0.18em]', confidenceBadgeClassName(activeSummary.confidence.tone))}>
                      {activeSummary.confidence.label}
                    </span>
                  </div>
                  <div className="font-mono text-sm text-zinc-400 dark:text-zinc-500">
                    {locale === 'zh' ? '区间' : 'Range'} {activeSummary.interval}
                  </div>
                </div>
              </div>

              {/* Strict → Potential speed gap (only when there's a meaningful gap) */}
              {potentialSummary && potentialSummary.score > activeSummary.score && (
                <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                  <span className="font-mono text-zinc-400 dark:text-zinc-500">{locale === 'zh' ? '严格分' : 'Strict'}</span>
                  <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">{activeSummary.score}</span>
                  <span className="text-zinc-300 dark:text-zinc-600">→</span>
                  <span className="font-mono text-zinc-400 dark:text-zinc-500">{locale === 'zh' ? '潜力分' : 'Potential'}</span>
                  <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">{potentialSummary.score}</span>
                  <span className="rounded-full bg-sky-50 px-3 py-0.5 font-mono text-[11px] text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
                    +{potentialSummary.score - activeSummary.score} {locale === 'zh' ? '速度差' : 'speed gap'}
                  </span>
                </div>
              )}

              {/* Confidence context */}
              <div className={cn('mt-5 rounded-[18px] px-4 py-3 text-sm leading-6', confidencePanelClassName(activeSummary.confidence.tone))}>
                {activeSummary.confidence.detail}
              </div>
            </div>

            {/* Key metrics strip — ruled row, no boxing */}
            <div className="grid grid-cols-2 border-t border-zinc-200/50 sm:grid-cols-4 dark:border-white/8">
              <div className="flex flex-col gap-1.5 px-6 py-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">{copy.scoreRawCorrect}</div>
                <div className="font-mono text-xl font-semibold text-zinc-900 dark:text-zinc-50">{activeSummary.rawCorrect}{mode === 'T' ? '/200' : '/100'}</div>
              </div>
              <div className="flex flex-col gap-1.5 border-l border-zinc-200/50 px-6 py-5 dark:border-white/8">
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">{locale === 'zh' ? '修正原始分' : 'Adjusted'}</div>
                <div className="font-mono text-xl font-semibold text-zinc-900 dark:text-zinc-50">{activeSummary.adjustedRawCorrect}{mode === 'T' ? '/200' : '/100'}</div>
              </div>
              <div className="flex flex-col gap-1.5 border-l border-zinc-200/50 px-6 py-5 dark:border-white/8">
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">{copy.scoreMistakes}</div>
                <div className="font-mono text-xl font-semibold text-zinc-900 dark:text-zinc-50">{activeSummary.mistakes}</div>
              </div>
              <div className="flex flex-col gap-1.5 border-l border-zinc-200/50 px-6 py-5 dark:border-white/8">
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">{copy.scoreAccuracy}</div>
                <div className="font-mono text-xl font-semibold text-zinc-900 dark:text-zinc-50">{activeSummary.accuracy}%</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Diagnostic Insights ── */}
      {activeSummary?.available && activeSummary.insights.length > 0 && (
        <div className="rounded-[32px] bg-white/40 px-8 py-6 shadow-sm backdrop-blur-xl ring-1 ring-black/5 dark:bg-zinc-900/40 dark:ring-white/8">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-zinc-400 dark:text-zinc-500" />
            <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-400 dark:text-zinc-500">
              {locale === 'zh' ? '诊断' : 'Diagnosis'}
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {activeSummary.insights.map((item, index) => (
              <p key={index} className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                {item}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Part Error Breakdown (ranked bars, most pressure first) ── */}
      {activeSummary?.available && activeSummary.partBreakdown.length > 0 && (
        <div className="rounded-[32px] bg-white/40 px-8 py-6 shadow-sm backdrop-blur-xl ring-1 ring-black/5 dark:bg-zinc-900/40 dark:ring-white/8">
          <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-400 dark:text-zinc-500">
            {locale === 'zh' ? '错题分布' : 'Loss Distribution'}
          </div>
          <div className="mt-5 space-y-4">
            {activeSummary.partBreakdown.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{item.label}</span>
                  <div className="flex items-center gap-3 font-mono text-zinc-500 dark:text-zinc-400">
                    <span>{locale === 'zh' ? `失分 ${item.mistakes}` : `Loss ${item.mistakes}`}</span>
                    <span className="text-zinc-700 dark:text-zinc-200">{(item.rate * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
                    style={{ width: `${Math.max(item.rate * 100, 3)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section Mapping (Total mode only, when L+R both present) ── */}
      {activeSummary?.available && activeSummary.breakdownCards.length > 1 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {activeSummary.breakdownCards.map((item) => (
            <div key={item.label} className="rounded-[28px] bg-white/40 p-6 shadow-sm backdrop-blur-xl ring-1 ring-black/5 dark:bg-zinc-900/40 dark:ring-white/8">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">{item.label}</div>
              <div className="mt-3 font-mono text-5xl font-semibold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">{item.score}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-zinc-100/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400">CEFR {item.cefr}</span>
                <span className="rounded-full bg-zinc-100/80 px-2.5 py-1 font-mono text-[10px] text-zinc-400 dark:bg-zinc-800/80">{item.interval}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Projection Trend Chart ── */}
      {activeSummary?.available && (
        <ProjectionTrendChart
          data={activeSummary.chart}
          lineColor={activeSummary.color}
          lineLabel={mode === 'L' ? copy.scoreListeningLabel : mode === 'R' ? copy.scoreReadingLabel : copy.scoreTotalLabel}
          locale={locale}
        />
      )}

      {/* ── Historical Scores: chart + input side by side ── */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <HistoricalScoreChart data={historicalTrend} locale={locale} />
        <div className="flex flex-col gap-5 rounded-[32px] bg-white/40 p-6 shadow-sm backdrop-blur-xl ring-1 ring-black/5 dark:bg-zinc-900/40 dark:ring-white/8">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-400 dark:text-zinc-500">
              {locale === 'zh' ? '录入成绩' : 'Record Score'}
            </div>
            <div className="mt-4 overflow-hidden rounded-[20px] bg-white/60 ring-1 ring-zinc-200/50 dark:bg-zinc-900/40 dark:ring-white/10">
              <div className="flex items-center justify-between gap-4 border-b border-zinc-200/50 px-4 py-3.5 dark:border-white/5">
                <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">{locale === 'zh' ? '日期' : 'Date'}</span>
                <input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className="w-32 bg-transparent text-right text-[13px] text-zinc-900 focus:outline-none dark:text-zinc-50" />
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-zinc-200/50 px-4 py-3.5 dark:border-white/5">
                <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">{copy.scoreListeningLabel}</span>
                <input type="number" min="5" max="495" step="5" value={historyListening} onChange={(event) => setHistoryListening(event.target.value)} className="w-20 bg-transparent text-right text-[13px] text-zinc-900 focus:outline-none dark:text-zinc-50 placeholder:text-zinc-400" placeholder="0" />
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">{copy.scoreReadingLabel}</span>
                <input type="number" min="5" max="495" step="5" value={historyReading} onChange={(event) => setHistoryReading(event.target.value)} className="w-20 bg-transparent text-right text-[13px] text-zinc-900 focus:outline-none dark:text-zinc-50 placeholder:text-zinc-400" placeholder="0" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-[18px] bg-zinc-100/60 px-4 py-3 dark:bg-zinc-800/40">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{locale === 'zh' ? '计算总分' : 'Total'}</span>
              <span className="font-mono text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{manualTotalPreview}</span>
            </div>
            <div className="mt-3 grid gap-2">
              <Button type="button" onClick={handleAddHistoricalScore} className="h-11 rounded-2xl bg-zinc-950 text-white transition-transform active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-950">
                {locale === 'zh' ? '手动加入历史曲线' : 'Add Manual Record'}
              </Button>
              {canAutoRecordEstimate && (
                <Button type="button" variant="outline" onClick={handleAutoAddEstimatedScore} className="h-11 rounded-2xl border-zinc-200/80 transition-transform active:scale-[0.98] dark:border-white/8">
                  {locale === 'zh' ? '录入当前总分估算' : 'Record Current Estimate'}
                </Button>
              )}
            </div>
            {canAutoRecordEstimate && (
              <p className="mt-3 text-xs leading-5 text-zinc-400 dark:text-zinc-500">
                {locale === 'zh'
                  ? `将 ${selectedPairListening.label} + ${selectedPairReading.label} 的估算写入历史，日期默认使用${historyDate ? '当前输入值' : '今天'}。`
                  : `Write the ${selectedPairListening.label} + ${selectedPairReading.label} estimate into history. Date uses ${historyDate ? 'the current input' : 'today'} by default.`}
              </p>
            )}
          </div>

          {/* Compact history ledger */}
          {deferredHistoricalScores.length > 0 && (
            <div>
              <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-400 dark:text-zinc-500">
                {locale === 'zh' ? '历史记录' : 'History'}
              </div>
              <div className="space-y-2">
                {[...deferredHistoricalScores].reverse().map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-[18px] bg-white/60 px-4 py-3 ring-1 ring-zinc-200/50 dark:bg-zinc-900/50 dark:ring-white/8">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xl font-semibold text-zinc-950 dark:text-zinc-50">{item.total}</span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          {item.source === 'estimated' ? (locale === 'zh' ? '估分' : 'Est') : (locale === 'zh' ? '手动' : 'Manual')}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-zinc-400 dark:text-zinc-500">
                        {item.date} · L{item.listening} R{item.reading}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startTransition(() => removeHistoricalScore(item.id))}
                      className="flex size-8 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:text-red-500 active:text-red-600 dark:hover:text-red-400"
                      aria-label={locale === 'zh' ? '删除历史成绩' : 'Remove historical score'}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
        ? `检测到异常答题模式：基础层错题率 ${(estimate.bias.basicErrorRate * 100).toFixed(1)}% 明显高于高阶层 ${(estimate.bias.advancedErrorRate * 100).toFixed(1)}%。模型按 Δ = α × min(0, Padv - Pbasic) × 100 计算，并以 α=${estimate.bias.alpha.toFixed(2)} 下调 ${estimate.bias.penaltyRaw} 个原始分。`
        : `An aberrant response pattern was detected: foundational-part error rate ${(estimate.bias.basicErrorRate * 100).toFixed(1)}% is materially higher than the advanced layer ${(estimate.bias.advancedErrorRate * 100).toFixed(1)}%. The model applies Δ = α × min(0, Padv - Pbasic) × 100 with α=${estimate.bias.alpha.toFixed(2)}, reducing the raw score by ${estimate.bias.penaltyRaw}.`
    );
  } else {
    insights.push(
      locale === 'zh'
        ? `错题分布基本正常，基础层 ${(estimate.bias.basicErrorRate * 100).toFixed(1)}% 与高阶层 ${(estimate.bias.advancedErrorRate * 100).toFixed(1)}% 的失衡不明显，因此未触发异常分布惩罚。`
        : `The error distribution looks normal. The gap between foundational ${(estimate.bias.basicErrorRate * 100).toFixed(1)}% and advanced ${(estimate.bias.advancedErrorRate * 100).toFixed(1)}% layers is limited, so no aberrant-distribution penalty is applied.`
    );
  }

  if (estimate.weakestPart) {
    insights.push(getPartWeaknessNarrative(estimate.weakestPart, locale));
  }

  if (estimate.type === 'R' && estimate.unfinishedPenalty > 0) {
    insights.push(
      locale === 'zh'
        ? `检测到 ${estimate.unfinishedPenalty} 道未完成题，系统按 Part 7 Multiple → Part 7 Single → Part 6 → Part 5 的顺序并入失分。`
        : `${estimate.unfinishedPenalty} unfinished reading items were detected and assigned in the order Part 7 Multiple → Part 7 Single → Part 6 → Part 5.`
    );
  }

  return insights.slice(0, 3);
}

function buildTotalInsights(estimate: ToeicCombinedEstimate, locale: 'zh' | 'en') {
  const insights: string[] = [];

  if (estimate.listening && estimate.reading) {
    insights.push(
      locale === 'zh'
        ? `听力 ${estimate.listening.scaled} / 阅读 ${estimate.reading.scaled}；单项 CEFR 分别为 ${formatCefr(estimate.listening.cefr)} 和 ${formatCefr(estimate.reading.cefr)}，综合评级再按木桶原则收敛到 ${formatCefr(estimate.cefr)}。`
        : `Listening ${estimate.listening.scaled} / Reading ${estimate.reading.scaled}; section CEFR bands are ${formatCefr(estimate.listening.cefr)} and ${formatCefr(estimate.reading.cefr)}, then the overall rating collapses to ${formatCefr(estimate.cefr)} under the bucket rule.`
    );

    const weaker = estimate.listening.scaled >= estimate.reading.scaled ? 'reading' : 'listening';
    insights.push(
      locale === 'zh'
        ? weaker === 'reading'
          ? '当前总分的主要拖累来自阅读侧，尤其要关注长文本与跨文本整合效率。'
          : '当前总分的主要拖累来自听力侧，尤其要关注对话追踪与说明文信息保持。'
        : weaker === 'reading'
          ? 'Reading is the current cap on the total score, especially long-form and cross-text integration.'
          : 'Listening is the current cap on the total score, especially conversation tracking and talk retention.'
    );
  }

  if (estimate.sem > 0) {
    insights.push(
      locale === 'zh'
        ? `总分采用约 ±${estimate.sem} 分的测量误差带，因此应把 ${formatInterval(estimate.interval.min, estimate.interval.max)} 视为更稳妥的预测区间。`
        : `The combined estimate uses an SEM band of about ±${estimate.sem}, so ${formatInterval(estimate.interval.min, estimate.interval.max)} is the more stable range to read.`
    );
  }

  return insights.slice(0, 3);
}

function getPartWeaknessNarrative(part: ToeicSectionEstimate['weakestPart'], locale: 'zh' | 'en') {
  switch (part) {
    case 'Part 1':
      return locale === 'zh'
        ? 'Part 1 为最弱点，说明具象词汇和动作状态的基础听辨还不稳。'
        : 'Part 1 is the weakest area, pointing to instability in concrete vocabulary and action-state listening.';
    case 'Part 2':
      return locale === 'zh'
        ? 'Part 2 为最弱点，说明功能句型识别和瞬时反应速度仍是瓶颈。'
        : 'Part 2 is the weakest area, suggesting a bottleneck in functional expressions and rapid response mapping.';
    case 'Part 3':
      return locale === 'zh'
        ? 'Part 3 为最弱点，说明多方对话追踪和隐含意图判断还不够稳定。'
        : 'Part 3 is the weakest area, indicating instability in multi-speaker tracking and implied-meaning judgment.';
    case 'Part 4':
      return locale === 'zh'
        ? 'Part 4 为最弱点，说明长段独白的信息保持、结构提取和细节回收能力不足。'
        : 'Part 4 is the weakest area, indicating weaker retention and structure extraction in longer talks.';
    case 'Part 5':
      return locale === 'zh'
        ? 'Part 5 为最弱点，底层词汇语法还不够稳，后续长文分数会被一起拖累。'
        : 'Part 5 is the weakest area, so vocabulary and grammar foundations are likely dragging later reading performance.';
    case 'Part 6':
      return locale === 'zh'
        ? 'Part 6 为最弱点，篇章衔接和句子嵌入判断是当前短板。'
        : 'Part 6 is the weakest area, so discourse cohesion and sentence insertion remain the short board.';
    case 'Part 7 Single':
      return locale === 'zh'
        ? 'Part 7 单篇为最弱点，长文本扫读定位和细节回收效率不足。'
        : 'Part 7 Single is the weakest area, pointing to slower long-passage scanning and detail retrieval.';
    case 'Part 7 Multiple':
      return locale === 'zh'
        ? 'Part 7 多篇为最弱点，跨文本信息连接与深层推断是目前最主要的失分源。'
        : 'Part 7 Multiple is the weakest area, making cross-text integration and deeper inference the main loss source.';
    default:
      return locale === 'zh' ? '当前错题分布已生成，但仍需要更多样本来稳定诊断。' : 'The distribution is available, but more samples would stabilize the diagnosis.';
  }
}

function SessionSelect({
  value,
  onValueChange,
  sessions,
  placeholder,
}: {
  value: string;
  onValueChange: (value: string) => void;
  sessions: SessionRecord[];
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}>
      <SelectTrigger className="h-11 w-full rounded-xl border-zinc-200/80 bg-white/85 px-3 dark:border-white/8 dark:bg-zinc-950/82">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {sessions.map((session) => (
          <SelectItem key={session.id} value={session.id}>
            {session.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PairSelect({ value, onValueChange, placeholder }: { value: string; onValueChange: (value: string) => void; placeholder: string }) {
  return (
    <Select value={value} onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}>
      <SelectTrigger className="h-11 w-full rounded-xl border-zinc-200/80 bg-white/85 px-3 dark:border-white/8 dark:bg-zinc-950/82">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 10 }, (_, index) => {
          const pair = `${index + 1}`;
          return (
            <SelectItem key={pair} value={pair}>
              {`L${pair} + R${pair}`}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

const ProjectionTrendChart = memo(function ProjectionTrendChart({
  data,
  lineColor,
  lineLabel,
  locale,
}: {
  data: ScoreTrendPoint[];
  lineColor: string;
  lineLabel: string;
  locale: 'zh' | 'en';
}) {
  const availablePoints = data.filter((point) => point.score !== undefined);
  const latest = availablePoints[availablePoints.length - 1];
  const best = [...availablePoints].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  if (availablePoints.length === 0) {
    return <EstimatePlaceholder />;
  }

  return (
    <div className="rounded-[28px] border border-white/60 bg-white/40 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
            {locale === 'zh' ? '估分走势' : 'Projection Trend'}
          </div>
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {locale === 'zh' ? '按套次查看非线性估分如何变化。' : 'See how the nonlinear score estimate moves across sets.'}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="rounded-full border border-zinc-200/50 bg-white/60 px-3 py-1 font-mono uppercase text-zinc-500 shadow-sm dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-300">
            {locale === 'zh' ? '最新' : 'Latest'} {latest?.score ?? '--'}
          </span>
          <span className="rounded-full border border-zinc-200/50 bg-white/60 px-3 py-1 font-mono uppercase text-zinc-500 shadow-sm dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-300">
            {locale === 'zh' ? '最佳' : 'Best'} {best?.score ?? '--'}
          </span>
        </div>
      </div>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.15)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" />
            <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" allowDecimals={false} domain={['dataMin - 10', 'dataMax + 10']} />
            <Tooltip
              cursor={{ stroke: 'rgba(245,158,11,0.24)', strokeWidth: 1 }}
              contentStyle={{
                background: 'var(--tooltip-bg)',
                borderColor: 'var(--tooltip-border)',
                borderRadius: '12px',
                fontSize: '12px',
                color: 'var(--tooltip-color)',
              }}
              formatter={(value: number, _name, item) => [
                `${Number(value)} ${lineLabel}`,
                item?.payload?.adjustedRaw !== undefined
                  ? locale === 'zh'
                    ? `修正原始分 ${item.payload.adjustedRaw}`
                    : `Adjusted raw ${item.payload.adjustedRaw}`
                  : lineLabel,
              ]}
            />
            <Line
              type="monotone"
              dataKey="score"
              name={lineLabel}
              stroke={lineColor}
              strokeWidth={2.5}
              connectNulls
              dot={(props) => {
                const { cx, cy, payload, index } = props;
                const dotKey = `projection-dot-${payload?.label ?? index ?? 'empty'}`;

                if (cx === undefined || cy === undefined || !payload || payload.score === undefined) {
                  return <g key={dotKey} />;
                }

                return (
                  <circle
                    key={dotKey}
                    cx={cx}
                    cy={cy}
                    r={payload.active ? 5.5 : 3.5}
                    fill={lineColor}
                    stroke={payload.active ? '#111827' : '#ffffff'}
                    strokeWidth={payload.active ? 2 : 1.5}
                  />
                );
              }}
              activeDot={{ r: 7, fill: '#111827', stroke: lineColor, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

const HistoricalScoreChart = memo(function HistoricalScoreChart({ data, locale }: { data: HistoricalTrendPoint[]; locale: 'zh' | 'en' }) {
  if (data.length === 0) {
    return (
      <div className="deck-empty flex min-h-80 flex-col items-center justify-center px-6 text-center">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
          <CircleGauge className="size-5" />
        </div>
        <div className="mt-4 text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {locale === 'zh' ? '还没有历史成绩曲线' : 'No score history yet'}
        </div>
        <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {locale === 'zh' ? '录入模考或正式成绩后，这里会显示真实成绩的时间线。' : 'Add mock or official scores and this chart will draw the real score timeline.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[32px] border border-white/50 bg-white/50 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
            {locale === 'zh' ? '历史成绩折线图' : 'Historical Score Trend'}
          </div>
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {locale === 'zh' ? '把听力、阅读和总分放在一条时间线上，看真实成绩走势。' : 'Plot listening, reading, and total on one timeline to see real score movement.'}
          </div>
        </div>
      </div>

      <div className="mt-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.15)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" />
            <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" allowDecimals={false} domain={[0, 990]} />
            <Tooltip
              contentStyle={{
                background: 'var(--tooltip-bg)',
                borderColor: 'var(--tooltip-border)',
                borderRadius: '12px',
                fontSize: '12px',
                color: 'var(--tooltip-color)',
              }}
              formatter={(value: number, name: string) => [value, name]}
              labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullDate ?? ''}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Line type="monotone" dataKey="listening" name={locale === 'zh' ? '听力' : 'Listening'} stroke="#f59e0b" strokeWidth={2.25} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="reading" name={locale === 'zh' ? '阅读' : 'Reading'} stroke="#38bdf8" strokeWidth={2.25} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="total" name={locale === 'zh' ? '总分' : 'Total'} stroke="#ef7154" strokeWidth={2.75} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

function DualScoreCard({
  locale,
  title,
  body,
  summary,
  tone,
  delta,
}: {
  locale: 'zh' | 'en';
  title: string;
  body: string;
  summary: ActiveSummary;
  tone: 'amber' | 'cyan';
  delta?: number;
}) {
  const isAmber = tone === 'amber';
  const containerClass = isAmber
    ? 'bg-[linear-gradient(135deg,rgba(255,251,235,1),rgba(255,247,237,0.5))] dark:bg-[linear-gradient(135deg,rgba(67,20,7,0.4),rgba(67,20,7,0.1))] border-amber-200/50 dark:border-amber-900/50 text-amber-950 dark:text-amber-100'
    : 'bg-[linear-gradient(135deg,rgba(236,254,255,1),rgba(239,246,255,0.5))] dark:bg-[linear-gradient(135deg,rgba(8,51,68,0.4),rgba(23,37,84,0.1))] border-cyan-200/50 dark:border-cyan-900/50 text-cyan-950 dark:text-cyan-100';

  const badgeClass = isAmber
    ? 'bg-amber-100/50 border-amber-200/50 dark:bg-amber-900/30 dark:border-amber-800/50'
    : 'bg-cyan-100/50 border-cyan-200/50 dark:bg-cyan-900/30 dark:border-cyan-800/50';

  return (
    <div className={cn('relative overflow-hidden rounded-[28px] border p-6 shadow-sm transition-all', containerClass)}>
      <div className={cn('absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl', isAmber ? 'bg-amber-400/20' : 'bg-cyan-400/20')} />
      
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] opacity-70">{title}</div>
          <p className="mt-1.5 max-w-[200px] text-xs leading-5 opacity-60">{body}</p>
        </div>
        <div className={cn('rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.18em] uppercase backdrop-blur-sm', badgeClass)}>
          CEFR {summary.cefr}
        </div>
      </div>

      <div className="relative mt-8 flex items-baseline gap-3">
        <div className="font-mono text-6xl font-semibold tracking-[-0.05em]">{summary.score}</div>
        <div className="mb-2 font-mono text-xs uppercase tracking-[0.2em] opacity-70">{summary.band}</div>
        {typeof delta === 'number' && delta > 0 ? (
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-red-500">
            {locale === 'zh' ? `+${delta} 速度差` : `+${delta} speed gap`}
          </div>
        ) : null}
      </div>

      <div className="relative mt-6 flex items-center justify-between border-t border-current/10 pt-4 text-xs">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-60">{locale === 'zh' ? '原始分' : 'Raw'}</span>
          <span className="font-medium">{summary.rawCorrect}</span>
        </div>
        <div className="flex flex-col gap-1 text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-60">{locale === 'zh' ? '准确率' : 'Accuracy'}</span>
          <span className="font-medium">{summary.accuracy}%</span>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-60">{locale === 'zh' ? '误差区间' : 'Range'}</span>
          <span className="font-medium">{summary.interval}</span>
        </div>
      </div>
    </div>
  );
}

function InsightCard({ locale, insights }: { locale: 'zh' | 'en'; insights: string[] }) {
  return (
    <div className="rounded-[32px] border border-white/50 bg-white/50 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/50 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950">
          <Sparkles className="size-4" />
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
            {locale === 'zh' ? '诊断摘要' : 'Diagnostic Summary'}
          </div>
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {locale === 'zh' ? '按错题分布解释这次估分为什么会落在当前区间。' : 'Explain why this estimate lands in the current band based on the error distribution.'}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {insights.map((item, index) => (
          <div key={`${item}-${index}`} className="rounded-[20px] border border-white/50 bg-white/50 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/50 p-5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakdownCard({
  locale,
  title,
  items,
}: {
  locale: 'zh' | 'en';
  title: string;
  items: ActiveSummary['breakdownCards'];
}) {
  return (
    <div className="rounded-[28px] border border-white/60 bg-white/40 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/40 p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{title}</div>
      <div className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        {locale === 'zh' ? '单项与总分分别保留独立的等值化区间。' : 'Each section keeps its own equated range before rolling into the total.'}
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={`${item.label}-${item.score}`} className="rounded-[20px] border border-white/50 bg-white/50 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/50 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{item.label}</div>
                <div className="mt-2 font-mono text-3xl font-semibold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">{item.score}</div>
              </div>
              <div className="rounded-full border border-zinc-200/50 bg-white/60 px-3 py-1 font-mono uppercase text-zinc-500 shadow-sm dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-300 text-[10px] tracking-[0.18em]">CEFR {item.cefr}</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ScoreMetric label={locale === 'zh' ? '区间' : 'Range'} value={item.interval} compact />
              <ScoreMetric label="CEFR" value={item.cefr} compact />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PartBreakdownCard({ locale, items }: { locale: 'zh' | 'en'; items: PartBreakdownItem[] }) {
  return (
    <div className="rounded-[28px] border border-white/60 bg-white/40 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/40 p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
        {locale === 'zh' ? '错题分布' : 'Loss Distribution'}
      </div>
      <div className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        {locale === 'zh' ? '按错误率排序，帮助定位真正拉低能力估计的 Part。' : 'Sorted by error rate to show which parts are actually pulling the ability estimate down.'}
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-[20px] border border-white/50 bg-white/50 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{item.label}</div>
              <div className="font-mono text-sm text-zinc-500 dark:text-zinc-400">{(item.rate * 100).toFixed(1)}%</div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800/80">
              <div className="bg-linear-to-r h-full rounded-full from-amber-400 via-orange-400 to-sky-400" style={{ width: `${Math.max(item.rate * 100, 4)}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>{locale === 'zh' ? `失分 ${item.mistakes}` : `Loss ${item.mistakes}`}</span>
              <span>{locale === 'zh' ? `占本组失分 ${(item.share * 100).toFixed(1)}%` : `${(item.share * 100).toFixed(1)}% of this section's loss`}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EstimatePlaceholder() {
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);

  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-[32px] border border-dashed border-zinc-200/60 bg-zinc-50/50 px-6 text-center dark:border-white/10 dark:bg-zinc-900/30">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
        <CircleGauge className="size-5" />
      </div>
      <div className="mt-4 text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {copy.scoreUnavailable}
      </div>
      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        {locale === 'zh'
          ? '先完成一次计时或至少保存按 Part 的错题数据，模型才会输出有效的区间与诊断。'
          : 'Finish a timed run or save part-level mistake data first for a meaningful estimate, range, and diagnosis.'}
      </p>
    </div>
  );
}

function ModeButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-medium transition-all duration-200',
        active
          ? 'bg-white text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:bg-zinc-700 dark:text-zinc-50'
          : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function ScoreMetric({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={cn('flex h-full flex-col rounded-[24px] border border-white/50 bg-white/50 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/50', compact ? 'p-4' : 'p-5')}>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">{label}</div>
      <div className={cn('mt-2 font-mono font-semibold tracking-tight text-zinc-950 dark:text-zinc-50', compact ? 'text-xl' : 'text-2xl')}>
        {value}
      </div>
    </div>
  );
}

function formatInterval(min: number, max: number) {
  return `${min}-${max}`;
}

function formatCefr(level: ToeicCefrLevel) {
  return level === 'Below A1' ? '<A1' : level;
}

function buildConfidenceSummary(confidence: DataConfidence, locale: 'zh' | 'en'): ConfidenceSummary {
  if (confidence.level === 'high') {
    return {
      label: locale === 'zh' ? '高可信度' : 'High Confidence',
      detail: locale === 'zh' ? '当前样本已包含严格计时与复盘结果，这次估分更适合拿来判断真实趋势。' : 'The sample includes both strict timing and review data, so this estimate is suitable for reading as a real trend.',
      tone: 'emerald',
    };
  }

  if (confidence.level === 'medium') {
    const detail = confidence.issues.includes('unfinished-backlog')
      ? locale === 'zh'
        ? '当前样本可参考，但阅读仍有未完成题或部分节点尚未完全复盘，结论要保守看。'
        : 'This sample is usable, but unfinished reading backlog or partially reviewed sets still make the conclusion conservative.'
      : locale === 'zh'
        ? '当前样本已经可用，但仍缺少完整复盘或计时闭环，建议结合后续几次记录一起看。'
        : 'The sample is usable, but it still lacks a full timer-review loop, so read it together with the next few records.';

    return {
      label: locale === 'zh' ? '中等可信度' : 'Medium Confidence',
      detail,
      tone: 'amber',
    };
  }

  const detail = confidence.issues.includes('timer-running')
    ? locale === 'zh'
      ? '当前套题仍在进行中，估分与分布都还没稳定，先不要把它当成正式结论。'
      : 'The current set is still in progress, so neither the estimate nor the distribution is stable enough for a firm conclusion.'
    : locale === 'zh'
      ? '当前数据还不完整，通常意味着缺少严格计时、完整复盘，或听阅配对样本不足。'
      : 'The current data is still incomplete, usually because strict timing, full review, or paired listening-reading samples are missing.';

  return {
    label: locale === 'zh' ? '低可信度' : 'Low Confidence',
    detail,
    tone: 'coral',
  };
}

function confidenceBadgeClassName(tone: ConfidenceSummary['tone']) {
  if (tone === 'emerald') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }

  if (tone === 'amber') {
    return 'border-amber-400/30 bg-amber-400/12 text-amber-700 dark:text-amber-300';
  }

  return 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300';
}

function confidencePanelClassName(tone: ConfidenceSummary['tone']) {
  if (tone === 'emerald') {
    return 'border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300';
  }

  if (tone === 'amber') {
    return 'border-amber-400/20 bg-amber-400/8 text-amber-700 dark:text-amber-300';
  }

  return 'border-red-500/20 bg-red-500/8 text-red-700 dark:text-red-300';
}

function formatShortDate(value: string, locale: 'zh' | 'en') {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getTodayDateLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function safeNumber(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}