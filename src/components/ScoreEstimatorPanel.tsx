'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Calculator, CircleGauge, Headphones, LibraryBig, Sigma } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  hasRecordedSessionData,
  sumMistakes,
  type SessionRecord,
} from '@/lib/toeic';
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

export function ScoreEstimatorPanel() {
  const sessions = useStore((state) => state.sessions);
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);

  const listeningSessions = useMemo(() => sessions.filter((session) => session.type === 'L'), [sessions]);
  const readingSessions = useMemo(() => sessions.filter((session) => session.type === 'R'), [sessions]);

  const [mode, setMode] = useState<ScoreMode>('L');
  const [selectedListeningId, setSelectedListeningId] = useState('L1');
  const [selectedReadingId, setSelectedReadingId] = useState('R1');
  const [selectedPair, setSelectedPair] = useState('1');

  const sessionMap = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions]);
  const estimateMap = useMemo(
    () => new Map(sessions.map((session) => [session.id, buildEstimate(session)])),
    [sessions]
  );

  const selectedListening = sessionMap.get(selectedListeningId) ?? listeningSessions[0];
  const selectedReading = sessionMap.get(selectedReadingId) ?? readingSessions[0];
  const selectedPairListening = sessionMap.get(`L${selectedPair}`) ?? listeningSessions[0];
  const selectedPairReading = sessionMap.get(`R${selectedPair}`) ?? readingSessions[0];

  const listeningEstimate = selectedListening ? estimateMap.get(selectedListening.id) : undefined;
  const readingEstimate = selectedReading ? estimateMap.get(selectedReading.id) : undefined;
  const pairListeningEstimate = selectedPairListening ? estimateMap.get(selectedPairListening.id) : undefined;
  const pairReadingEstimate = selectedPairReading ? estimateMap.get(selectedPairReading.id) : undefined;
  const pairAvailable = Boolean(pairListeningEstimate?.available && pairReadingEstimate?.available);
  const totalScore = pairAvailable
    ? (pairListeningEstimate?.scaled ?? 0) + (pairReadingEstimate?.scaled ?? 0)
    : 0;
  const listeningTrend = useMemo(
    () =>
      listeningSessions.map((session) => {
        const estimate = estimateMap.get(session.id);

        return {
          label: session.label,
          score: estimate?.available ? estimate.scaled : undefined,
          rawCorrect: estimate?.available ? estimate.rawCorrect : undefined,
          active: session.id === selectedListeningId,
        };
      }),
    [estimateMap, listeningSessions, selectedListeningId]
  );
  const readingTrend = useMemo(
    () =>
      readingSessions.map((session) => {
        const estimate = estimateMap.get(session.id);

        return {
          label: session.label,
          score: estimate?.available ? estimate.scaled : undefined,
          rawCorrect: estimate?.available ? estimate.rawCorrect : undefined,
          active: session.id === selectedReadingId,
        };
      }),
    [estimateMap, readingSessions, selectedReadingId]
  );
  const totalTrend = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => {
        const pair = `${index + 1}`;
        const listening = sessionMap.get(`L${pair}`);
        const reading = sessionMap.get(`R${pair}`);
        const listeningEstimate = listening ? estimateMap.get(listening.id) : undefined;
        const readingEstimate = reading ? estimateMap.get(reading.id) : undefined;
        const available = Boolean(listeningEstimate?.available && readingEstimate?.available);

        return {
          label: `S${pair}`,
          score: available ? (listeningEstimate?.scaled ?? 0) + (readingEstimate?.scaled ?? 0) : undefined,
          rawCorrect: available ? (listeningEstimate?.rawCorrect ?? 0) + (readingEstimate?.rawCorrect ?? 0) : undefined,
          active: selectedPair === pair,
        };
      }),
    [estimateMap, selectedPair, sessionMap]
  );

  return (
    <Card className="glass-panel overflow-hidden rounded-[28px] border-zinc-200/70 shadow-sm dark:border-zinc-800">
      <CardHeader className="border-b border-zinc-100 bg-zinc-50/70 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950/60">
        <CardTitle className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-600 dark:text-amber-400">
          {copy.scoreEstimatorTitle}
        </CardTitle>
        <CardDescription className="max-w-3xl text-xs leading-6">
          {copy.scoreEstimatorDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid items-start gap-4 p-6 xl:grid-cols-[290px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="grid grid-cols-3 gap-2">
            <ModeButton
              active={mode === 'L'}
              label={copy.scoreModeListening}
              icon={<Headphones className="size-3.5" />}
              onClick={() => setMode('L')}
            />
            <ModeButton
              active={mode === 'R'}
              label={copy.scoreModeReading}
              icon={<LibraryBig className="size-3.5" />}
              onClick={() => setMode('R')}
            />
            <ModeButton
              active={mode === 'T'}
              label={copy.scoreModeTotal}
              icon={<Sigma className="size-3.5" />}
              onClick={() => setMode('T')}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-200/70 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/75">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              {mode === 'L'
                ? copy.scoreSelectListening
                : mode === 'R'
                  ? copy.scoreSelectReading
                  : copy.scoreSelectPair}
            </div>
            <div className="mt-3">
              {mode === 'L' ? (
                <SessionSelect
                  value={selectedListeningId}
                  onValueChange={setSelectedListeningId}
                  sessions={listeningSessions}
                  placeholder={copy.scoreSelectListening}
                />
              ) : mode === 'R' ? (
                <SessionSelect
                  value={selectedReadingId}
                  onValueChange={setSelectedReadingId}
                  sessions={readingSessions}
                  placeholder={copy.scoreSelectReading}
                />
              ) : (
                <PairSelect value={selectedPair} onValueChange={setSelectedPair} placeholder={copy.scoreSelectPair} />
              )}
            </div>
            <p className="mt-3 text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
              {copy.scoreEstimatorNote}
            </p>
          </div>
        </div>

        {mode === 'L' && listeningEstimate && selectedListening ? (
          <SectionEstimateView
            copyLabel={copy.scoreListeningLabel}
            sessionLabel={selectedListening.label}
            estimate={listeningEstimate}
            trendData={listeningTrend}
            trendLabel={copy.scoreListeningLabel}
            totalQuestions={100}
            lineColor="#f59e0b"
          />
        ) : mode === 'R' && readingEstimate && selectedReading ? (
          <SectionEstimateView
            copyLabel={copy.scoreReadingLabel}
            sessionLabel={selectedReading.label}
            estimate={readingEstimate}
            trendData={readingTrend}
            trendLabel={copy.scoreReadingLabel}
            totalQuestions={100}
            lineColor="#38bdf8"
          />
        ) : (
          <TotalEstimateView
            copy={copy}
            listeningSession={selectedPairListening}
            readingSession={selectedPairReading}
            listeningEstimate={pairListeningEstimate}
            readingEstimate={pairReadingEstimate}
            totalScore={totalScore}
            available={pairAvailable}
            trendData={totalTrend}
            lineColor="#f97316"
          />
        )}
      </CardContent>
    </Card>
  );
}

