import { useState, useCallback, useEffect, useRef, useTransition } from 'react';
import { Loader2, Plus, ExternalLink, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { lookupWord, LookupResult } from './dictionary';

export function AddEntryForm({
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
  const [manualExampleSentence, setManualExampleSentence] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [isLooking, startLookup] = useTransition();
  const [justAdded, setJustAdded] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-lookup on text change (debounced)
  useEffect(() => {
    if (!text.trim() || text.trim().length < 2) return;
    const t = window.setTimeout(() => {
      startLookup(async () => {
        const result = await lookupWord(text);
        setLookupResult(result);
      });
    }, 600);
    return () => window.clearTimeout(t);
  }, [text]);

  const processInput = useCallback((input: string) => {
    // Treat a single line as one phrase. Bulk mode only uses commas/newlines.
    if (input.includes('\n') || input.includes(',')) {
      return input.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    }
    const normalized = input.trim();
    return normalized ? [normalized] : [];
  }, []);

  const handleAdd = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const items = processInput(trimmed);
    if (items.length > 1) {
      // Bulk add scenario via typing and processing
      startLookup(async () => {
        // Fetch translations sequentially to avoid flooding for multiple inputs
        for (const item of items) {
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
        }
      });
      setText('');
      setManualDefinition('');
      setManualExampleSentence('');
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
      setManualExampleSentence('');
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
      exampleSentence: manualExampleSentence || result?.exampleSentence,
      sessionIds: [activeSessionId],
      encounterCount: 1,
      tags: [],
    });

    setText('');
    setManualDefinition('');
    setManualExampleSentence('');
    setLookupResult(null);
    setShowManual(false);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1200);
    inputRef.current?.focus();
  }, [text, lookupResult, manualDefinition, manualExampleSentence, processInput, addVocabularyEntry, bumpVocabularyEncounter, activeSessionId]);

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
      <div className="group flex w-full items-start gap-2">
        <div className="relative flex-1 ring-1 ring-(--separator) transition-shadow focus-within:ring-2 focus-within:ring-(--cheese-gold)/30 rounded-[20px] bg-(--surface-elevated) shadow-xs overflow-hidden">
          <textarea
            ref={inputRef}
            rows={text.includes('\n') ? Math.min(text.split('\n').length, 5) : 1}
            value={text}
            onChange={(e) => {
              const nextText = e.target.value;
              setText(nextText);
              setJustAdded(false);
              if (!nextText.trim() || nextText.trim().length < 2) {
                setLookupResult(null);
              }
            }}
            onKeyDown={handleKeyDown}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder={locale === 'zh' ? '输入单词或短语...' : 'Type a word or phrase...'}
            className="w-full resize-none min-h-11 bg-transparent px-5 py-3 pr-11 text-base sm:text-sm leading-6 text-(--label-primary) outline-none transition-all placeholder:text-(--label-tertiary) scrollbar-hide"
          />
          {isLooking && (
            <div className="absolute right-4 top-3.5">
              <Loader2 className="size-4 animate-spin text-(--label-tertiary)" />
            </div>
          )}

          {/* Dictionary lookup preview inline continuous */}
          <AnimatePresence>
            {lookupResult && text.trim() && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-(--separator)/50 bg-(--surface-grouped)/30 px-5 py-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-(--cheese-gold)">
                    MW
                  </span>
                  {lookupResult.reading && (
                    <span className="text-[11px] text-(--label-tertiary) font-mono">{lookupResult.reading}</span>
                  )}
                  {lookupResult.partOfSpeech && (
                    <span className="text-[11px] font-medium italic text-(--label-secondary)">
                      {lookupResult.partOfSpeech}
                    </span>
                  )}
                  <a
                    href={`https://www.merriam-webster.com/dictionary/${encodeURIComponent(text.trim())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[10px] text-(--label-tertiary) hover:text-(--label-secondary) transition-colors"
                  >
                    <ExternalLink className="size-3" />
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
        </div>
        <motion.button
          type="button"
          onClick={handleAdd}
          disabled={!text.trim()}
          whileTap={{ scale: 0.94 }}
          className={cn(
            'mt-1 flex size-9 shrink-0 items-center justify-center rounded-full transition-all',
            justAdded
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : text.trim()
                ? 'bg-(--cheese-gold-soft) text-(--cheese-gold) hover:bg-(--cheese-gold)/20'
                : 'bg-transparent text-(--label-tertiary) opacity-0 pointer-events-none'
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

      {/* Manual definition (for phrases) */}
      <AnimatePresence>
        {text.trim() && !lookupResult && !isLooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pl-2"
          >
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="text-[11px] font-medium text-(--label-tertiary) hover:text-(--label-secondary) transition-colors"
            >
              {showManual
                ? (locale === 'zh' ? '收起手动定义' : 'Hide manual definition')
                : (locale === 'zh' ? '添加手动定义...' : 'Add definition manually...')}
            </button>
            <AnimatePresence>
              {showManual && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 space-y-1.5"
                >
                  <textarea
                    rows={2}
                    value={manualDefinition}
                    onChange={(e) => setManualDefinition(e.target.value)}
                    placeholder={locale === 'zh' ? '填写释义或记忆提示…' : 'Add definition or memory hint…'}
                    className="w-full resize-none rounded-[12px] bg-(--surface-grouped)/50 px-4 py-2.5 text-base sm:text-[13px] text-(--label-primary) outline-none transition-all placeholder:text-(--label-tertiary)"
                  />
                  <textarea
                    rows={2}
                    value={manualExampleSentence}
                    onChange={(e) => setManualExampleSentence(e.target.value)}
                    placeholder={locale === 'zh' ? '可选：粘贴你遇到这个词的原句语境…' : 'Optional: paste the original sentence context…'}
                    className="w-full resize-none rounded-[12px] bg-(--surface-grouped)/50 px-4 py-2.5 text-base sm:text-[13px] text-(--label-primary) outline-none transition-all placeholder:text-(--label-tertiary)"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}