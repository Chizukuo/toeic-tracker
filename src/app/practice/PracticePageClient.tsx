'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import { DebugForm } from '@/components/DebugForm';
import { SessionVocabCard } from '@/components/SessionVocabCard';
import { DashboardShell, DeferredPanelPlaceholder, useDashboardContext } from '@/components/DashboardShell';
import { LapTimer } from '@/components/LapTimer';
import { formatSessionTitle, translatePart, translateStatus } from '@/lib/i18n';
import { estimateToeicSessionScore, getIncorrectAnswers, getPartsForType, PART_QUESTION_COUNTS } from '@/lib/toeic';
import { getNextStepRecommendation } from '@/lib/nextStep';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, Clock, FileText, PencilLine, Trophy } from 'lucide-react';

const TimeWaterfallChart = dynamic(
  () => import('@/components/TimeWaterfallChart').then((module) => module.TimeWaterfallChart),
  { loading: () => <DeferredPanelPlaceholder /> }
);

type PracticeStep = 'timer' | 'review' | 'result';

function resolvePracticeStep(session: ReturnType<typeof useDashboardContext>['activeSession']): PracticeStep {
  const unresolvedBacklog = session.type === 'R'
    && (session.timerSummary?.unfinishedQuestions ?? 0) > 0
    && !session.timerSummary?.resolvedUnfinished;

  if (unresolvedBacklog) return 'timer';
  if (session.timerRuntime?.startedAt && !session.timerSummary) return 'timer';
  if (session.status === 'debugged') return 'result';
  if (session.timerSummary || session.status === 'in-progress') return 'review';
  return 'timer';
}

function isStepAvailable(session: ReturnType<typeof useDashboardContext>['activeSession'], step: PracticeStep) {
  // A live attempt (running clock or pending submit) must be finished on the timer step first.
  if (session.timerRuntime) return step === 'timer';
  if (step === 'review') return Boolean(session.timerSummary) || session.status !== 'not-started';
  if (step === 'result') return session.status === 'debugged';
  return true;
}

const slideVariants = {
  enterFromRight: { opacity: 0, x: 60 },
  enterFromLeft: { opacity: 0, x: -60 },
  center: { opacity: 1, x: 0 },
  exitToLeft: { opacity: 0, x: -60 },
  exitToRight: { opacity: 0, x: 60 },
};

export default function PracticePageClient() {
  return (
    <DashboardShell>
      <PracticeFlow />
    </DashboardShell>
  );
}

