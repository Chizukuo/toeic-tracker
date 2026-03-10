'use client';

import dynamic from 'next/dynamic';

import { DashboardShell, DeferredPanelPlaceholder, SectionShell, useDashboardContext } from '@/components/DashboardShell';

const ScoreEstimatorPanel = dynamic(
  () => import('@/components/ScoreEstimatorPanel').then((module) => module.ScoreEstimatorPanel),
  { loading: () => <DeferredPanelPlaceholder /> }
);

export default function ScoresPage() {
  return (
    <DashboardShell variant="compact">
      <ScoresPageContent />
    </DashboardShell>
  );
}

function ScoresPageContent() {
  const { locale, copy } = useDashboardContext();

  return (
    <SectionShell
      index="01"
      title={copy.scoreEstimatorTitle}
      description={locale === 'zh' ? '按套次查看听力、阅读和总分估算。' : 'View listening, reading, and total estimates.'}
    >
      <ScoreEstimatorPanel />
    </SectionShell>
  );
}