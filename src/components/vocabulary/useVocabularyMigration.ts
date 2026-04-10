import { useState, useEffect, useCallback } from 'react';
import type { VocabularyEntry } from '@/lib/toeic';
import { lookupWord, getCache, normalizeDefinitionText, containsViolentHint, isLikelyEnglishText, LookupResult } from './dictionary';

export function useVocabularyMigration(
  vocabularyEntries: VocabularyEntry[],
  updateVocabularyEntry: (id: string, updates: Partial<VocabularyEntry>) => void,
  locale: 'zh' | 'en'
) {
  const [forceQueue, setForceQueue] = useState<string[]>([]);

  // Automatically process the queue one by one
  useEffect(() => {
    if (forceQueue.length === 0) {
      return;
    }
    const id = forceQueue[0];
    const entry = vocabularyEntries.find(e => e.id === id);

    if (!entry) {
      const cleanupId = window.setTimeout(() => {
        setForceQueue(q => q.slice(1));
      }, 0);
      return () => window.clearTimeout(cleanupId);
    }

    const timer = window.setTimeout(async () => {
      // Force ignore cache for forced items
      const res = await lookupWord(entry.text, { ignoreCache: true });
      if (res) {
        const patch: Partial<VocabularyEntry> = {
          definition: normalizeDefinitionText(res.definition) || entry.definition,
          enDefinition: normalizeDefinitionText(res.enDefinition) || entry.enDefinition,
          reading: res.reading || entry.reading,
          partOfSpeech: res.partOfSpeech || entry.partOfSpeech,
          exampleSentence: res.exampleSentence || entry.exampleSentence,
        };
        updateVocabularyEntry(entry.id, patch);
      }
      setForceQueue(q => q.slice(1));
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [forceQueue, vocabularyEntries, updateVocabularyEntry]);

  const performMigration = useCallback(async (manualForceIds?: string[]) => {
    if (manualForceIds && manualForceIds.length > 0) {
      // Manual force reload queues the specific IDs
      setForceQueue(prev => [...new Set([...prev, ...manualForceIds])]);
      return;
    }

    // Auto-migration logic for truly missing items
    const missing = vocabularyEntries.filter((e) => {
      const enDefinition = normalizeDefinitionText(e.enDefinition);
      const definition = normalizeDefinitionText(e.definition);
      const definitionLooksUnsafe = containsViolentHint(enDefinition) && (!definition || definition === enDefinition);
      const failedZh = locale === 'zh' && definition && definition === enDefinition && isLikelyEnglishText(definition);
      return !definition || !enDefinition || definitionLooksUnsafe || failedZh;
    });

    if (missing.length === 0) return;

    const buildMigrationPatch = (entry: VocabularyEntry, res?: LookupResult) => {
      const normalizedDefinition = normalizeDefinitionText(entry.definition);
      const normalizedEntryEnDefinition = normalizeDefinitionText(entry.enDefinition);
      const normalizedLookupDefinition = normalizeDefinitionText(res?.definition);
      const normalizedLookupEnDefinition = normalizeDefinitionText(res?.enDefinition);
      const fallbackEnDefinition =
        normalizedLookupEnDefinition ||
        normalizedEntryEnDefinition ||
        (isLikelyEnglishText(normalizedDefinition) ? normalizedDefinition : '');
      const patch: Partial<VocabularyEntry> = {};

      if ((!normalizedDefinition || containsViolentHint(normalizedDefinition)) && normalizedLookupDefinition) {
        patch.definition = normalizedLookupDefinition;
      }

      if (fallbackEnDefinition && entry.enDefinition !== fallbackEnDefinition) {
        patch.enDefinition = fallbackEnDefinition;
      }
      if (!fallbackEnDefinition && entry.enDefinition !== undefined) {
        patch.enDefinition = undefined;
      }
      if (!entry.reading && res?.reading) {
        patch.reading = res.reading;
      }
      if (!entry.partOfSpeech && res?.partOfSpeech) {
        patch.partOfSpeech = res.partOfSpeech;
      }
      if (!entry.exampleSentence && res?.exampleSentence) {
        patch.exampleSentence = res.exampleSentence;
      }

      return patch;
    };

    const cache = getCache();
    const canFixInstantly = missing.filter((e) => cache[e.text.toLowerCase()]);
    
    if (canFixInstantly.length > 0) {
      canFixInstantly.slice(0, 10).forEach((entry) => {
        const res = cache[entry.text.toLowerCase()];
        const patch = buildMigrationPatch(entry, res);
        if (Object.keys(patch).length > 0) {
          updateVocabularyEntry(entry.id, patch);
        }
      });
      return; 
    }

    // Slow path: process the first finding
    const entry = missing[0];
    const failedZh = locale === 'zh' && entry.definition === entry.enDefinition && isLikelyEnglishText(entry.definition);
    const res = await lookupWord(entry.text, { forceZhRetry: failedZh });
    const patch = buildMigrationPatch(entry, res || undefined);
    if (Object.keys(patch).length > 0) {
      updateVocabularyEntry(entry.id, patch);
    }
  }, [vocabularyEntries, updateVocabularyEntry, locale]);

  // Background check
  useEffect(() => {
    // Only run auto-migration if no force queue is active
    if (forceQueue.length > 0) return;
    const timer = window.setTimeout(() => performMigration(), 1200);
    return () => window.clearTimeout(timer);
  }, [performMigration, forceQueue.length]);

  return {
    performMigration,
    isMigrating: forceQueue.length > 0,
    forceQueueCount: forceQueue.length,
    forceQueue,
  };
}