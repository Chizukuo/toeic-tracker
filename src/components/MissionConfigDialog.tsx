'use client';

import { useState, useEffect } from 'react';
import { Target, CalendarDays, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useStore } from '@/store/useStore';
import { useDashboardContext } from '@/components/DashboardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type MissionConfigDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

type MissionConfigDialogContentProps = {
  locale: 'zh' | 'en';
  copy: ReturnType<typeof useDashboardContext>['copy'];
  initialDate: string;
  initialLength: number;
  onClose: () => void;
  onSave: (draftDate: string, draftLength: number) => void;
};

const PRESET_LENGTHS = [5, 10, 15, 20];

export function MissionConfigDialog({ isOpen, onClose }: MissionConfigDialogProps) {
  const { copy, locale } = useDashboardContext();
  const storeExamDate = useStore((state) => state.examDate);
  const storeSprintConfig = useStore((state) => state.sprintConfig);
  const setExamDate = useStore((state) => state.setExamDate);
  const setSprintConfig = useStore((state) => state.setSprintConfig);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = (draftDate: string, draftLength: number) => {
    if (draftDate) {
      setExamDate(draftDate);
    }
    setSprintConfig({
      listeningCount: draftLength,
      readingCount: draftLength,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <MissionConfigDialogContent
          key={`${storeExamDate}-${storeSprintConfig.listeningCount}`}
          locale={locale}
          copy={copy}
          initialDate={storeExamDate}
          initialLength={storeSprintConfig.listeningCount}
          onClose={onClose}
          onSave={handleSave}
        />
      )}
    </AnimatePresence>
  );
}

function MissionConfigDialogContent({
  locale,
  copy,
  initialDate,
  initialLength,
  onClose,
  onSave,
}: MissionConfigDialogContentProps) {
  const [draftDate, setDraftDate] = useState(initialDate);
  const [draftLength, setDraftLength] = useState(initialLength);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 text-left">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-(--glass-border) bg-(--surface-elevated) shadow-(--shadow-elevated)"
        >
          {/* Header Area */}
          <div className="relative border-b border-(--separator) bg-zinc-50/50 p-6 dark:bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Target className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-(--label-primary)">
                  {copy.missionGoalTitle}
                </h2>
                <p className="mt-0.5 text-xs text-(--label-secondary)">
                  {copy.missionGoalDesc}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* Exam Date Segment */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-bold text-(--label-primary)">
                <CalendarDays className="size-4 text-zinc-400" />
                {copy.examCountdownLabel}
              </label>
              <div className="flex items-center gap-3 rounded-[16px] border border-(--separator) bg-(--surface-grouped) px-4 transition-colors focus-within:border-amber-400/50 focus-within:ring-2 focus-within:ring-amber-400/20">
                <Input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="h-11 border-0 bg-transparent px-0 font-medium shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            {/* Sprint Length Segment */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-bold text-(--label-primary)">
                  <Zap className="size-4 text-zinc-400" />
                  {copy.sprintLength}
                </label>
                <span className="text-xs text-(--label-tertiary)">
                  {copy.sprintLengthDesc}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {PRESET_LENGTHS.map((len) => {
                  const isSelected = draftLength === len;
                  return (
                    <button
                      key={len}
                      type="button"
                      onClick={() => setDraftLength(len)}
                      className={`flex flex-col items-center justify-center gap-1 hover:scale-[1.02] active:scale-[0.98] rounded-[14px] border border-(--separator) py-3 text-sm font-bold transition-all ${
                        isSelected
                          ? 'bg-amber-500 text-white border-amber-600 shadow-[0_2px_10px_rgba(245,158,11,0.25)] dark:bg-amber-500 dark:text-zinc-950'
                          : 'bg-(--surface-grouped) text-(--label-secondary) hover:bg-(--surface-elevated)'
                      }`}
                    >
                      <span className={isSelected ? 'text-lg' : 'text-base font-semibold'}>{len}</span>
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? 'text-amber-100 dark:text-amber-900' : 'text-(--label-tertiary)'}`}>
                        {locale === 'zh' ? '套' : 'Sets'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Area */}
          <div className="border-t border-(--separator) bg-(--surface-grouped) p-4 sm:px-6">
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={onClose} className="rounded-full px-5">
                {copy.cancelAction}
              </Button>
              <Button
                onClick={() => onSave(draftDate, draftLength)}
                className="rounded-full bg-(--cheese-gold) hover:brightness-110 active:scale-[0.97] text-white dark:text-zinc-900 border-0 px-6 font-bold shadow-sm transition-all focus:ring-2 focus:ring-(--cheese-gold)/50 focus:ring-offset-2"
              >
                {copy.saveConfig || (locale === 'zh' ? '保存目标' : 'Save Goal')}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
