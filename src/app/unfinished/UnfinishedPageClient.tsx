'use client';

import dynamic from 'next/dynamic';

import { DashboardShell, DeferredPanelPlaceholder, SectionShell, useDashboardContext } from '@/components/DashboardShell';

const UnfinishedTrackerPanel = dynamic(
  () => import('@/components/UnfinishedTrackerPanel').then((module) => module.UnfinishedTrackerPanel),
  { loading: () => <DeferredPanelPlaceholder /> }
);

export default function UnfinishedPageClient() {
  return (
    <DashboardShell variant="compact">
      <UnfinishedPageContent />
    </DashboardShell>
  );
}

function UnfinishedPageContent() {
  const { locale, copy } = useDashboardContext();

  return (
    <SectionShell
      index="01"
      title={copy.unfinishedTrackerTitle}
      description={locale === 'zh' ? '集中处理超时后遗留的题目。' : 'Handle leftover questions from timed runs.'}
    >
      <UnfinishedTrackerPanel />
    </SectionShell>
  );
}