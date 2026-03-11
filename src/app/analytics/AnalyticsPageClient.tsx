'use client';

import dynamic from 'next/dynamic';

import { DashboardShell, DeferredPanelPlaceholder, SectionShell, useDashboardContext } from '@/components/DashboardShell';

const AnalyticsDashboard = dynamic(
  () => import('@/components/AnalyticsDashboard').then((module) => module.AnalyticsDashboard),
  { loading: () => <DeferredPanelPlaceholder /> }
);

export default function AnalyticsPageClient() {
  return (
    <DashboardShell variant="compact">
      <AnalyticsPageContent />
    </DashboardShell>
  );
}

function AnalyticsPageContent() {
  const { locale, copy } = useDashboardContext();

  return (
    <SectionShell
      index="01"
      title={copy.analyticsTitle}
      description={locale === 'zh' ? '查看趋势、短板和高频错因。' : 'Review trend, weak spots, and root causes.'}
    >
      <AnalyticsDashboard />
    </SectionShell>
  );
}