function buildEstimate(session: SessionRecord): SectionEstimate {
  const rawCorrect = getCorrectAnswers(session);
  const mistakes = sumMistakes(session);
  const scaled = estimateToeicScaledScore(rawCorrect, session.type);
  const accuracy = Number(((rawCorrect / 100) * 100).toFixed(1));

  return {
    available: hasRecordedSessionData(session),
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
      <SelectTrigger className="h-11 w-full rounded-xl border-zinc-200 bg-white/90 px-3 dark:border-zinc-800 dark:bg-zinc-950/80">
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

function PairSelect({
  value,
  onValueChange,
  placeholder,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}>
      <SelectTrigger className="h-11 w-full rounded-xl border-zinc-200 bg-white/90 px-3 dark:border-zinc-800 dark:bg-zinc-950/80">
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

function SectionEstimateView({
  copyLabel,
  sessionLabel,
  estimate,
  trendData,
  trendLabel,
  totalQuestions,
  lineColor,
}: {
  copyLabel: string;
  sessionLabel: string;
  estimate: SectionEstimate;
  trendData: ScoreTrendPoint[];
  trendLabel: string;
  totalQuestions: number;
  lineColor: string;
}) {
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);
  const previousPoint = [...trendData].reverse().find((point) => !point.active && point.score !== undefined);
  const delta = previousPoint?.score !== undefined ? estimate.scaled - previousPoint.score : null;

  if (!estimate.available) {
    return <EstimatePlaceholder />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_320px]">
      <div className="grid gap-4">
        <div className="rounded-[24px] border border-zinc-200/70 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
            {copyLabel} · {sessionLabel}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="font-mono text-6xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
              {estimate.scaled}
            </div>
            <div className="pb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              {copy.scoreScaled}
            </div>
            {delta !== null ? (
              <div className={`mb-2 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${delta >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-red-500/10 text-red-600 dark:text-red-300'}`}>
                {delta >= 0 ? '+' : ''}{delta} vs prev
              </div>
            ) : null}
          </div>
          <div className="mt-5 grid auto-rows-fr gap-3 sm:grid-cols-3">
            <ScoreStat label={copy.scoreRawCorrect} value={`${estimate.rawCorrect}/${totalQuestions}`} />
            <ScoreStat label={copy.scoreMistakes} value={`${estimate.mistakes}`} />
            <ScoreStat label={copy.scoreAccuracy} value={`${estimate.accuracy}%`} />
          </div>
        </div>

        <ScoreTrendChart data={trendData} lineColor={lineColor} lineLabel={trendLabel} />
      </div>
      <div className="flex h-full flex-col rounded-[24px] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-400/12 text-amber-700 dark:text-amber-300">
          <Calculator className="size-4.5" />
        </div>
        <div className="mt-4 text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {locale === 'zh' ? '当前估分摘要' : 'Current score snapshot'}
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {locale === 'zh' ? '看当前分数、所在分区和本次套次。' : 'Quick view of the current score, band, and selected set.'}
        </p>
        <div className="mt-auto grid gap-3 pt-4">
          <ScoreStat label={locale === 'zh' ? '当前套次' : 'Current set'} value={sessionLabel} />
          <ScoreStat label={locale === 'zh' ? '稳定区间' : 'Current band'} value={formatScoreBand(estimate.scaled)} />
        </div>
      </div>
    </div>
  );
}

function TotalEstimateView({
  copy,
  listeningSession,
  readingSession,
  listeningEstimate,
  readingEstimate,
  totalScore,
  available,
  trendData,
  lineColor,
}: {
  copy: ReturnType<typeof getCopy>;
  listeningSession?: SessionRecord;
  readingSession?: SessionRecord;
  listeningEstimate?: SectionEstimate;
  readingEstimate?: SectionEstimate;
  totalScore: number;
  available: boolean;
  trendData: ScoreTrendPoint[];
  lineColor: string;
}) {
  const locale = useStore((state) => state.locale);

  if (!available || !listeningEstimate || !readingEstimate || !listeningSession || !readingSession) {
    return <EstimatePlaceholder />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_320px]">
      <div className="grid gap-4">
        <div className="rounded-[24px] border border-zinc-200/70 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
            {`${listeningSession.label} + ${readingSession.label}`}
          </div>
          <div className="mt-4 flex items-end gap-3">
            <div className="font-mono text-6xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
              {totalScore}
            </div>
            <div className="pb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              {copy.scoreTotalLabel}
            </div>
          </div>
          <div className="mt-5 grid auto-rows-fr gap-3 sm:grid-cols-3">
            <ScoreStat label={copy.scoreListeningLabel} value={`${listeningEstimate.scaled}`} />
            <ScoreStat label={copy.scoreReadingLabel} value={`${readingEstimate.scaled}`} />
            <ScoreStat label={copy.scoreAccuracy} value={`${(((listeningEstimate.rawCorrect + readingEstimate.rawCorrect) / 200) * 100).toFixed(1)}%`} />
          </div>
        </div>

        <ScoreTrendChart data={trendData} lineColor={lineColor} lineLabel={copy.scoreTotalLabel} />
      </div>
      <div className="grid auto-rows-fr gap-3">
        <ScoreStatCard
          label={`${copy.scoreListeningLabel} · ${listeningSession.label}`}
          rawCorrect={listeningEstimate.rawCorrect}
          mistakes={listeningEstimate.mistakes}
          scaled={listeningEstimate.scaled}
        />
        <ScoreStatCard
          label={`${copy.scoreReadingLabel} · ${readingSession.label}`}
          rawCorrect={readingEstimate.rawCorrect}
          mistakes={readingEstimate.mistakes}
          scaled={readingEstimate.scaled}
        />
        <ScoreStat
          label={locale === 'zh' ? '目标分区' : 'Score band'}
          value={formatScoreBand(totalScore)}
        />
      </div>
    </div>
  );
}

