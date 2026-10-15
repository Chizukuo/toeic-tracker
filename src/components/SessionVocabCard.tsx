'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, BookOpen, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import { AddEntryForm } from '@/components/vocabulary/AddEntryForm';
import type { Locale } from '@/lib/i18n';
import type { SessionRecord } from '@/lib/toeic';
import { useStore } from '@/store/useStore';

/**
 * Captures vocabulary while the user is still looking at the answer key, so it is linked
 * to the set it came from without a detour to the vocab page.
 */
export function SessionVocabCard({ session, locale }: { session: SessionRecord; locale: Locale }) {
  const vocabularyEntries = useStore((state) => state.vocabularyEntries);
  const updateVocabularyEntry = useStore((state) => state.updateVocabularyEntry);

  const sessionEntries = useMemo(
    () =>
      vocabularyEntries
        .filter((entry) => entry.sessionIds.includes(session.id))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [session.id, vocabularyEntries]
  );

  const detachFromSession = (entryId: string, sessionIds: string[]) => {
    updateVocabularyEntry(entryId, { sessionIds: sessionIds.filter((id) => id !== session.id) });
  };

  return (
    <div className="cheese-card p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-full bg-[var(--cheese-gold-soft)]">
            <BookOpen className="size-4 text-[var(--cheese-gold)]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--label-primary)]">
              {locale === 'zh' ? `顺手记下 ${session.label} 的生词` : `Capture words from ${session.label}`}
            </h3>
            <p className="text-xs text-[var(--label-tertiary)]">
              {locale === 'zh'
                ? '回车添加，自动查词并关联本套；已有的词会累计遇见次数。'
                : 'Press Enter to add. Definitions are looked up and linked to this set; repeats bump the count.'}
            </p>
          </div>
        </div>
        <Link
          href="/vocab"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--label-secondary)] transition-colors hover:text-[var(--label-primary)]"
        >
          {locale === 'zh' ? '生词本' : 'Vocab'}
          <ArrowRight className="size-3" />
        </Link>
      </div>

      <AddEntryForm locale={locale} activeSessionId={session.id} />

      {sessionEntries.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={locale === 'zh' ? '本套生词' : 'Words from this set'}>
          <AnimatePresence initial={false}>
            {sessionEntries.map((entry) => (
              <motion.li
                key={entry.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--separator)] bg-[var(--surface-grouped)] py-1 pl-3 pr-1 text-xs"
                title={entry.definition ?? entry.enDefinition ?? entry.text}
              >
                <span className="truncate font-medium text-[var(--label-primary)]">{entry.text}</span>
                {entry.definition && (
                  <span className="hidden max-w-40 truncate text-[var(--label-tertiary)] sm:inline">{entry.definition}</span>
                )}
                {entry.encounterCount > 1 && (
                  <span className="rounded-full bg-amber-500/15 px-1.5 font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    ×{entry.encounterCount}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => detachFromSession(entry.id, entry.sessionIds)}
                  aria-label={locale === 'zh' ? `从本套移除 ${entry.text}` : `Unlink ${entry.text} from this set`}
                  className="flex size-5 items-center justify-center rounded-full text-[var(--label-tertiary)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--label-primary)]"
                >
                  <X className="size-3" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
