'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { DashboardShell, DeferredPanelPlaceholder, useDashboardContext } from '@/components/DashboardShell';
import { cn } from '@/lib/utils';
import { Activity, ArrowRight, BarChart2, Calculator, ListChecks, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AnalyticsDashboard = dynamic(
  () => import('@/components/AnalyticsDashboard').then((m) => m.AnalyticsDashboard),
  { loading: () => <DeferredPanelPlaceholder /> }
);

const ScoreEstimatorPanel = dynamic(
  () => import('@/components/ScoreEstimatorPanel').then((m) => m.ScoreEstimatorPanel),
  { loading: () => <DeferredPanelPlaceholder /> }
);

const UnfinishedTrackerPanel = dynamic(
  () => import('@/components/UnfinishedTrackerPanel').then((m) => m.UnfinishedTrackerPanel),
  { loading: () => <DeferredPanelPlaceholder /> }
);

const TimeAnalyticsPanel = dynamic(
  () => import('@/app/insights/TimeAnalyticsPanel').then((m) => m.TimeAnalyticsPanel),
  { loading: () => <DeferredPanelPlaceholder /> }
);

type InsightsTab = 'condition' | 'prediction' | 'action' | 'time';

const tabMeta: Record<InsightsTab, { zh: string; en: string; desc_zh: string; desc_en: string; icon: typeof Activity }> = {
  condition: {
    zh: '弱项',
    en: 'Weak spots',
    desc_zh: '看看哪些题型最容易错，以及错因有没有在减少',
    desc_en: 'Which question types you miss most, and whether that is improving',
    icon: Activity,
  },
  prediction: {
    zh: '估分',
    en: 'Score',
    desc_zh: '按你填的错题数估算考试分数，也可以记录模考或真考成绩',
    desc_en: 'An estimated test score from your mistakes; you can also log mock or real scores',
    icon: Calculator,
  },
  time: {
    zh: '用时',
    en: 'Pacing',
    desc_zh: '阅读每个 Part 花了多少时间，哪里拖慢了你',
    desc_en: 'How long each reading Part took, and where you slow down',
    icon: Timer,
  },
  action: {
    zh: '没做完',
    en: 'Unfinished',
    desc_zh: '阅读里没来得及做的题，集中在这里处理',
    desc_en: 'Reading questions you ran out of time for, in one place',
    icon: ListChecks,
  },
};

export default function InsightsPageClient() {
  return (
    <DashboardShell>
      <InsightsContent />
    </DashboardShell>
  );
}

function InsightsContent() {
  const { locale, sessions } = useDashboardContext();
  const [tab, setTab] = useState<InsightsTab>('condition');
  const [browseAnyway, setBrowseAnyway] = useState(false);
  const hasReviewedSet = sessions.some((session) => session.status === 'debugged');

  // Five empty charts teach a newcomer nothing; explain what unlocks them instead.
  if (!hasReviewedSet && !browseAnyway) {
    return (
      <div className="space-y-6">
        <div className="px-1">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--label-primary)]">
            {locale === 'zh' ? '分析' : 'Insights'}
          </h1>
        </div>
        <div className="cheese-card flex flex-col items-center px-6 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--cheese-gold-soft)]">
            <BarChart2 className="size-6 text-[var(--cheese-gold)]" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[var(--label-primary)]">
            {locale === 'zh' ? '做完第一套，这里就有内容了' : 'Finish your first set to unlock this page'}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--label-secondary)]">
            {locale === 'zh'
              ? '对完答案、填好错题数之后，这里会显示你的估分、最容易错的题型，以及阅读每个 Part 的用时。'
              : 'Once you check answers and enter your mistakes, you will see a score estimate, your weakest question types, and time per reading Part.'}
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/practice"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--cheese-gold)] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(217,119,6,0.30)] transition-all hover:brightness-110 dark:text-zinc-900"
            >
              {locale === 'zh' ? '去做第一套' : 'Start your first set'}
              <ArrowRight className="size-4" />
            </Link>
            <button
              type="button"
              onClick={() => {
                setTab('prediction');
                setBrowseAnyway(true);
              }}
              className="text-sm text-[var(--label-secondary)] underline-offset-2 hover:text-[var(--label-primary)] hover:underline"
            >
              {locale === 'zh' ? '已经考过？先记录成绩' : 'Already have a score? Record it'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs: InsightsTab[] = ['condition', 'prediction', 'time', 'action'];
  const currentMeta = tabMeta[tab];

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="px-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--label-primary)]">
          {locale === 'zh' ? '分析' : 'Insights'}
        </h1>
        <p className="mt-1 text-sm text-[var(--label-secondary)]">
          {locale === 'zh' ? currentMeta.desc_zh : currentMeta.desc_en}
        </p>
      </div>

      {/* Segmented control */}
      <div className="cheese-card p-1.5">
        <div className="flex gap-1">
          {tabs.map((t) => {
            const meta = tabMeta[t];
            const Icon = meta.icon;
            const isActive = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-pressed={isActive}
                className={cn(
                  'relative flex flex-1 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-[14px] px-1 py-2.5 text-xs font-semibold transition-all sm:flex-row sm:gap-2 sm:px-4 sm:py-3 sm:text-sm',
                  isActive
                    ? 'text-[var(--label-primary)]'
                    : 'text-[var(--label-tertiary)] hover:text-[var(--label-secondary)]'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="insight-tab-bg"
                    className="absolute inset-0 rounded-[14px] bg-[var(--surface-grouped)] shadow-[var(--shadow-soft)]"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <Icon className="relative z-10 size-4" />
                <span className="relative z-10">{locale === 'zh' ? meta.zh : meta.en}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content wrapper with transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="w-full"
        >
          {tab === 'condition' && <AnalyticsDashboard />}
          {tab === 'prediction' && <ScoreEstimatorPanel />}
          {tab === 'time' && <TimeAnalyticsPanel />}
          {tab === 'action' && <UnfinishedTrackerPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
