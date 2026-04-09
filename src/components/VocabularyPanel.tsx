'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, BookOpen, Check, ChevronDown, ChevronUp, ExternalLink, Loader2, Plus, Search, Trash2, Volume2, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { VocabularyEntry } from '@/lib/toeic';
import { getCopy } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface LookupResult {
  definition: string;
  enDefinition?: string;
  partOfSpeech: string;
  exampleSentence?: string;
  reading?: string;
}

const DICT_CACHE_KEY = 'cheese-dict-cache-v1';

function getCache(): Record<string, LookupResult> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(DICT_CACHE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function setCache(word: string, result: LookupResult) {
  if (typeof window === 'undefined') return;
  try {
    const cache = getCache();
    cache[word.toLowerCase()] = result;
    // Keep cache size reasonable (last 500 words)
    const keys = Object.keys(cache);
    if (keys.length > 500) {
      delete cache[keys[0]];
    }
    localStorage.setItem(DICT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore quota errors
  }
}

async function lookupWord(text: string): Promise<LookupResult | null> {
  const normalized = text.trim().toLowerCase();
  const isPhrase = normalized.split(/\s+/).length > 2;
  if (isPhrase) return null;

  // Check cache first
  const cache = getCache();
  if (cache[normalized]) {
    return cache[normalized];
  }

  try {
    const q = encodeURIComponent(normalized);
    let definition = '';
    let enDefinition = '';
    let partOfSpeech = '';
    let exampleSentence = '';
    let reading = '';

    // 1. Fetch from dictionaryapi.dev for pronunciation, POS, example
    try {
      const enRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${q}`);
      if (enRes.ok) {
        const enData = await enRes.json();
        const entry = enData[0];
        if (entry) {
          const meaning = entry.meanings?.[0];
          const defItem = meaning?.definitions?.[0];
          
          definition = defItem?.definition || '';
          enDefinition = defItem?.definition || '';
          partOfSpeech = meaning?.partOfSpeech || '';
          exampleSentence = defItem?.example || '';
          reading = entry.phonetics?.find((p: any) => p.text)?.text || '';
        }
      }
    } catch (e) {
      // Ignore English dict error
    }

    // 2. Fetch Chinese translation from Google Translate (API supports CORS)
    try {
      // Use dt=t (translation) and dt=bd (dictionary/alternative translations)
      const zhRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&dt=bd&q=${q}`);
      if (zhRes.ok) {
        const zhData = await zhRes.json();
        
        let translated = '';
        // If dictionary results are available, use the first POS translations
        if (zhData[1] && zhData[1][0] && zhData[1][0][1]) {
           translated = zhData[1][0][1].slice(0, 3).join('，');
        } else if (zhData[0] && zhData[0][0] && zhData[0][0][0]) {
           // Fallback to literal translation
           translated = zhData[0][0][0];
        }

        // Only override if the translation actually differs from the English word
        if (translated && translated.toLowerCase() !== text.trim().toLowerCase()) {
          definition = translated;
        }
      }
    } catch (e) {
      // Fallback to English definition if translation fails
    }
    const result: LookupResult = {
      definition,
      enDefinition,
      partOfSpeech,
      exampleSentence,
      reading,
    };

    if (result.definition || result.enDefinition) {
      setCache(normalized, result);
    }

    return result;
  } catch {
    return null;
  }
}

// ─── Entry Card ──────────────────────────────────────────────────────────────

function VocabCard({
  entry,
  onRemove,
  locale,
}: {
  entry: VocabularyEntry;
  onRemove: (id: string) => void;
  locale: 'zh' | 'en';
}) {
  const [expanded, setExpanded] = useState(false);
  const isRepeatOffender = entry.encounterCount >= 2;

  const playAudio = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(entry.text);
    utterance.lang = 'en-US'; // Use US English for TOEIC
    utterance.rate = 0.9; // Slightly slower for clarity
    window.speechSynthesis.speak(utterance);
  }, [entry.text]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
      className={cn(
        'group relative overflow-hidden rounded-[16px] border bg-(--surface-elevated) transition-shadow hover:shadow-(--shadow-medium)',
        isRepeatOffender
          ? 'border-rose-500/20 bg-rose-500/3 dark:border-rose-400/15 dark:bg-rose-400/4'
          : 'border-(--separator)'
      )}
    >
      {/* Accent stripe for repeat offenders */}
      {isRepeatOffender && (
        <div className="absolute inset-y-0 left-0 w-0.75 rounded-l-[16px] bg-linear-to-b from-rose-400 to-rose-600" />
      )}

      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {/* Header row */}
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`https://dictionary.cambridge.org/dictionary/english-chinese-simplified/${encodeURIComponent(entry.text.trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                title={locale === 'zh' ? '在剑桥词典中查看' : 'View in Cambridge Dictionary'}
                className="group/link flex items-center gap-1.5 text-base font-bold text-(--label-primary) hover:text-(--cheese-gold) transition-colors"
              >
                <span className="group-hover/link:underline decoration-2 underline-offset-4">{entry.text}</span>
                <ExternalLink className="size-3.5 opacity-0 -ml-0.5 group-hover/link:opacity-100 transition-opacity text-(--cheese-gold)" />
              </a>
              <button
                type="button"
                onClick={playAudio}
                title={locale === 'zh' ? '播放读音' : 'Play pronunciation'}
                className="flex size-6 items-center justify-center rounded-full bg-(--surface-grouped) border border-(--separator) text-(--label-tertiary) hover:text-(--cheese-gold) hover:border-(--cheese-gold)/30 hover:bg-(--cheese-gold)/10 transition-colors"
              >
                <Volume2 className="size-3.5" />
              </button>
              {entry.reading && (
                <span className="text-xs text-(--label-tertiary) font-mono">{entry.reading}</span>
              )}
              {entry.partOfSpeech && (
                <span className="rounded-full bg-(--surface-grouped) px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--label-secondary) border border-(--separator)">
                  {entry.partOfSpeech}
                </span>
              )}
              {isRepeatOffender && (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-1 rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-400"
                >
                  <AlertTriangle className="size-3" />
                  {locale === 'zh' ? `重复栽跟头 ×${entry.encounterCount}` : `Repeat ×${entry.encounterCount}`}
                </motion.span>
              )}
            </div>

            {/* Definition */}
            {entry.definition && (
              <p className="mt-2 text-sm leading-relaxed text-(--label-primary)">
                {entry.definition}
              </p>
            )}

            {/* Always visible English definition and example */}
            {(entry.enDefinition || entry.exampleSentence) && (
              <div className="mt-2.5 space-y-2">
                {entry.enDefinition && entry.enDefinition !== entry.definition && (
                  <div className="rounded-[10px] bg-(--surface-grouped) px-3 py-2.5 border border-(--separator)/50">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-(--label-tertiary) mb-1">
                      {locale === 'zh' ? 'EN DEFINITION' : 'EN DEFINITION'}
                    </div>
                    <p className="text-sm leading-relaxed text-(--label-secondary)">
                      {entry.enDefinition}
                    </p>
                  </div>
                )}
                {entry.exampleSentence && (
                  <div className="rounded-[10px] bg-(--surface-grouped) px-3 py-2.5 border border-(--separator)/50 opacity-90">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-(--label-tertiary) mb-1 flex items-center gap-1.5">
                      {locale === 'zh' ? 'EXAMPLE' : 'EXAMPLE'}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
                          window.speechSynthesis.cancel();
                          const utterance = new SpeechSynthesisUtterance(entry.exampleSentence!);
                          utterance.lang = 'en-US';
                          window.speechSynthesis.speak(utterance);
                        }}
                        className="text-(--label-tertiary) hover:text-(--cheese-gold) transition-colors"
                        title={locale === 'zh' ? '朗读例句' : 'Read example'}
                      >
                        <Volume2 className="size-2.5" />
                      </button>
                    </div>
                    <p className="text-sm italic leading-relaxed text-(--label-secondary)">
                      {entry.exampleSentence}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Expandable metadata (Tags & Sessions) */}
            {(entry.sessionIds.length > 0 || entry.tags.length > 0) && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="mt-3 flex items-center gap-1 text-[11px] font-medium text-(--label-tertiary) hover:text-(--label-secondary) transition-colors"
              >
                {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                {expanded
                  ? (locale === 'zh' ? '收起溯源' : 'Collapse metadata')
                  : (locale === 'zh' ? '展开追踪来源' : 'View tracking metadata')}
              </button>
            )}

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2">
                    {entry.sessionIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {entry.sessionIds.map((id) => {
                          const isListening = id.startsWith('L');
                          return (
                            <span 
                              key={id} 
                              className={cn(
                                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border",
                                isListening 
                                  ? "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-400/10 dark:text-blue-400"
                                  : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-400"
                              )}
                            >
                              <span>{isListening ? '🎧' : '📖'}</span>
                              <span>{isListening ? '听力' : '阅读'} {id}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {entry.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-(--cheese-gold-soft) border border-(--cheese-gold)/20 px-2 py-0.5 text-[10px] font-semibold text-(--cheese-gold)">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onRemove(entry.id)}
              aria-label={locale === 'zh' ? '删除' : 'Remove'}
              className="flex size-8 items-center justify-center rounded-full border border-(--separator) bg-(--surface-grouped) text-(--label-tertiary) hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Add Entry Row ───────────────────────────────────────────────────────────

function AddEntryForm({
  locale,
  activeSessionId,
}: {
  locale: 'zh' | 'en';
  activeSessionId: string;
}) {
  const addVocabularyEntry = useStore((state) => state.addVocabularyEntry);
  const bumpVocabularyEncounter = useStore((state) => state.bumpVocabularyEncounter);
  const [text, setText] = useState('');
  const [manualDefinition, setManualDefinition] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [isLooking, startLookup] = useTransition();
  const [justAdded, setJustAdded] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-lookup on text change (debounced)
  useEffect(() => {
    if (!text.trim() || text.trim().length < 2) {
      setLookupResult(null);
      return;
    }
    const t = window.setTimeout(() => {
      startLookup(async () => {
        const result = await lookupWord(text);
        setLookupResult(result);
      });
    }, 600);
    return () => window.clearTimeout(t);
  }, [text]);

  const processInput = useCallback((input: string) => {
    // Advanced parsing: supports commas, newlines, and space-separation with quotes.
    // E.g., leaning back, strolling along, "seminar cartridges" stacked
    let tokens: string[] = [];
    if (input.includes('\n') || input.includes(',')) {
      tokens = input.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    } else {
      // Space-separated but respects quotes for phrases
      const matches = input.match(/[^\s"']+|"([^"]*)"|'([^']*)'/g);
      if (matches) {
        tokens = matches.map(m => {
          if (m.startsWith('"') && m.endsWith('"')) return m.slice(1, -1);
          if (m.startsWith("'") && m.endsWith("'")) return m.slice(1, -1);
          return m;
        });
      }
    }
    return tokens;
  }, []);

  const handleAdd = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const items = processInput(trimmed);
    if (items.length > 1) {
      // Bulk add scenario via typing and processing
      startLookup(async () => {
        // Fetch definitions for all items concurrently (or sequentially, we use Promise.all)
        await Promise.all(
          items.map(async (item) => {
            const bumpedId = bumpVocabularyEncounter(item, activeSessionId);
            if (!bumpedId) {
              const res = await lookupWord(item);
              addVocabularyEntry({
                text: item,
                definition: manualDefinition || res?.definition,
                enDefinition: res?.enDefinition,
                partOfSpeech: res?.partOfSpeech,
                reading: res?.reading,
                exampleSentence: res?.exampleSentence,
                sessionIds: [activeSessionId],
                encounterCount: 1,
                tags: [],
              });
            }
          })
        );
      });
      setText('');
      setManualDefinition('');
      setLookupResult(null);
      setShowManual(false);
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 1200);
      inputRef.current?.focus();
      return;
    }

    // Check for existing entry to bump
    const bumpedId = bumpVocabularyEncounter(trimmed, activeSessionId);
    if (bumpedId) {
      setText('');
      setLookupResult(null);
      setShowManual(false);
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 1200);
      inputRef.current?.focus();
      return;
    }

    // Create new entry
    const result = lookupResult;
    addVocabularyEntry({
      text: trimmed,
      definition: manualDefinition || result?.definition,
      enDefinition: result?.enDefinition,
      partOfSpeech: result?.partOfSpeech,
      reading: result?.reading,
      exampleSentence: result?.exampleSentence,
      sessionIds: [activeSessionId],
      encounterCount: 1,
      tags: [],
    });

    setText('');
    setManualDefinition('');
    setLookupResult(null);
    setShowManual(false);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1200);
    inputRef.current?.focus();
  }, [text, lookupResult, manualDefinition, addVocabularyEntry, bumpVocabularyEncounter, activeSessionId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter allows newline naturally, do nothing
      } else {
        e.preventDefault();
        handleAdd();
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <textarea
            ref={inputRef}
            rows={text.includes('\\n') ? Math.min(text.split('\\n').length, 5) : 1}
            value={text}
            onChange={(e) => { setText(e.target.value); setJustAdded(false); }}
            onKeyDown={handleKeyDown}
            placeholder={locale === 'zh' ? '输入生词，回车添加，Shift+回车换行。支持逗号或换行批量导入…' : 'Type a word, Enter to add, Shift+Enter for newline…'}
            className="w-full resize-none min-h-[44px] rounded-[22px] border border-(--separator) bg-(--surface-elevated) px-5 py-2.5 pr-10 text-sm leading-relaxed text-(--label-primary) outline-none transition-all placeholder:text-(--label-tertiary) focus:border-(--cheese-gold)/50 focus:ring-2 focus:ring-(--cheese-gold)/20 scrollbar-hide"
          />
          {isLooking && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <Loader2 className="size-4 animate-spin text-(--label-tertiary)" />
            </div>
          )}
        </div>
        <motion.button
          type="button"
          onClick={handleAdd}
          disabled={!text.trim()}
          whileTap={{ scale: 0.94 }}
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-full border font-bold transition-all',
            justAdded
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : text.trim()
                ? 'border-(--cheese-gold)/30 bg-(--cheese-gold-soft) text-(--cheese-gold) hover:bg-(--cheese-gold)/20'
                : 'border-(--separator) bg-(--surface-grouped) text-(--label-tertiary) opacity-50'
          )}
          aria-label={locale === 'zh' ? '添加' : 'Add'}
        >
          <AnimatePresence mode="wait">
            {justAdded ? (
              <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Check className="size-4" />
              </motion.div>
            ) : (
              <motion.div key="plus" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Plus className="size-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Dictionary lookup preview */}
      <AnimatePresence>
        {lookupResult && text.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="rounded-[12px] border border-(--separator) bg-(--surface-grouped) px-4 py-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-(--cheese-gold)">
                {locale === 'zh' ? '词典' : 'Dictionary'}
              </span>
              {lookupResult.reading && (
                <span className="text-[11px] text-(--label-tertiary) font-mono">{lookupResult.reading}</span>
              )}
              {lookupResult.partOfSpeech && (
                <span className="rounded-full bg-(--surface-elevated) border border-(--separator) px-2 py-0.5 text-[10px] text-(--label-secondary)">
                  {lookupResult.partOfSpeech}
                </span>
              )}
              <a
                href={`https://www.merriam-webster.com/dictionary/${encodeURIComponent(text.trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-[10px] text-(--label-tertiary) hover:text-(--label-secondary) transition-colors"
              >
                M-W <ExternalLink className="size-2.5" />
              </a>
            </div>
            <p className="text-sm leading-relaxed text-(--label-secondary)">{lookupResult.definition}</p>
            {lookupResult.exampleSentence && (
              <p className="mt-1.5 text-xs italic text-(--label-tertiary) leading-relaxed">
                &ldquo;{lookupResult.exampleSentence}&rdquo;
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual definition (for phrases) */}
      <AnimatePresence>
        {text.trim() && !lookupResult && !isLooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="text-xs text-(--label-tertiary) hover:text-(--label-secondary) transition-colors"
            >
              {showManual
                ? (locale === 'zh' ? '− 收起手动定义' : '− Hide manual definition')
                : (locale === 'zh' ? '+ 手动添加定义' : '+ Add definition manually')}
            </button>
            <AnimatePresence>
              {showManual && (
                <motion.textarea
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  rows={2}
                  value={manualDefinition}
                  onChange={(e) => setManualDefinition(e.target.value)}
                  placeholder={locale === 'zh' ? '填写释义或记忆提示…' : 'Add definition or memory hint…'}
                  className="mt-2 w-full resize-none rounded-[12px] border border-(--separator) bg-(--surface-elevated) px-4 py-3 text-sm text-(--label-primary) outline-none transition-all placeholder:text-(--label-tertiary) focus:border-(--cheese-gold)/50 focus:ring-2 focus:ring-(--cheese-gold)/20"
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Filter Bar ──────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'repeat' | 'recent';

function FilterBar({
  mode,
  setMode,
  searchQuery,
  setSearchQuery,
  totalCount,
  locale,
}: {
  mode: FilterMode;
  setMode: (mode: FilterMode) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  totalCount: number;
  locale: 'zh' | 'en';
}) {
  const filters: { key: FilterMode; label: string }[] = [
    { key: 'all', label: locale === 'zh' ? '全部' : 'All' },
    { key: 'repeat', label: locale === 'zh' ? '重复栽跟头' : 'Repeats' },
    { key: 'recent', label: locale === 'zh' ? '最近添加' : 'Recent' },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-(--label-tertiary)" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={locale === 'zh' ? '搜索生词…' : 'Search vocabulary…'}
          className="h-9 w-full rounded-full border border-(--separator) bg-(--surface-grouped) pl-9 pr-4 text-sm text-(--label-primary) outline-none transition-all placeholder:text-(--label-tertiary) focus:border-(--cheese-gold)/50 focus:ring-2 focus:ring-(--cheese-gold)/20"
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="size-3.5 text-(--label-tertiary)" />
          </button>
        )}
      </div>

      {/* Mode pills */}
      <div className="flex gap-1 rounded-full border border-(--separator) bg-(--surface-grouped) p-1">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-semibold transition-all',
              mode === key
                ? 'bg-(--surface-elevated) text-(--label-primary) shadow-(--shadow-soft)'
                : 'text-(--label-secondary) hover:text-(--label-primary)'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="font-mono text-[11px] text-(--label-tertiary) shrink-0">
        {totalCount}{locale === 'zh' ? ' 条' : ' entries'}
      </div>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function VocabularyPanel() {
  const vocabularyEntries = useStore((state) => state.vocabularyEntries);
  const removeVocabularyEntry = useStore((state) => state.removeVocabularyEntry);
  const updateVocabularyEntry = useStore((state) => state.updateVocabularyEntry);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const locale = useStore((state) => state.locale);

  // Background migration for legacy entries missing 'enDefinition'
  useEffect(() => {
    const missing = vocabularyEntries.filter(e => !e.enDefinition);
    if (missing.length === 0) return;

    // 1. First, try to fix all missing items that are ALREADY in the cache (Fast path)
    const cache = getCache();
    const canFixInstantly = missing.filter(e => cache[e.text.toLowerCase()]);
    
    if (canFixInstantly.length > 0) {
      // Process a batch of up to 10 instantly to avoid over-triggering renders
      canFixInstantly.slice(0, 10).forEach(entry => {
        const res = cache[entry.text.toLowerCase()];
        updateVocabularyEntry(entry.id, { 
          enDefinition: res.enDefinition || entry.definition || '',
          reading: entry.reading || res.reading,
          partOfSpeech: entry.partOfSpeech || res.partOfSpeech,
          exampleSentence: entry.exampleSentence || res.exampleSentence,
        });
      });
      return; // The store update will trigger the next run of this effect
    }

    // 2. Otherwise, pick the first one and do a network fetch with throttle (Slow path)
    const entry = missing[0];
    const timer = window.setTimeout(async () => {
      const res = await lookupWord(entry.text);
      if (res) {
        updateVocabularyEntry(entry.id, { 
          enDefinition: res.enDefinition || entry.definition || '',
          reading: entry.reading || res.reading,
          partOfSpeech: entry.partOfSpeech || res.partOfSpeech,
          exampleSentence: entry.exampleSentence || res.exampleSentence,
        });
      } else {
        // Mark to prevent infinite retry
        updateVocabularyEntry(entry.id, { enDefinition: entry.definition || '-' });
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [vocabularyEntries, updateVocabularyEntry]);

  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
          e.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return list;
  }, [vocabularyEntries, filterMode, searchQuery]);

  const repeatCount = useMemo(() => vocabularyEntries.filter((e) => e.encounterCount >= 2).length, [vocabularyEntries]);

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
                ? `${vocabularyEntries.length} 条记录，其中 ${repeatCount} 条重复栽跟头`
                : `${vocabularyEntries.length} entries, ${repeatCount} repeat offenders`}
            </p>
          </div>
          {repeatCount > 0 && (
            <div className="ml-auto flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 dark:border-rose-400/15 dark:bg-rose-400/10 dark:text-rose-400">
              <AlertTriangle className="size-3.5" />
              {repeatCount} {locale === 'zh' ? '次重复' : 'repeats'}
            </div>
          )}
        </div>

        <div className="p-6">
          <AddEntryForm locale={locale} activeSessionId={activeSessionId} />
        </div>
      </div>

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
            />
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
                      locale={locale}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="cheese-empty flex flex-col items-center justify-center py-12 text-center">
                <Search className="size-8 text-(--label-tertiary) mb-3" />
                <p className="text-sm font-medium text-(--label-secondary)">
                  {locale === 'zh' ? '没有匹配的记录' : 'No matching entries'}
                </p>
                <p className="mt-1 text-xs text-(--label-tertiary)">
                  {locale === 'zh' ? '试试调整搜索词或过滤条件' : 'Try adjusting your search or filter'}
                </p>
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
              {locale === 'zh' ? '生词本是空的' : 'Vocabulary is empty'}
            </h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-(--label-secondary)">
              {locale === 'zh'
                ? '在上方输入单词或短语开始记录。遇到相同词语时系统会自动计数，帮你识别反复出错的盲区。'
                : 'Start typing above to add words or phrases. Re-adding the same word automatically tracks how often you encounter it.'}
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
