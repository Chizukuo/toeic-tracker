'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, AlertTriangle, Loader2, RefreshCw, Check, Search } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { VocabularyEntry } from '@/lib/toeic';
import { cn } from '@/lib/utils';


import { VocabCard } from './vocabulary/VocabCard';
import { AddEntryForm } from './vocabulary/AddEntryForm';
import { FilterBar } from './vocabulary/FilterBar';
import { useVocabularyMigration } from './vocabulary/useVocabularyMigration';
import { getDaysSince } from './vocabulary/dictionary';

type FilterMode = 'all' | 'repeat' | 'recent';

// ─── Main Panel ──────────────────────────────────────────────────────────────


export function VocabularyPanel() {
  const vocabularyEntries = useStore((state) => state.vocabularyEntries);
  const removeVocabularyEntry = useStore((state) => state.removeVocabularyEntry);
  const updateVocabularyEntry = useStore((state) => state.updateVocabularyEntry);
  const recordVocabularyKnockdown = useStore((state) => state.recordVocabularyKnockdown);
  const recordVocabularyComeback = useStore((state) => state.recordVocabularyComeback);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const locale = useStore((state) => state.locale);

  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  const { performMigration, isMigrating, forceQueueCount, forceQueue } = useVocabularyMigration(
    vocabularyEntries,
    updateVocabularyEntry,
    locale
  );

  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [recallMode, setRecallMode] = useState(false);
  const [confirmGlobalReload, setConfirmGlobalReload] = useState(false);

  const handleGlobalRefresh = useCallback(() => {
    if (confirmGlobalReload) {
      setConfirmGlobalReload(false);
      performMigration(vocabularyEntries.map(e => e.id));
    } else {
      setConfirmGlobalReload(true);
      setTimeout(() => setConfirmGlobalReload(false), 3000);
    }
  }, [confirmGlobalReload, performMigration, vocabularyEntries]);

  const handleRecordKnockdown = useCallback((id: string) => {
    recordVocabularyKnockdown(id, activeSessionId);
  }, [recordVocabularyKnockdown, activeSessionId]);

  const handleRecordComeback = useCallback((id: string) => {
    recordVocabularyComeback(id, activeSessionId);
  }, [recordVocabularyComeback, activeSessionId]);

  const reviewQueue = useMemo(() => {
    return vocabularyEntries
      .map((entry) => {
        const knockdownCount = entry.knockdownCount ?? 0;
        const comebackCount = entry.comebackCount ?? 0;
        const unresolvedCount = Math.max(0, knockdownCount - comebackCount);
        const daysSinceKnockdown = entry.lastKnockdownAt ? getDaysSince(entry.lastKnockdownAt) : null;
        const freshnessBoost = daysSinceKnockdown === null ? 0 : Math.max(0, 5 - Math.min(daysSinceKnockdown, 5));
        const encounterSignal = Math.max(0, entry.encounterCount - 1);
        const priority = unresolvedCount * 10 + knockdownCount * 3 + freshnessBoost + encounterSignal;

        return {
          entry,
          priority,
          unresolvedCount,
          knockdownCount,
          comebackCount,
          daysSinceKnockdown,
        };
      })
      .filter((item) => item.priority > 0)
      .sort((a, b) =>
        b.priority - a.priority ||
        b.unresolvedCount - a.unresolvedCount ||
        (a.daysSinceKnockdown ?? Number.MAX_SAFE_INTEGER) - (b.daysSinceKnockdown ?? Number.MAX_SAFE_INTEGER)
      )
      .slice(0, 8);
  }, [vocabularyEntries]);

  const focusReviewWord = useCallback((word: string) => {
    setFilterMode('all');
    setSearchQuery(word);
    setRecallMode(true);
  }, []);

  const filtered = useMemo(() => {
    let list = [...vocabularyEntries];

    // Filter by mode
    if (filterMode === 'repeat') {
      list = list.filter((e) => e.encounterCount >= 2);
    } else if (filterMode === 'recent') {
      list = list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
    }

    // Sort: repeat offenders first, then by last encounter
    list = list.sort((a, b) => {
      if (a.encounterCount !== b.encounterCount) return b.encounterCount - a.encounterCount;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.text.toLowerCase().includes(q) ||
          e.definition?.toLowerCase().includes(q) ||
          e.enDefinition?.toLowerCase().includes(q) ||
          e.exampleSentence?.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return list;
  }, [vocabularyEntries, filterMode, searchQuery]);

  const repeatCount = useMemo(() => vocabularyEntries.filter((e) => e.encounterCount >= 2).length, [vocabularyEntries]);

  if (!mounted) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-(--cheese-gold)" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="cheese-card overflow-hidden">
        <div className="cheese-card-header flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-(--cheese-gold-soft) border border-(--cheese-gold)/20">
            <BookOpen className="size-4 text-(--cheese-gold)" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-(--label-primary)">
              {locale === 'zh' ? '生词本' : 'Vocabulary Notebook'}
            </h2>
            <p className="text-xs text-(--label-secondary)">
              {locale === 'zh'
                ? `${vocabularyEntries.length} 条记录，其中 ${repeatCount} 个重点突破词汇`
                : `${vocabularyEntries.length} entries, ${repeatCount} repeat offenders`}
            </p>
          </div>
          {repeatCount > 0 && (
            <div className="ml-auto flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 dark:bg-rose-400/10 dark:text-rose-400">
              <AlertTriangle className="size-3.5" />
              {repeatCount} {locale === 'zh' ? '次重点突破' : 'repeats'}
            </div>
          )}
          <button
            type="button"
            onClick={handleGlobalRefresh}
            title={locale === 'zh' ? '强制重拉所有释义' : 'Force reload all definitions'}
            className={cn(
              "ml-auto sm:ml-2 flex items-center justify-center rounded-full p-2 shadow-sm ring-1 transition-all overflow-hidden",
              forceQueueCount > 0
                ? "bg-(--surface-elevated) text-(--cheese-gold) ring-(--separator)"
                : confirmGlobalReload
                  ? "bg-orange-500/10 text-orange-500 ring-orange-500/30 px-3 gap-1.5"
                  : "bg-(--surface-elevated) text-(--label-secondary) ring-(--separator) hover:bg-(--surface-grouped) hover:scale-105 active:scale-95"
            )}
          >
            <AnimatePresence mode="wait">
              {confirmGlobalReload ? (
                <motion.div key="confirm" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1.5">
                  <span className="text-xs font-bold whitespace-nowrap">{locale === 'zh' ? '确定全部覆盖?' : 'Sure to reload all?'}</span>
                </motion.div>
              ) : (
                <motion.div key="icon" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  <RefreshCw className={cn("size-4", forceQueueCount > 0 && "animate-spin")} />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>

        <div className="p-6">
          <AddEntryForm locale={locale} activeSessionId={activeSessionId} />
        </div>
      </div>

      {reviewQueue.length > 0 && (
        <div className="cheese-card overflow-hidden border-(--cheese-gold)/20">
          <div className="cheese-card-header flex items-center gap-2">
            <Check className="size-4 text-(--cheese-gold)" />
            <span className="text-sm font-semibold text-(--label-primary)">
              {locale === 'zh' ? '待攻克列表' : 'Target Breakthrough'}
            </span>
            <p className="ml-auto text-xs text-(--label-tertiary)">
              {locale === 'zh' ? '按近期练习出错频率排序' : 'Prioritizing recent misses'}
            </p>
          </div>
          <div className="p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {reviewQueue.map(({ entry, daysSinceKnockdown, knockdownCount, comebackCount, unresolvedCount }) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => focusReviewWord(entry.text)}
                  className="group flex flex-col justify-center gap-1.5 rounded-[14px] bg-(--surface-grouped)/50 px-4 py-3 text-left ring-1 ring-(--separator)/60 transition-all hover:bg-(--surface-elevated) hover:ring-(--cheese-gold)/30 active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px] font-bold text-(--label-primary) group-hover:text-(--cheese-gold) transition-colors">
                      {entry.text}
                    </span>
                    <span className="shrink-0 text-[10px] font-medium text-(--label-tertiary)">
                      {daysSinceKnockdown === null
                        ? (locale === 'zh' ? '-' : '-')
                        : daysSinceKnockdown === 0
                          ? (locale === 'zh' ? '今天出错' : 'Missed today')
                          : (locale === 'zh' ? `${daysSinceKnockdown} 天前` : `${daysSinceKnockdown}d ago`)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-(--label-secondary)">
                    <div className="flex items-center gap-2">
                       <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                         <span className="size-1.5 rounded-full bg-rose-500" />
                         {locale === 'zh' ? '错' : 'Miss'} {knockdownCount}
                       </span>
                       <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                         <span className="size-1.5 rounded-full bg-emerald-500" />
                         {locale === 'zh' ? '对' : 'Hit'} {comebackCount}
                       </span>
                    </div>
                    {unresolvedCount > 0 ? (
                      <span className="font-semibold text-orange-600 dark:text-orange-400">
                        {locale === 'zh' ? `待巩固 ${unresolvedCount}` : `${unresolvedCount} to master`}
                      </span>
                    ) : (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                         {locale === 'zh' ? '已掌握' : 'Mastered'}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter + list */}
      {vocabularyEntries.length > 0 ? (
        <div className="cheese-card overflow-hidden">
          <div className="cheese-card-header">
            <FilterBar
              mode={filterMode}
              setMode={setFilterMode}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              totalCount={filtered.length}
              locale={locale}
              recallMode={recallMode}
              setRecallMode={setRecallMode}
            />
            {recallMode && (
              <p className="mt-2 text-xs text-(--label-tertiary)">
                {locale === 'zh' ? '提示：聚焦词卡后，通过 ↑ / ↓ 键切换，按 Space 开启，按 1 或 2 快速记录掌握情况。' : 'Tip: Use ↑ or ↓ to switch cards, press Space to reveal, and press 1 or 2 to record performance.'}
              </p>
            )}
          </div>

          <div className="p-4 sm:p-5">
            {filtered.length > 0 ? (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {filtered.map((entry) => (
                    <VocabCard
                      key={entry.id}
                      entry={entry}
                      onRemove={removeVocabularyEntry}
                      onUpdate={updateVocabularyEntry}
                      onKnockdown={handleRecordKnockdown}
                      onComeback={handleRecordComeback}
                      onForceRefresh={(id) => performMigration([id])}
                      isRefreshing={forceQueue.includes(entry.id)}
                      locale={locale}
                      recallMode={recallMode}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-in fade-in duration-500">
                <div className="flex size-14 items-center justify-center rounded-full bg-(--surface-grouped) mb-4 ring-1 ring-(--separator)/50 shadow-xs">
                  <Search className="size-6 text-(--label-tertiary)" />
                </div>
                <h3 className="text-sm font-semibold text-(--label-primary)">
                  {locale === 'zh' ? '没有符合条件的单词' : 'No matching entries'}
                </h3>
                <p className="mt-1.5 text-[13px] text-(--label-secondary) max-w-[200px] leading-relaxed">
                  {locale === 'zh' ? '尝试减少搜索关键词，或者切换不同的过滤条件。' : 'Try adjusting your search criteria or switching filters.'}
                </p>
                {(searchQuery || filterMode !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterMode('all');
                    }}
                    className="mt-4 text-[13px] font-medium text-(--cheese-gold) hover:underline underline-offset-4"
                  >
                    {locale === 'zh' ? '清除所有过滤' : 'Clear all filters'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="cheese-card overflow-hidden">
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', bounce: 0.3, delay: 0.1 }}
              className="flex size-16 items-center justify-center rounded-full bg-(--cheese-gold-soft) border border-(--cheese-gold)/20 mb-4"
            >
              <BookOpen className="size-7 text-(--cheese-gold)" />
            </motion.div>
            <h3 className="text-base font-semibold text-(--label-primary)">
              {locale === 'zh' ? '暂无词汇记录' : 'Vocabulary is empty'}
            </h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-(--label-secondary)">
              {locale === 'zh'
                ? '在上方输入需要记录的单词或短语。多次添加同一个词时，系统会自动累加计数，帮你定位薄弱环节。'
                : 'Start typing above to add words or phrases. Re-adding the same word tracks how often you encounter it, helping you identify weak spots.'}
            </p>
          </div>
        </div>
      )}

      {/* Repeat offenders summary */}
      {repeatCount > 0 && (
        <div className="cheese-card overflow-hidden border-rose-500/15 dark:border-rose-400/10">
          <div className="cheese-card-header flex items-center gap-2">
            <AlertTriangle className="size-4 text-rose-500 dark:text-rose-400" />
            <span className="text-sm font-semibold text-(--label-primary)">
              {locale === 'zh' ? '重点关注' : 'High Priority'}
            </span>
            <p className="ml-auto text-xs text-(--label-tertiary)">
              {locale === 'zh' ? '遇到 2 次及以上的词语' : 'Words encountered 2+ times'}
            </p>
          </div>
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">
              {vocabularyEntries
                .filter((e) => e.encounterCount >= 2)
                .sort((a, b) => b.encounterCount - a.encounterCount)
                .slice(0, 20)
                .map((e) => (
                  <motion.span
                    key={e.id}
                    layout
                    className="flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/8 px-3 py-1.5 text-sm font-semibold text-rose-700 dark:border-rose-400/15 dark:bg-rose-400/8 dark:text-rose-300"
                  >
                    {e.text}
                    <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                      ×{e.encounterCount}
                    </span>
                  </motion.span>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
