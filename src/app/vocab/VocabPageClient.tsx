'use client';

import { DashboardShell } from '@/components/DashboardShell';
import { VocabularyPanel } from '@/components/VocabularyPanel';

export default function VocabPageClient() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl pb-16 pt-8 sm:pb-24 sm:pt-12 px-4 sm:px-6">
        <VocabularyPanel />
      </div>
    </DashboardShell>
  );
}
