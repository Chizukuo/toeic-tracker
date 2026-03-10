'use client';

import { DashboardShell, SectionShell, useDashboardContext } from '@/components/DashboardShell';
import { SprintDashboard } from '@/components/SprintDashboard';

export default function PlanPage() {
  return (
    <DashboardShell variant="compact">
      <PlanPageContent />
    </DashboardShell>
  );
}

function PlanPageContent() {
  const { locale, copy } = useDashboardContext();

  return (
    <SectionShell
      index="01"
      title={copy.dashboardTitle}
      description={locale === 'zh' ? '选择 session，切换到对应工作区。' : 'Select a session to switch the workspace.'}
    >
      <SprintDashboard />
    </SectionShell>
  );
}