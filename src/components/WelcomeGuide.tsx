'use client';

import { useSyncExternalStore } from 'react';
import { BookOpenCheck, CalendarDays, ClipboardCheck, Timer, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import type { Locale } from '@/lib/i18n';
import { useStore } from '@/store/useStore';

const DISMISS_KEY = 'toeic-welcome-dismissed';

const dismissListeners = new Set<() => void>();

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribeDismissed(listener: () => void) {
  dismissListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    dismissListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Without storage the guide simply comes back next visit.
  }
  dismissListeners.forEach((listener) => listener());
}

/**
 * First-run explainer: what to prepare, the three-step loop, and the exam date —
 * everything a newcomer needs before the first set, in plain words.
 */
export function WelcomeGuide({
  locale,
  hasProgress,
  examDateIsSet,
}: {
  locale: Locale;
  hasProgress: boolean;
  examDateIsSet: boolean;
}) {
  const examDate = useStore((state) => state.examDate);
  const setExamDate = useStore((state) => state.setExamDate);
  const setCount = useStore((state) => Math.max(state.sprintConfig.listeningCount, state.sprintConfig.readingCount));
  // The server snapshot says "dismissed", so returning users never see a flash of the guide.
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => true);
  const dismiss = writeDismissed;

  const zh = locale === 'zh';
  const steps = [
    {
      icon: BookOpenCheck,
      title: zh ? '准备一套模拟题' : 'Get a practice test',
      body: zh
        ? '纸质或电子版都行，比如官方真题集。每套 = 听力 100 题 + 阅读 100 题。'
        : 'Paper or PDF, e.g. an official practice book. Each set = 100 listening + 100 reading questions.',
    },
    {
      icon: Timer,
      title: zh ? '在这里计时做题' : 'Time yourself here',
      body: zh
        ? '听力跟着音频做；阅读限时 75 分钟，网页帮你倒计时，还能看出每个 Part 花了多久。'
        : 'Listening follows the audio; reading gets a 75-minute countdown that also tracks time per Part.',
    },
    {
      icon: ClipboardCheck,
      title: zh ? '对答案，填错了几题' : 'Check answers, enter mistakes',
      body: zh
        ? '每个 Part 错几题填一下，马上得到估分，并告诉你最该补哪种题型。'
        : 'Enter how many you missed per Part to get a score estimate and see which question type to work on.',
    },
  ];

  const visible = !hasProgress && !dismissed;

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.section
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          className="cheese-card relative overflow-hidden p-6 sm:p-8"
          aria-labelledby="welcome-title"
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label={zh ? '关闭新手指引' : 'Close the getting-started guide'}
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-[var(--label-tertiary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--label-primary)]"
          >
            <X className="size-4" />
          </button>

          <h2 id="welcome-title" className="pr-8 text-xl font-bold tracking-tight text-[var(--label-primary)]">
            {zh ? '第一次用？3 步就会' : 'New here? It takes 3 steps'}
          </h2>
          <p className="mt-1.5 text-sm text-[var(--label-secondary)]">
            {zh
              ? `计划共 ${setCount} 套（L = 听力，R = 阅读）。不用注册，记录只保存在这个浏览器里。`
              : `The plan has ${setCount} sets (L = Listening, R = Reading). No sign-up; records stay in this browser.`}
          </p>

          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="rounded-[18px] bg-[var(--surface-grouped)] p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-[var(--cheese-gold)] text-xs font-bold text-white dark:text-zinc-900">
                      {index + 1}
                    </span>
                    <Icon className="size-4 text-[var(--cheese-gold)]" />
                  </div>
                  <div className="mt-2.5 text-sm font-semibold text-[var(--label-primary)]">{step.title}</div>
                  <p className="mt-1 text-[13px] leading-5 text-[var(--label-secondary)]">{step.body}</p>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--label-secondary)]">
              <CalendarDays className="size-4 text-[var(--cheese-cyan)]" />
              {zh ? '考试日期' : 'Exam date'}
              <input
                type="date"
                value={examDateIsSet ? examDate : ''}
                onChange={(event) => setExamDate(event.target.value)}
                className="rounded-full border border-[var(--separator)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm text-[var(--label-primary)] outline-none focus:ring-2 focus:ring-[var(--cheese-gold)]/30"
              />
              <span className="text-xs text-[var(--label-tertiary)]">{zh ? '（可稍后再设）' : '(you can set it later)'}</span>
            </label>
            <button
              type="button"
              onClick={dismiss}
              className="self-start rounded-full border border-[var(--separator)] px-5 py-2 text-sm font-semibold text-[var(--label-secondary)] transition-colors hover:bg-[var(--surface-grouped)] hover:text-[var(--label-primary)] sm:self-auto"
            >
              {zh ? '知道了' : 'Got it'}
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
