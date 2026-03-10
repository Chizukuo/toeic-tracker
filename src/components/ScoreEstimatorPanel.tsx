'use client';

import { useMemo, useState } from 'react';
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
import { Calculator, CircleGauge, Headphones, LibraryBig, Plus, Sigma, Trash2 } from 'lucide-react';

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
import { getCopy } from '@/lib/i18n';
import {
  estimateToeicScaledScore,
  getCorrectAnswers,
  getIncorrectAnswers,
  hasRecordedSessionData,
  type SessionRecord,
} from '@/lib/toeic';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

type ScoreMode = 'L' | 'R' | 'T';

type SectionEstimate = {
  available: boolean;
  rawCorrect: number;
  mistakes: number;
  scaled: number;
  accuracy: number;
};

type ScoreTrendPoint = {
  label: string;
  score?: number;
  rawCorrect?: number;
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

export function ScoreEstimatorPanel() {
  const sessions = useStore((state) => state.sessions);
  const locale = useStore((state) => state.locale);
  const historicalScores = useStore((state) => state.historicalScores);
  const addHistoricalScore = useStore((state) => state.addHistoricalScore);
  const removeHistoricalScore = useStore((state) => state.removeHistoricalScore);
  const copy = getCopy(locale);

  const listeningSessions = sessions.filter((session) => session.type === 'L');
  const readingSessions = sessions.filter((session) => session.type === 'R');

  const [mode, setMode] = useState<ScoreMode>('L');
  const [selectedListeningId, setSelectedListeningId] = useState('L1');
  const [selectedReadingId, setSelectedReadingId] = useState('R1');
  const [selectedPair, setSelectedPair] = useState('1');
  const [historyDate, setHistoryDate] = useState('');
  const [historyListening, setHistoryListening] = useState('350');
  const [historyReading, setHistoryReading] = useState('330');

  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const estimateMap = new Map(sessions.map((session) => [session.id, buildEstimate(session)]));

  const selectedListening = sessionMap.get(selectedListeningId) ?? listeningSessions[0];
  const selectedReading = sessionMap.get(selectedReadingId) ?? readingSessions[0];
  const selectedPairListening = sessionMap.get(`L${selectedPair}`) ?? listeningSessions[0];
  const selectedPairReading = sessionMap.get(`R${selectedPair}`) ?? readingSessions[0];

  const listeningEstimate = selectedListening ? estimateMap.get(selectedListening.id) : undefined;
  const readingEstimate = selectedReading ? estimateMap.get(selectedReading.id) : undefined;
  const pairListeningEstimate = selectedPairListening ? estimateMap.get(selectedPairListening.id) : undefined;
  const pairReadingEstimate = selectedPairReading ? estimateMap.get(selectedPairReading.id) : undefined;

  const pairAvailable = Boolean(pairListeningEstimate?.available && pairReadingEstimate?.available);
  const totalScore = pairAvailable ? (pairListeningEstimate?.scaled ?? 0) + (pairReadingEstimate?.scaled ?? 0) : 0;

  const listeningTrend = listeningSessions.map((session) => {
    const estimate = estimateMap.get(session.id);
    return {
      label: session.label,
      score: estimate?.available ? estimate.scaled : undefined,
      rawCorrect: estimate?.available ? estimate.rawCorrect : undefined,
      active: session.id === selectedListeningId,
    };
  });

  const readingTrend = readingSessions.map((session) => {
    const estimate = estimateMap.get(session.id);
    return {
      label: session.label,
      score: estimate?.available ? estimate.scaled : undefined,
      rawCorrect: estimate?.available ? estimate.rawCorrect : undefined,
      active: session.id === selectedReadingId,
    };
  });

  const totalTrend = Array.from({ length: 10 }, (_, index) => {
    const pair = `${index + 1}`;
    const listening = sessionMap.get(`L${pair}`);
    const reading = sessionMap.get(`R${pair}`);
    const listeningProjection = listening ? estimateMap.get(listening.id) : undefined;
    const readingProjection = reading ? estimateMap.get(reading.id) : undefined;
    const available = Boolean(listeningProjection?.available && readingProjection?.available);

    return {
      label: `S${pair}`,
      score: available ? (listeningProjection?.scaled ?? 0) + (readingProjection?.scaled ?? 0) : undefined,
      rawCorrect: available ? (listeningProjection?.rawCorrect ?? 0) + (readingProjection?.rawCorrect ?? 0) : undefined,
      active: selectedPair === pair,
    };
  });

  const historicalTrend = useMemo<HistoricalTrendPoint[]>(() => {
    return historicalScores.map((item) => ({
      id: item.id,
      label: formatShortDate(item.date, locale),
      listening: item.listening,
      reading: item.reading,
      total: item.total,
      fullDate: item.date,
      source: item.source,
      note: item.note,
    }));
  }, [historicalScores, locale]);

  const latestHistorical = historicalScores[historicalScores.length - 1];
  const manualTotalPreview = safeNumber(historyListening) + safeNumber(historyReading);

  const activeSummary =
    mode === 'L'
      ? selectedListening && listeningEstimate
        ? {
            title: `${copy.scoreListeningLabel} · ${selectedListening.label}`,
            score: listeningEstimate.scaled,
            rawCorrect: listeningEstimate.rawCorrect,
            accuracy: listeningEstimate.accuracy,
            mistakes: listeningEstimate.mistakes,
            band: formatScoreBand(listeningEstimate.scaled),
            available: listeningEstimate.available,
            chart: listeningTrend,
            color: '#f59e0b',
          }
        : null
      : mode === 'R'
        ? selectedReading && readingEstimate
          ? {
              title: `${copy.scoreReadingLabel} · ${selectedReading.label}`,
              score: readingEstimate.scaled,
              rawCorrect: readingEstimate.rawCorrect,
              accuracy: readingEstimate.accuracy,
              mistakes: readingEstimate.mistakes,
              band: formatScoreBand(readingEstimate.scaled),
              available: readingEstimate.available,
              chart: readingTrend,
              color: '#38bdf8',
            }
          : null
        : selectedPairListening && selectedPairReading && pairListeningEstimate && pairReadingEstimate
          ? {
              title: `${selectedPairListening.label} + ${selectedPairReading.label}`,
              score: totalScore,
              rawCorrect: (pairListeningEstimate.rawCorrect ?? 0) + (pairReadingEstimate.rawCorrect ?? 0),
              accuracy: Number((((pairListeningEstimate.rawCorrect + pairReadingEstimate.rawCorrect) / 200) * 100).toFixed(1)),
              mistakes: (pairListeningEstimate.mistakes ?? 0) + (pairReadingEstimate.mistakes ?? 0),
              band: formatScoreBand(totalScore),
              available: pairAvailable,
              chart: totalTrend,
              color: '#f97316',
            }
          : null;

  function handleAddHistoricalScore() {
    if (!historyDate) {
      return;
    }

    addHistoricalScore({
      date: historyDate,
      listening: safeNumber(historyListening),
      reading: safeNumber(historyReading),
      total: manualTotalPreview,
      source: 'manual',
    });

    setHistoryDate('');
  }

  function handleAutoAddEstimatedScore() {
    if (!pairAvailable || !selectedPairListening || !selectedPairReading || !pairListeningEstimate || !pairReadingEstimate) {
      return;
    }

    addHistoricalScore({
      date: historyDate || getTodayDateLocal(),
      listening: pairListeningEstimate.scaled,
      reading: pairReadingEstimate.scaled,
      total: totalScore,
      source: 'estimated',
      note: `${selectedPairListening.label} + ${selectedPairReading.label}`,
    });

    setHistoryDate('');
  }

  const canAutoRecordEstimate = mode === 'T' && pairAvailable;

  return (
    <Card className="glass-panel overflow-hidden rounded-[32px] border border-white/65 shadow-[0_24px_80px_-46px_rgba(15,23,42,0.22)] dark:border-white/10">
      <CardHeader className="border-b border-zinc-200/70 bg-white/55 px-6 py-5 dark:border-white/8 dark:bg-zinc-950/80">
        <CardTitle className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-700 dark:text-amber-300">
          {copy.scoreEstimatorTitle}
        </CardTitle>
        <CardDescription className="max-w-3xl text-xs leading-6">
          {copy.scoreEstimatorDescription}
        </CardDescription>
      </CardHeader>

      <CardContent className="grid items-start gap-5 p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="grid gap-4">
          <div className="deck-surface p-4">
            <div className="grid grid-cols-3 gap-2">
              <ModeButton active={mode === 'L'} label={copy.scoreModeListening} icon={<Headphones className="size-3.5" />} onClick={() => setMode('L')} />
              <ModeButton active={mode === 'R'} label={copy.scoreModeReading} icon={<LibraryBig className="size-3.5" />} onClick={() => setMode('R')} />
              <ModeButton active={mode === 'T'} label={copy.scoreModeTotal} icon={<Sigma className="size-3.5" />} onClick={() => setMode('T')} />
            </div>

            <div className="deck-surface-strong mt-4 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                {mode === 'L' ? copy.scoreSelectListening : mode === 'R' ? copy.scoreSelectReading : copy.scoreSelectPair}
              </div>
              <div className="mt-3">
                {mode === 'L' ? (
                  <SessionSelect value={selectedListeningId} onValueChange={setSelectedListeningId} sessions={listeningSessions} placeholder={copy.scoreSelectListening} />
                ) : mode === 'R' ? (
                  <SessionSelect value={selectedReadingId} onValueChange={setSelectedReadingId} sessions={readingSessions} placeholder={copy.scoreSelectReading} />
                ) : (
                  <PairSelect value={selectedPair} onValueChange={setSelectedPair} placeholder={copy.scoreSelectPair} />
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{copy.scoreEstimatorNote}</p>
            </div>
          </div>

          <div className="deck-surface-strong rounded-[28px] p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950">
                <Plus className="size-4" />
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                  {locale === 'zh' ? '历史成绩录入' : 'Historical Scores'}
                </div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {locale === 'zh' ? '补录模考、正式成绩，或把当前总分估算直接写入历史曲线。' : 'Add mock or official scores, or write the current total estimate directly into the history trend.'}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <Input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className="h-11 bg-white/90 dark:bg-zinc-950/80" />
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" min="5" max="495" step="5" value={historyListening} onChange={(event) => setHistoryListening(event.target.value)} className="h-11 bg-white/90 dark:bg-zinc-950/80" placeholder={copy.scoreListeningLabel} />
                <Input type="number" min="5" max="495" step="5" value={historyReading} onChange={(event) => setHistoryReading(event.target.value)} className="h-11 bg-white/90 dark:bg-zinc-950/80" placeholder={copy.scoreReadingLabel} />
              </div>

              <div className="deck-surface-soft rounded-[18px] px-3 py-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  {locale === 'zh' ? '预估总分' : 'Computed Total'}
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">
                  {manualTotalPreview}
                </div>
              </div>

              <div className="grid gap-2">
                <Button type="button" onClick={handleAddHistoricalScore} className="h-11 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200">
                  {locale === 'zh' ? '手动加入历史曲线' : 'Add Manual Record'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAutoAddEstimatedScore}
                  disabled={!canAutoRecordEstimate}
                  className="h-11 border-zinc-200/80 bg-white/85 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/8 dark:bg-zinc-950/80 dark:hover:bg-zinc-900"
                >
                  {locale === 'zh' ? '录入当前总分估算' : 'Record Current Estimate'}
                </Button>
              </div>

              <div className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                {canAutoRecordEstimate
                  ? locale === 'zh'
                    ? `将 ${selectedPairListening.label} + ${selectedPairReading.label} 的估分写入历史曲线，日期默认使用${historyDate ? '当前输入值' : '今天'}。`
                    : `Write the estimate from ${selectedPairListening.label} + ${selectedPairReading.label} into history. The date uses ${historyDate ? 'the current input' : 'today'} by default.`
                  : locale === 'zh'
                    ? '自动录入仅在“总分估算”模式下可用，并且需要当前套次的听力与阅读都已有估分。'
                    : 'Auto record is available only in Total mode after both listening and reading estimates exist for the selected pair.'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          {!activeSummary || !activeSummary.available ? (
            <EstimatePlaceholder />
          ) : (
            <>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_320px]">
                <div className="deck-surface p-5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                    {activeSummary.title}
                  </div>
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <div className="font-mono text-6xl font-semibold tracking-[-0.06em] text-zinc-950 dark:text-zinc-50">
                      {activeSummary.score}
                    </div>
                    <div className="pb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                      {copy.scoreScaled}
                    </div>
                    <div className="deck-pill mb-2 text-[10px] tracking-[0.18em]">
                      {activeSummary.band}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <ScoreMetric label={copy.scoreRawCorrect} value={`${activeSummary.rawCorrect}${mode === 'T' ? '/200' : '/100'}`} />
                    <ScoreMetric label={copy.scoreMistakes} value={`${activeSummary.mistakes}`} />
                    <ScoreMetric label={copy.scoreAccuracy} value={`${activeSummary.accuracy}%`} />
                  </div>
                </div>

                <div className="deck-surface-strong rounded-[28px] p-5">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-400/12 text-amber-700 dark:text-amber-300">
                    <Calculator className="size-4.5" />
                  </div>
                  <div className="mt-4 text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {locale === 'zh' ? '当前预测摘要' : 'Current Projection'}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {locale === 'zh' ? '把当前练习结果转成更接近考试理解方式的分数视图。' : 'Translate the active practice result into a score view that reads more like the real exam.'}
                  </p>
                  <div className="mt-4 grid gap-3">
                    <ScoreMetric label={locale === 'zh' ? '当前模式' : 'Current Mode'} value={mode === 'L' ? copy.scoreListeningLabel : mode === 'R' ? copy.scoreReadingLabel : copy.scoreTotalLabel} />
                    <ScoreMetric label={locale === 'zh' ? '预测区间' : 'Projected Band'} value={activeSummary.band} />
                    <ScoreMetric label={locale === 'zh' ? '最近历史' : 'Latest History'} value={latestHistorical ? `${latestHistorical.total}` : '--'} />
                  </div>
                </div>
              </div>

              <ProjectionTrendChart
                data={activeSummary.chart}
                lineColor={activeSummary.color}
                lineLabel={mode === 'L' ? copy.scoreListeningLabel : mode === 'R' ? copy.scoreReadingLabel : copy.scoreTotalLabel}
              />
            </>
          )}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <HistoricalScoreChart data={historicalTrend} locale={locale} />
            <div className="deck-surface-strong rounded-[28px] p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                {locale === 'zh' ? '历史记录' : 'History Ledger'}
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {locale === 'zh' ? '用于对照当前估分与真实模考或正式成绩。' : 'Use these records to compare projected scores against mocks or official results.'}
              </div>

              <div className="mt-4 space-y-3">
                {historicalScores.length === 0 ? (
                  <div className="deck-empty px-4 py-5 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {locale === 'zh' ? '还没有历史成绩，先补录一次模考、正式成绩，或录入一次当前估分。' : 'No historical scores yet. Add a mock, official record, or capture the current estimate.'}
                  </div>
                ) : (
                  historicalScores.map((item) => (
                    <div key={item.id} className="deck-surface-soft rounded-[22px] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                            <span>{item.date}</span>
                            <span className="rounded-full border border-zinc-200/80 bg-white/80 px-2 py-0.5 text-[9px] tracking-[0.18em] text-zinc-500 dark:border-white/8 dark:bg-zinc-950/75 dark:text-zinc-300">
                              {item.source === 'estimated' ? (locale === 'zh' ? '估分' : 'Estimate') : locale === 'zh' ? '手动' : 'Manual'}
                            </span>
                          </div>
                          <div className="mt-2 font-mono text-3xl font-semibold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">
                            {item.total}
                          </div>
                          {item.note ? <div className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">{item.note}</div> : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeHistoricalScore(item.id)}
                          className="flex size-9 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/80 text-zinc-500 transition-colors hover:text-red-600 dark:border-white/8 dark:bg-zinc-950/80 dark:hover:text-red-300"
                          aria-label={locale === 'zh' ? '删除历史成绩' : 'Remove historical score'}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <ScoreMetric label={copy.scoreListeningLabel} value={`${item.listening}`} compact />
                        <ScoreMetric label={copy.scoreReadingLabel} value={`${item.reading}`} compact />
                        <ScoreMetric label={copy.scoreTotalLabel} value={`${item.total}`} compact />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function buildEstimate(session: SessionRecord): SectionEstimate {
  const rawCorrect = getCorrectAnswers(session);
  const mistakes = getIncorrectAnswers(session);
  const scaled = estimateToeicScaledScore(rawCorrect, session.type);
  const accuracy = Number(((rawCorrect / 100) * 100).toFixed(1));
  const hasMistakeEntries = Object.keys(session.mistakes).length > 0;
  const hasEffectiveData = hasRecordedSessionData(session) && (
    mistakes > 0 ||
    hasMistakeEntries ||
    Boolean(session.timerSummary) ||
    session.reasons.length > 0
  );

  return {
    available: hasEffectiveData,
    rawCorrect,
    mistakes,
    scaled,
    accuracy,
  };
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

function ProjectionTrendChart({ data, lineColor, lineLabel }: { data: ScoreTrendPoint[]; lineColor: string; lineLabel: string }) {
  const locale = useStore((state) => state.locale);
  const availablePoints = data.filter((point) => point.score !== undefined);
  const latest = availablePoints[availablePoints.length - 1];
  const best = [...availablePoints].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  if (availablePoints.length === 0) {
    return <EstimatePlaceholder />;
  }

  return (
    <div className="deck-surface-strong rounded-[28px] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
            {locale === 'zh' ? '估分走势' : 'Projection Trend'}
          </div>
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {locale === 'zh' ? '观察当前训练结果在各套次中的分数变化。' : 'Track how projected scores move across the sprint sets.'}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="deck-pill">
            {locale === 'zh' ? '最新' : 'Latest'} {latest?.score ?? '--'}
          </span>
          <span className="deck-pill">
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
                item?.payload?.rawCorrect !== undefined ? `Raw ${item.payload.rawCorrect}` : lineLabel,
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
}

function HistoricalScoreChart({ data, locale }: { data: HistoricalTrendPoint[]; locale: 'zh' | 'en' }) {
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
    <div className="deck-surface p-5">
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
}

function EstimatePlaceholder() {
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);

  return (
    <div className="deck-empty flex min-h-72 flex-col items-center justify-center px-6 text-center">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
        <CircleGauge className="size-5" />
      </div>
      <div className="mt-4 text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {copy.scoreUnavailable}
      </div>
      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        {copy.scoreUnavailableBody}
      </p>
    </div>
  );
}

function ModeButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
        active
          ? 'border-amber-400/45 bg-amber-400/12 text-amber-700 dark:text-amber-300'
          : 'border-zinc-200/80 bg-white/80 text-zinc-500 hover:text-zinc-800 dark:border-white/8 dark:bg-zinc-950/78 dark:text-zinc-400 dark:hover:text-zinc-200'
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function ScoreMetric({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={cn('deck-surface-strong flex h-full flex-col rounded-[22px]', compact ? 'p-3' : 'p-4')}>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">{label}</div>
      <div className={cn('mt-2 font-mono font-semibold tracking-tight text-zinc-950 dark:text-zinc-50', compact ? 'text-xl' : 'text-2xl')}>
        {value}
      </div>
    </div>
  );
}

function formatScoreBand(score: number) {
  if (score >= 900) return '900+';
  if (score >= 800) return '800-895';
  if (score >= 700) return '700-795';
  if (score >= 600) return '600-695';
  if (score >= 500) return '500-595';
  return '<500';
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