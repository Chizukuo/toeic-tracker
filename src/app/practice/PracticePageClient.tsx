'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import { DebugForm } from '@/components/DebugForm';
import { DashboardShell, DeferredPanelPlaceholder, useDashboardContext } from '@/components/DashboardShell';
import { LapTimer } from '@/components/LapTimer';
import { formatSessionTitle, translateStatus } from '@/lib/i18n';
import { estimateToeicSessionScore, sumMistakes } from '@/lib/toeic';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, Clock, FileText, Trophy } from 'lucide-react';

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

  const advanceToNext = () => {
    const currentIndex = sessions.findIndex((s) => s.id === activeSession.id);
    const nextSession = sessions[currentIndex + 1];
    if (nextSession) {
      selectSession(nextSession.id);
      setDirection('forward');
      setStep('timer');
    }
  };

  const resultData = useMemo(() => {
    if (activeSession.status !== 'debugged') return null;
    const estimate = estimateToeicSessionScore(activeSession, 'strict');
    const totalMistakes = sumMistakes(activeSession);
    return { estimate, totalMistakes };
  }, [activeSession]);

  const nextSession = useMemo(() => {
    const currentIndex = sessions.findIndex((s) => s.id === activeSession.id);
    return sessions[currentIndex + 1] ?? null;
  }, [activeSession.id, sessions]);

  const steps: { key: PracticeStep; label: string; icon: typeof Clock }[] = [
    { key: 'timer', label: locale === 'zh' ? '计时' : 'Timer', icon: Clock },
    { key: 'review', label: locale === 'zh' ? '复盘' : 'Review', icon: FileText },
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
              return (
                <div key={s.key} className="flex items-center gap-1">
                  {idx > 0 && (
                    <div className={cn(
                      'mx-1 h-px w-6 sm:w-10 transition-colors',
                      isDone ? 'bg-emerald-500' : 'bg-[var(--separator-opaque)]'
                    )} />
                  )}
                  <div className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                    isActive
                      ? 'bg-[var(--cheese-gold-soft)] text-[var(--cheese-gold)]'
                      : isDone
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-[var(--label-tertiary)]'
                  )}>
                    <Icon className="size-3.5" />
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <span className="cheese-pill">{activeSession.label} · {formatSessionTitle(locale, activeSession)}</span>
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
                onFocusModeChange={() => {}}
                onStrictAttemptSaved={() => {
                  setAutoFocusToken((v) => v + 1);
                  goToStep('review');
                }}
              />
            </div>
          )}

          {step === 'review' && (
            <div className="cheese-card overflow-hidden p-6 sm:p-8">
              <div className="mb-6">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--label-tertiary)]">
                  {locale === 'zh' ? '复盘录入' : 'Review Input'}
                </div>
                <h2 className="mt-1.5 text-xl font-bold text-[var(--label-primary)]">
                  {locale === 'zh' ? '录入错题与错因' : 'Log Mistakes & Root Causes'}
                </h2>
              </div>
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
                onReviewUndone={() => {}}
              />
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
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="cheese-grouped rounded-[16px] p-5"
                    >
                      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
                        {locale === 'zh' ? '错题数' : 'Mistakes'}
                      </div>
                      <div className="mt-2 text-4xl font-bold text-[var(--label-primary)]">
                        {resultData.totalMistakes}
                      </div>
                      <div className="mt-1 text-xs text-[var(--label-secondary)]">
                        {locale === 'zh' ? `正确率 ${((1 - resultData.totalMistakes / 100) * 100).toFixed(0)}%` : `Accuracy ${((1 - resultData.totalMistakes / 100) * 100).toFixed(0)}%`}
                      </div>
                    </motion.div>
                  </div>
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
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--separator)] px-6 py-3 text-sm font-semibold text-[var(--label-secondary)] transition-all hover:text-[var(--label-primary)] hover:bg-[var(--surface-grouped)] active:scale-[0.97]"
                  >
                    {locale === 'zh' ? '回任务台' : 'Mission Control'}
                  </Link>
                </motion.div>
              </div>

              <TimeWaterfallChart session={activeSession} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
