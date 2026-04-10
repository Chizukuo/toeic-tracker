'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

import { DashboardShell, DeferredPanelPlaceholder, useDashboardContext } from '@/components/DashboardShell';
import { cn } from '@/lib/utils';
import { Activity, Calculator, ListChecks } from 'lucide-react';
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

type InsightsTab = 'condition' | 'prediction' | 'action';

const tabMeta: Record<InsightsTab, { zh: string; en: string; desc_zh: string; desc_en: string; icon: typeof Activity }> = {
  condition: {
    zh: '诊断',
    en: 'Condition',
    desc_zh: '趋势分析与短板识别 — 了解你现在的水平',
    desc_en: 'Trend analysis & weakness identification',
    icon: Activity,
  },
  prediction: {
    zh: '预测',
    en: 'Prediction',
    desc_zh: '分数估算与 CEFR 分级 — 预测考试表现',
    desc_en: 'Score estimation with CEFR projection',
    icon: Calculator,
  },
  action: {
    zh: '行动',
    en: 'Action',
    desc_zh: '未完成题追踪 — 明确提分行动',
    desc_en: 'Unfinished items — clear next actions',
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
  const { locale } = useDashboardContext();
  const [tab, setTab] = useState<InsightsTab>('condition');

  const tabs: InsightsTab[] = ['condition', 'prediction', 'action'];
  const currentMeta = tabMeta[tab];

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="px-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--label-primary)]">
          {locale === 'zh' ? '参考台' : 'Insights'}
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
                className={cn(
                  'relative flex flex-1 items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-semibold transition-all',
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

      {/* Tab content with transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {tab === 'condition' && <AnalyticsDashboard />}
          {tab === 'prediction' && <ScoreEstimatorPanel />}
          {tab === 'action' && <UnfinishedTrackerPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
