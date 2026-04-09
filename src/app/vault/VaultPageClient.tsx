'use client';

import dynamic from 'next/dynamic';

import { DashboardShell, DeferredPanelPlaceholder, SectionShell, useDashboardContext } from '@/components/DashboardShell';

const DataVaultPanel = dynamic(
  () => import('@/components/DataVaultPanel').then((module) => module.DataVaultPanel),
  { loading: () => <DeferredPanelPlaceholder /> }
);

export default function VaultPageClient() {
  return (
    <DashboardShell variant="compact">
      <VaultPageContent />
    </DashboardShell>
  );
}

function VaultPageContent() {
  const { locale, copy } = useDashboardContext();

  return (
    <SectionShell
      index="01"
      title={copy.dataVaultTitle}
      description={copy.dataVaultDescription}
    >
      <DataVaultPanel />
    </SectionShell>
  );
}