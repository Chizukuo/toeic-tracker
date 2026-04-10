'use client';

import { DashboardShell } from '@/components/DashboardShell';
import { VocabularyPanel } from '@/components/VocabularyPanel';

export default function VocabPageClient() {
  return (
    <DashboardShell>
      <VocabularyPanel />
    </DashboardShell>
  );
}
