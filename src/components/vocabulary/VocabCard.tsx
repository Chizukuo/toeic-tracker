import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, BookOpen, Check, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Volume2, Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VocabularyEntry } from '@/lib/toeic';
import { normalizeDefinitionText } from './dictionary';

export function VocabCard({
  entry,
  onRemove,
  onUpdate,
  onKnockdown,
  onComeback,
  onForceRefresh,
  isRefreshing,
  locale,
  recallMode,
}: {
  entry: VocabularyEntry;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<VocabularyEntry>) => void;
  onKnockdown: (id: string) => void;
  onComeback: (id: string) => void;
  onForceRefresh: (id: string) => void;
  isRefreshing: boolean;
  locale: 'zh' | 'en';
  recallMode: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDefinition, setEditDefinition] = useState('');
  
  const [confirmReload, setConfirmReload] = useState(false);
  
  const isRepeatOffender = entry.encounterCount >= 2;
  const knockdownCount = entry.knockdownCount ?? 0;
  const comebackCount = entry.comebackCount ?? 0;
  const unresolvedCount = Math.max(0, knockdownCount - comebackCount);
  const normalizedEnDefinition = normalizeDefinitionText(entry.enDefinition);
  const normalizedDefinition = normalizeDefinitionText(entry.definition);
  const shouldMaskDetails = recallMode && !revealed;

  const startEditing = useCallback(() => {
    setEditDefinition(entry.definition || '');
    setIsEditing(true);
  }, [entry.definition]);

  const saveEditing = useCallback(() => {
    onUpdate(entry.id, { definition: editDefinition.trim() });
    setIsEditing(false);
  }, [entry.id, editDefinition, onUpdate]);

  const handleForceRefresh = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirmReload) {
      setConfirmReload(false);
      onForceRefresh(entry.id);
    } else {
      setConfirmReload(true);
      setTimeout(() => setConfirmReload(false), 3000);
    }
  }, [confirmReload, entry.id, onForceRefresh]);

  const toggleReveal = useCallback((e?: React.MouseEvent | React.KeyboardEvent | React.TouchEvent) => {
    if (e && (e.target as HTMLElement).closest?.('button, a')) return;
    setRevealed((prev) => !prev);
  }, []);

  const handleCardKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!recallMode) return;
    if (e.target !== e.currentTarget) return;
    
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleReveal();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = e.currentTarget.nextElementSibling as HTMLElement;
      if (next?.focus) next.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = e.currentTarget.previousElementSibling as HTMLElement;
      if (prev?.focus) prev.focus();
    } else if (revealed && e.key === '1') {
      e.preventDefault();
      onKnockdown(entry.id);
    } else if (revealed && e.key === '2') {
      e.preventDefault();
      onComeback(entry.id);
    } else if (revealed && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      onRemove(entry.id);
    }
  }, [recallMode, revealed, entry.id, onKnockdown, onComeback, onRemove, toggleReveal]);

  const playAudio = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(entry.text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }, [entry.text]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
      tabIndex={recallMode ? 0 : -1}
      onKeyDown={handleCardKeyDown}
      className={cn(
        'group relative overflow-hidden rounded-[16px] border bg-(--surface-elevated) transition-shadow hover:shadow-(--shadow-medium) outline-none',
        recallMode && 'focus-visible:ring-2 focus-visible:ring-(--cheese-gold)/35',
        isRepeatOffender
          ? 'border-rose-500/20 bg-rose-500/3 dark:border-rose-400/15 dark:bg-rose-400/4'
          : 'border-(--separator)'
      )}
    >
      {isRepeatOffender && (
        <div className="absolute inset-y-0 left-0 w-0.75 rounded-l-[16px] bg-linear-to-b from-rose-400 to-rose-600" />
      )}

      <div className="px-4 py-4 sm:px-5">
        <div className="relative">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 pr-4">
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
              <button
                type="button"
                onClick={handleForceRefresh}
                disabled={isRefreshing}
                title={locale === 'zh' ? '强制重拉释义' : 'Force reload definition'}
                className={cn(
                  "flex h-6 min-w-6 px-1 items-center justify-center rounded-full bg-(--surface-grouped) border text-(--label-tertiary) transition-all duration-200 overflow-hidden",
                  isRefreshing 
                    ? "opacity-50 cursor-not-allowed text-(--cheese-gold) border-(--separator)" 
                    : confirmReload
                      ? "text-orange-500 border-orange-500/30 bg-orange-500/10 px-2"
                      : "border-(--separator) hover:text-(--cheese-gold) hover:border-(--cheese-gold)/30 hover:bg-(--cheese-gold)/10"
                )}
              >
                <AnimatePresence mode="wait">
                  {confirmReload ? (
                    <motion.div key="confirm" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1">
                      <span className="text-[10px] font-bold px-0.5 whitespace-nowrap">{locale === 'zh' ? '覆盖?' : 'Sure?'}</span>
                    </motion.div>
                  ) : (
                    <motion.div key="icon" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
              {entry.reading && (
                <span className="text-xs text-(--label-tertiary) font-sans tracking-wide opacity-90">{entry.reading}</span>
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
                  {locale === 'zh' ? `反复查阅 ×${entry.encounterCount}` : `Repeat ×${entry.encounterCount}`}
                </motion.span>
              )}
              {knockdownCount > 0 && (
                <span className="flex items-center gap-1 rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-700 dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-300">
                  <AlertTriangle className="size-3" />
                  {locale === 'zh' ? `练习出错 ×${knockdownCount}` : `Missed ×${knockdownCount}`}
                  {unresolvedCount > 0 && (
                    <span className="rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[9px]">
                      {locale === 'zh' ? `待巩固 ${unresolvedCount}` : `${unresolvedCount} remaining`}
                    </span>
                  )}
                </span>
              )}
            </div>

            {shouldMaskDetails ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="mt-3 group/reveal relative flex w-full items-center justify-center overflow-hidden rounded-[12px] border border-dashed border-(--separator) bg-(--surface-grouped) py-4 transition-all hover:bg-(--surface-elevated) active:scale-[0.98]"
              >
                <div className="absolute inset-0 bg-linear-to-b from-transparent to-(--surface-grouped)/50 backdrop-blur-[2px]" />
                <span className="relative z-10 flex items-center gap-2 text-sm font-medium text-(--label-secondary) transition-colors group-hover/reveal:text-(--label-primary)">
                  <BookOpen className="size-4 opacity-50" />
                  {locale === 'zh' ? '点击或按空格揭晓释义' : 'Tap or press Space to reveal'}
                </span>
              </button>
            ) : (
              <>
                {isEditing ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      className="w-full text-sm text-(--label-primary) bg-(--surface-primary) border border-(--separator) rounded-[12px] p-3 focus:outline-none focus:border-(--cheese-gold) focus:ring-1 focus:ring-(--cheese-gold)/30 resize-y min-h-[80px]"
                      value={editDefinition}
                      onChange={(e) => setEditDefinition(e.target.value)}
                      onBlur={saveEditing}
                      autoFocus
                      placeholder={locale === 'zh' ? '在此输入自定义释义...' : 'Enter custom definition...'}
                    />
                    <div className="flex justify-end gap-2">
                      <button 
                        type="button" 
                        onMouseDown={(e) => { e.preventDefault(); setIsEditing(false); }} 
                        className="text-xs text-(--label-tertiary) hover:text-(--label-primary) px-2 py-1"
                      >
                        {locale === 'zh' ? '取消' : 'Cancel'}
                      </button>
                      <button 
                        type="button" 
                        onMouseDown={(e) => { e.preventDefault(); saveEditing(); }} 
                        className="text-xs text-(--cheese-gold) bg-(--cheese-gold)/10 hover:bg-(--cheese-gold)/20 px-3 py-1 rounded-full"
                      >
                        {locale === 'zh' ? '保存' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p 
                    className="mt-2 text-sm leading-relaxed text-(--label-primary) cursor-text rounded-[8px] -mx-2 px-2 py-1 hover:bg-(--surface-grouped) transition-colors relative group/edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing();
                    }}
                    title={locale === 'zh' ? '点击修改释义' : 'Click to edit definition'}
                  >
                    {normalizedDefinition || <span className="text-(--label-tertiary) italic">{locale === 'zh' ? '暂无释义' : 'No definition'}</span>}
                    <Edit2 className="size-3.5 absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/edit:opacity-100 transition-opacity text-(--label-tertiary)" />
                  </p>
                )}

                {recallMode && (
                  <div className="mt-4 flex items-center justify-between text-[10px] font-medium text-(--label-tertiary)">
                    <div className="hidden sm:flex flex-wrap items-center gap-1.5">
                      <span className="rounded border border-(--separator) bg-(--surface-elevated) px-1.5 py-0.5">1</span>
                      <span>{locale === 'zh' ? '记为出错' : 'Miss'}</span>
                      <span className="ml-1 rounded border border-(--separator) bg-(--surface-elevated) px-1.5 py-0.5">2</span>
                      <span>{locale === 'zh' ? '记为掌握' : 'Hit'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRevealed(false)}
                      className="w-full sm:w-auto rounded-full border border-(--separator) bg-(--surface-grouped) px-4 py-2 sm:px-3 sm:py-1.5 text-xs sm:text-[11px] font-medium text-(--label-secondary) transition-colors hover:text-(--label-primary) active:scale-95"
                    >
                      {locale === 'zh' ? '隐蔽释义' : 'Hide'}
                    </button>
                  </div>
                )}

                {(normalizedEnDefinition || entry.exampleSentence) && (
                  <div className="mt-3.5 space-y-3">
                    {normalizedEnDefinition && normalizedEnDefinition !== normalizedDefinition && (
                      <div className="relative pl-3.5 before:absolute before:inset-y-0.5 before:left-0 before:w-0.5 before:rounded-full before:bg-(--separator)/60">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-(--label-tertiary) mb-0.5">
                          {locale === 'zh' ? 'EN DEFINITION' : 'EN DEFINITION'}
                        </div>
                        <p className="text-[13px] leading-relaxed text-(--label-secondary)">
                          {normalizedEnDefinition}
                        </p>
                      </div>
                    )}
                    {entry.exampleSentence && (
                      <div className="relative pl-3.5 before:absolute before:inset-y-0.5 before:left-0 before:w-0.5 before:rounded-full before:bg-(--separator)/60">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-(--label-tertiary) mb-0.5 flex items-center gap-1.5">
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
                            <Volume2 className="size-3" />
                          </button>
                        </div>
                        <p className="text-[13px] italic leading-relaxed text-(--label-secondary)">
                          {entry.exampleSentence}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

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
                      <div className="flex flex-wrap gap-1 pt-1 opacity-80 mix-blend-luminosity">
                        {entry.sessionIds.map((id) => {
                          const isListening = id.startsWith('L');
                          return (
                            <span 
                              key={id} 
                              className="flex items-center gap-1 rounded bg-(--surface-elevated) px-1.5 py-0.5 text-[10px] font-medium text-(--label-secondary)"
                            >
                              <span className="opacity-60">{isListening ? '🎧' : '📖'}</span>
                              <span>{isListening ? '听力' : '阅读'} {id}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 opacity-80 mix-blend-luminosity">
                        {entry.tags.map((tag) => (
                          <span key={tag} className="rounded bg-(--surface-elevated) px-1.5 py-0.5 text-[10px] font-medium text-(--label-secondary)">
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

          <div className="mt-4 flex sm:hidden items-center gap-2 border-t border-(--separator)/40 pt-3 opacity-90">
            <button
              type="button"
              onClick={() => onKnockdown(entry.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-(--surface-grouped) px-3 py-2.5 text-xs font-semibold text-orange-600 active:scale-95 dark:text-orange-400 ring-1 ring-inset ring-(--separator)/50"
            >
              <AlertTriangle className="size-3.5" />
              {locale === 'zh' ? '出错' : 'Miss'}
            </button>
            <button
              type="button"
              onClick={() => onComeback(entry.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-(--surface-grouped) px-3 py-2.5 text-xs font-semibold text-emerald-600 active:scale-95 dark:text-emerald-400 ring-1 ring-inset ring-(--separator)/50"
            >
              <Check className="size-3.5" />
              {locale === 'zh' ? '掌握' : 'Hit'}
            </button>
            <button
              type="button"
              onClick={() => onRemove(entry.id)}
              className="flex items-center justify-center rounded-[12px] bg-(--surface-grouped) p-2.5 text-rose-600 active:scale-95 shrink-0 dark:text-rose-400 ring-1 ring-inset ring-(--separator)/50"
              aria-label={locale === 'zh' ? '删除' : 'Remove'}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>

          <div className="absolute right-0 top-0 hidden sm:flex translate-y-1 items-center gap-0.5 rounded-full border border-(--separator)/60 bg-(--surface-elevated)/85 p-1 shadow-sm backdrop-blur-md transition-all duration-200 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto pointer-events-none z-10 dark:bg-[#1a1a1a]/85">
            <button
              type="button"
              onClick={() => onKnockdown(entry.id)}
              aria-label={locale === 'zh' ? '记为练习出错' : 'Mark as incorrect'}
              title={locale === 'zh' ? '记为练习出错' : 'Mark as incorrect'}
              className="flex size-7 items-center justify-center rounded-full text-(--label-tertiary) transition-all duration-200 hover:bg-(--surface-grouped) hover:text-orange-600 dark:hover:text-orange-400"
            >
              <AlertTriangle className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onComeback(entry.id)}
              aria-label={locale === 'zh' ? '记为成功掌握' : 'Mark as correct'}
              title={locale === 'zh' ? '记为成功掌握' : 'Mark as correct'}
              className="flex size-7 items-center justify-center rounded-full text-(--label-tertiary) transition-all duration-200 hover:bg-(--surface-grouped) hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              <Check className="size-3.5" />
            </button>
            <div className="h-4 w-px bg-(--separator)/50 mx-0.5" />
            <button
              type="button"
              onClick={() => onRemove(entry.id)}
              aria-label={locale === 'zh' ? '删除' : 'Remove'}
              title={locale === 'zh' ? '删除' : 'Remove'}
              className="flex size-7 items-center justify-center rounded-full text-(--label-tertiary) transition-all duration-200 hover:bg-(--surface-grouped) hover:text-rose-600 dark:hover:text-rose-400"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}