function PracticeFlow() {
  const { activeSession, locale, sessions } = useDashboardContext();
  const selectSession = useStore((state) => state.selectSession);
  const historicalScoreCount = useStore((state) => state.historicalScores.length);

  const [step, setStep] = useState<PracticeStep>(() => resolvePracticeStep(activeSession));
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [autoFocusToken, setAutoFocusToken] = useState(0);

  const [prevSessionId, setPrevSessionId] = useState(activeSession.id);
  if (activeSession.id !== prevSessionId) {
    setPrevSessionId(activeSession.id);
    setDirection('forward');
    setStep(resolvePracticeStep(activeSession));
  }

  const goToStep = (next: PracticeStep) => {
    const order: PracticeStep[] = ['timer', 'review', 'result'];
    setDirection(order.indexOf(next) > order.indexOf(step) ? 'forward' : 'backward');
    setStep(next);
  };

  // Same engine as the home page, so "next set" here never contradicts the home recommendation.
  const nextSession = useMemo(() => {
    const recommendation = getNextStepRecommendation({
      locale,
      sessions,
      activeSessionId: activeSession.id,
      historicalScoreCount,
    });
    const target = recommendation.href === '/practice' ? recommendation.targetSessionId : undefined;
    return target && target !== activeSession.id ? sessions.find((session) => session.id === target) ?? null : null;
  }, [activeSession.id, historicalScoreCount, locale, sessions]);

  const advanceToNext = () => {
    if (nextSession) {
      selectSession(nextSession.id);
      setDirection('forward');
      setStep('timer');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const resultData = useMemo(() => {
    if (activeSession.status !== 'debugged') return null;
    const estimate = estimateToeicSessionScore(activeSession, 'strict');
    // Unanswered reading questions count as wrong, matching the score estimate above.
    const totalMistakes = getIncorrectAnswers(activeSession, 'strict');
    const unanswered = activeSession.type === 'R' ? activeSession.timerSummary?.unfinishedQuestions ?? 0 : 0;

    // Compare against the closest earlier reviewed set of the same section.
    const previous = sessions
      .filter(
        (s) =>
          s.type === activeSession.type &&
          s.status === 'debugged' &&
          s.setNumber < activeSession.setNumber
      )
      .sort((a, b) => b.setNumber - a.setNumber)[0];
    const comparison = previous
      ? { label: previous.label, delta: estimate.scaled - estimateToeicSessionScore(previous, 'strict').scaled }
      : null;

    // The part that cost the most this time, as a concrete thing to drill next.
    let biggestLoss: { part: ReturnType<typeof getPartsForType>[number]; mistakes: number; rate: number } | null = null;
    for (const part of getPartsForType(activeSession.type)) {
      const mistakes = Math.min(activeSession.mistakes[part] ?? 0, PART_QUESTION_COUNTS[part]);
      const rate = mistakes / PART_QUESTION_COUNTS[part];
      if (mistakes > 0 && (!biggestLoss || rate > biggestLoss.rate)) {
        biggestLoss = { part, mistakes, rate };
      }
    }

    return { estimate, totalMistakes, unanswered, accuracy: Math.round(100 - totalMistakes), comparison, biggestLoss };
  }, [activeSession, sessions]);

  const steps: { key: PracticeStep; label: string; icon: typeof Clock }[] = [
    { key: 'timer', label: locale === 'zh' ? '计时' : 'Timer', icon: Clock },
    { key: 'review', label: locale === 'zh' ? '对答案' : 'Check', icon: FileText },
    { key: 'result', label: locale === 'zh' ? '结果' : 'Result', icon: Trophy },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      {/* ─── Step Indicator Bar ─── */}
      <div className="cheese-card p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isActive = step === s.key;
              const isDone = idx < stepIndex;
              const isAvailable = !isActive && isStepAvailable(activeSession, s.key);
              return (
                <div key={s.key} className="flex items-center gap-1">
                  {idx > 0 && (
                    <div className={cn(
                      'mx-0.5 h-px w-3 sm:mx-1 sm:w-10 transition-colors',
                      isDone ? 'bg-emerald-500' : 'bg-[var(--separator-opaque)]'
                    )} />
                  )}
                  <button
                    type="button"
                    onClick={() => goToStep(s.key)}
                    disabled={!isAvailable}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={s.label}
                    title={s.label}
                    className={cn(
                      'flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1.5 text-xs font-semibold sm:gap-1.5 sm:px-3 transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--cheese-gold)]/50',
                      isActive
                        ? 'bg-[var(--cheese-gold-soft)] text-[var(--cheese-gold)]'
                        : isDone
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-[var(--label-tertiary)]',
                      isAvailable ? 'cursor-pointer hover:bg-[var(--surface-grouped)]' : !isActive && 'cursor-default opacity-60'
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span>{s.label}</span>
                  </button>
                </div>
              );
            })}
          </div>

          <Link
            href="/"
            title={locale === 'zh' ? '回首页换一套' : 'Pick another set on Home'}
            className="cheese-pill shrink-0 whitespace-nowrap transition-opacity hover:opacity-80"
          >
            {activeSession.label}
            <span className="hidden sm:inline"> · {formatSessionTitle(locale, activeSession)}</span>
          </Link>
        </div>
      </div>

      {/* ─── Content with horizontal slide transitions ─── */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          initial={direction === 'forward' ? 'enterFromRight' : 'enterFromLeft'}
          animate="center"
          exit={direction === 'forward' ? 'exitToLeft' : 'exitToRight'}
          variants={slideVariants}
          transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        >
          {step === 'timer' && (
            <div className="cheese-card overflow-hidden p-6 sm:p-8">
              <LapTimer
                key={`timer-${activeSession.id}`}
                session={activeSession}
                onStrictAttemptSaved={() => {
                  setAutoFocusToken((v) => v + 1);
                  goToStep('review');
                }}
                onBacklogSkipped={() => goToStep('result')}
              />
            </div>
          )}

          {step === 'review' && (
            <div>
              <DebugForm
                key={`debug-${activeSession.id}`}
                activeSession={activeSession}
                autoFocusToken={autoFocusToken}
                onReviewSaved={(nextStep) => {
                  if (nextStep === 'unfinished') {
                    goToStep('timer');
                    return;
                  }

                  goToStep('result');
                }}
              />
            </div>
          )}

          {step === 'review' && (
            <div className="mt-6">
              <SessionVocabCard session={activeSession} locale={locale} />
            </div>
          )}

          {step === 'result' && (
            <div className="space-y-6">
              <div className="relative cheese-card overflow-hidden p-8 sm:p-10 text-center">
                {/* Gradient accent bar */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />

                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.15, type: 'spring', bounce: 0.5 }}
                >
                  <CheckCircle2 className="mx-auto size-16 text-emerald-500 drop-shadow-[0_4px_12px_rgba(16,185,129,0.3)]" />
                </motion.div>

                <h2 className="mt-5 text-2xl font-bold text-[var(--label-primary)]">
                  {activeSession.label} {locale === 'zh' ? '已完成' : 'Complete'}
                </h2>

                <p className="mt-2 text-sm text-[var(--label-secondary)]">
                  {formatSessionTitle(locale, activeSession)} · {translateStatus(locale, activeSession.status)}
                </p>

                {resultData && (
                  <div className="mx-auto mt-7 grid max-w-md gap-4 sm:grid-cols-2">
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="cheese-grouped rounded-[16px] p-5"
                    >
                      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
                        {locale === 'zh' ? '估分' : 'Score'}
                      </div>
                      <div className="mt-2 text-4xl font-bold text-[var(--cheese-gold)]">
                        {resultData.estimate.scaled}
                      </div>
                      <div className="mt-1 text-xs text-[var(--label-secondary)]">
                        {resultData.estimate.interval.min}–{resultData.estimate.interval.max} · {resultData.estimate.cefr}
                      </div>
                      {resultData.comparison && (
                        <div
                          className={cn(
                            'mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            resultData.comparison.delta > 0
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : resultData.comparison.delta < 0
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                : 'bg-[var(--surface-grouped)] text-[var(--label-secondary)]'
                          )}
                        >
                          {locale === 'zh' ? `较 ${resultData.comparison.label} ` : `vs ${resultData.comparison.label} `}
                          {resultData.comparison.delta > 0 ? '+' : ''}
                          {resultData.comparison.delta}
                        </div>
                      )}
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="cheese-grouped rounded-[16px] p-5"
                    >
                      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
                        {locale === 'zh' ? '错题数' : 'Wrong'}
                      </div>
                      <div className="mt-2 text-4xl font-bold text-[var(--label-primary)]">
                        {resultData.totalMistakes}
                      </div>
                      <div className="mt-1 text-xs text-[var(--label-secondary)]">
                        {locale === 'zh' ? `正确率 ${resultData.accuracy}%` : `Accuracy ${resultData.accuracy}%`}
                        {resultData.unanswered > 0 &&
                          (locale === 'zh' ? ` · 含 ${resultData.unanswered} 题没做` : ` · incl. ${resultData.unanswered} unanswered`)}
                      </div>
                    </motion.div>
                  </div>
                )}

                {resultData?.biggestLoss && (
                  <p className="mx-auto mt-4 max-w-md text-sm text-[var(--label-secondary)]">
                    {locale === 'zh' ? '本套最大失分：' : 'Biggest loss this set: '}
                    <span className="font-semibold text-[var(--label-primary)]">
                      {translatePart(locale, resultData.biggestLoss.part)}
                    </span>
                    {' · '}
                    {locale === 'zh'
                      ? `错 ${resultData.biggestLoss.mistakes}/${PART_QUESTION_COUNTS[resultData.biggestLoss.part]}`
                      : `${resultData.biggestLoss.mistakes}/${PART_QUESTION_COUNTS[resultData.biggestLoss.part]} wrong`}
                  </p>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center"
                >
                  {nextSession && (
                    <button
                      type="button"
                      onClick={advanceToNext}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--cheese-gold)] px-7 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(217,119,6,0.30)] transition-all hover:shadow-[0_6px_20px_rgba(217,119,6,0.40)] hover:brightness-110 active:scale-[0.97] dark:text-zinc-900"
                    >
                      {locale === 'zh' ? `下一套 ${nextSession.label}` : `Next: ${nextSession.label}`}
                      <ArrowRight className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => goToStep('review')}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--separator)] px-6 py-3 text-sm font-semibold text-[var(--label-secondary)] transition-all hover:text-[var(--label-primary)] hover:bg-[var(--surface-grouped)] active:scale-[0.97]"
                  >
                    <PencilLine className="size-4" />
                    {locale === 'zh' ? '修改错题数' : 'Edit answers'}
                  </button>
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--separator)] px-6 py-3 text-sm font-semibold text-[var(--label-secondary)] transition-all hover:text-[var(--label-primary)] hover:bg-[var(--surface-grouped)] active:scale-[0.97]"
                  >
                    {locale === 'zh' ? '回首页' : 'Home'}
                  </Link>
                </motion.div>
              </div>

              <SessionVocabCard session={activeSession} locale={locale} />

              <TimeWaterfallChart session={activeSession} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
