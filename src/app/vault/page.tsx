'use client';

import dynamic from 'next/dynamic';

import { DashboardShell, DeferredPanelPlaceholder, SectionShell, useDashboardContext } from '@/components/DashboardShell';

const DataVaultPanel = dynamic(
  () => import('@/components/DataVaultPanel').then((module) => module.DataVaultPanel),
  { loading: () => <DeferredPanelPlaceholder /> }
);

export default function VaultPage() {
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
      description={locale === 'zh' ? '备份、恢复或重置本地数据。' : 'Backup, restore, or reset local data.'}
    >
      <DataVaultPanel />
    </SectionShell>
  );
}