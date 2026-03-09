'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Calculator, CircleGauge, Headphones, LibraryBig, Sigma } from 'lucide-react';

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

export function ScoreEstimatorPanel() {
  const { sessions, locale } = useStore();
  const copy = getCopy(locale);

  const listeningSessions = useMemo(() => sessions.filter((session) => session.type === 'L'), [sessions]);
  const readingSessions = useMemo(() => sessions.filter((session) => session.type === 'R'), [sessions]);

  const [mode, setMode] = useState<ScoreMode>('L');
  const [selectedListeningId, setSelectedListeningId] = useState('L1');
  const [selectedReadingId, setSelectedReadingId] = useState('R1');
  const [selectedPair, setSelectedPair] = useState('1');

  const selectedListening = listeningSessions.find((session) => session.id === selectedListeningId) ?? listeningSessions[0];
  const selectedReading = readingSessions.find((session) => session.id === selectedReadingId) ?? readingSessions[0];
  const selectedPairListening = listeningSessions.find((session) => session.id === `L${selectedPair}`) ?? listeningSessions[0];
  const selectedPairReading = readingSessions.find((session) => session.id === `R${selectedPair}`) ?? readingSessions[0];

  const listeningEstimate = selectedListening ? buildEstimate(selectedListening) : undefined;
  const readingEstimate = selectedReading ? buildEstimate(selectedReading) : undefined;
  const pairListeningEstimate = selectedPairListening ? buildEstimate(selectedPairListening) : undefined;
  const pairReadingEstimate = selectedPairReading ? buildEstimate(selectedPairReading) : undefined;
  const pairAvailable = Boolean(pairListeningEstimate?.available && pairReadingEstimate?.available);
  const totalScore = pairAvailable
    ? (pairListeningEstimate?.scaled ?? 0) + (pairReadingEstimate?.scaled ?? 0)
    : 0;

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
      <CardContent className="grid gap-4 p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
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
            <p className="mt-4 text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
              {copy.scoreEstimatorNote}
            </p>
          </div>
        </div>

        {mode === 'L' && listeningEstimate && selectedListening ? (
          <SectionEstimateView
            copyLabel={copy.scoreListeningLabel}
            sessionLabel={selectedListening.label}
            estimate={listeningEstimate}
          />
        ) : mode === 'R' && readingEstimate && selectedReading ? (
          <SectionEstimateView
            copyLabel={copy.scoreReadingLabel}
            sessionLabel={selectedReading.label}
            estimate={readingEstimate}
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
}: {
  copyLabel: string;
  sessionLabel: string;
  estimate: SectionEstimate;
}) {
  const locale = useStore((state) => state.locale);
  const copy = getCopy(locale);

  if (!estimate.available) {
    return <EstimatePlaceholder />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_320px]">
      <div className="rounded-[24px] border border-zinc-200/70 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
          {copyLabel} · {sessionLabel}
        </div>
        <div className="mt-4 flex items-end gap-3">
          <div className="font-mono text-6xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            {estimate.scaled}
          </div>
          <div className="pb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            {copy.scoreScaled}
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ScoreStat label={copy.scoreRawCorrect} value={`${estimate.rawCorrect}/100`} />
          <ScoreStat label={copy.scoreMistakes} value={`${estimate.mistakes}`} />
          <ScoreStat label={copy.scoreAccuracy} value={`${estimate.accuracy}%`} />
        </div>
      </div>
      <div className="rounded-[24px] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-400/12 text-amber-700 dark:text-amber-300">
          <Calculator className="size-4.5" />
        </div>
        <div className="mt-4 text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {copy.scoreEstimatorTitle}
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {copy.scoreEstimatorNote}
        </p>
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
}: {
  copy: ReturnType<typeof getCopy>;
  listeningSession?: SessionRecord;
  readingSession?: SessionRecord;
  listeningEstimate?: SectionEstimate;
  readingEstimate?: SectionEstimate;
  totalScore: number;
  available: boolean;
}) {
  if (!available || !listeningEstimate || !readingEstimate || !listeningSession || !readingSession) {
    return <EstimatePlaceholder />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_320px]">
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
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ScoreStat label={copy.scoreListeningLabel} value={`${listeningEstimate.scaled}`} />
          <ScoreStat label={copy.scoreReadingLabel} value={`${readingEstimate.scaled}`} />
          <ScoreStat label={copy.scoreAccuracy} value={`${(((listeningEstimate.rawCorrect + readingEstimate.rawCorrect) / 200) * 100).toFixed(1)}%`} />
        </div>
      </div>
      <div className="grid gap-3">
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
    <div className="rounded-2xl border border-zinc-200/70 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/70">
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
    <div className="rounded-[22px] border border-zinc-200/70 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
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