function EstimatePlaceholder() {
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);

  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-[24px] border border-dashed border-zinc-200/80 bg-zinc-50/80 px-6 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
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

function ModeButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? 'border-amber-400/45 bg-amber-400/12 text-amber-700 dark:text-amber-300'
          : 'border-zinc-200/80 bg-white/80 text-zinc-500 hover:text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-400 dark:hover:text-zinc-200'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function ScoreStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-200/70 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">{label}</div>
      <div className="mt-1.5 font-mono text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{value}</div>
    </div>
  );
}

function ScoreStatCard({
  label,
  rawCorrect,
  mistakes,
  scaled,
}: {
  label: string;
  rawCorrect: number;
  mistakes: number;
  scaled: number;
}) {
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);

  return (
    <div className="flex h-full flex-col rounded-[22px] border border-zinc-200/70 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="font-mono text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{scaled}</div>
        <div className="text-right text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
          <div>{rawCorrect}/100</div>
          <div>{mistakes} {copy.scoreMistakes}</div>
        </div>
      </div>
    </div>
  );
}

function ScoreTrendChart({
  data,
  lineColor,
  lineLabel,
}: {
  data: ScoreTrendPoint[];
  lineColor: string;
  lineLabel: string;
}) {
  const locale = useStore((state) => state.locale);
  const availablePoints = data.filter((point) => point.score !== undefined);
  const latest = [...availablePoints].reverse()[0];
  const best = [...availablePoints].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  if (availablePoints.length === 0) {
    return <EstimatePlaceholder />;
  }

  return (
    <div className="rounded-[24px] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
            {locale === 'zh' ? '估分折线图' : 'Score Trend'}
          </div>
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {locale === 'zh' ? '跟随当前模式观察分数走势。' : 'Track the score trajectory for the active mode.'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="rounded-full border border-zinc-200/80 bg-zinc-50 px-3 py-1 dark:border-zinc-800 dark:bg-zinc-900">
            {locale === 'zh' ? '最新' : 'Latest'} {latest?.score ?? '--'}
          </span>
          <span className="rounded-full border border-zinc-200/80 bg-zinc-50 px-3 py-1 dark:border-zinc-800 dark:bg-zinc-900">
            {locale === 'zh' ? '最佳' : 'Best'} {best?.score ?? '--'}
          </span>
        </div>
      </div>

      <div className="mt-4 h-60">
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
                item?.payload?.rawCorrect !== undefined
                  ? locale === 'zh'
                    ? `Raw ${item.payload.rawCorrect}`
                    : `Raw ${item.payload.rawCorrect}`
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
                const { cx, cy, payload } = props;

                if (cx === undefined || cy === undefined || !payload || payload.score === undefined) {
                  return <g />;
                }

                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={payload.active ? 5.5 : 3.5}
                    fill={lineColor}
                    stroke={payload.active ? '#111827' : '#ffffff'}
                    strokeWidth={payload.active ? 2 : 1.5}
                  />
                );
              }}
              activeDot={{ r: 6, fill: '#111827', stroke: lineColor, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatScoreBand(score: number) {
  if (score >= 850) return '850+';
  if (score >= 750) return '750-845';
  if (score >= 650) return '650-745';
  if (score >= 550) return '550-645';
  return '< 550';
}
