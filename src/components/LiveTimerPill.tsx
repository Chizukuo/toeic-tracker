'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import type { Locale } from '@/lib/i18n';
import { formatClock, getTargetDurationMs, type SessionRecord } from '@/lib/toeic';
import { useStore } from '@/store/useStore';

function describeLiveClock(session: SessionRecord, now: number) {
  const runtime = session.timerRuntime;
  if (!runtime) return null;

  const startedAt = new Date(runtime.startedAt).getTime();
  if (!Number.isFinite(startedAt)) return null;

  if (runtime.pendingSubmit) {
    return { text: null, urgent: true };
  }

  if (runtime.isOvertime) {
    const overtimeStartedAt = new Date(runtime.overtimeStartedAt ?? runtime.startedAt).getTime();
    const elapsed = (runtime.overtimeElapsedMs ?? 0) + Math.max(now - overtimeStartedAt, 0);
    return { text: `+${formatClock(elapsed)}`, urgent: true };
  }

  // Listening is a calm stopwatch; reading counts down against the 75-minute limit.
  if (session.type === 'L') {
    return { text: formatClock(Math.max(now - startedAt, 0)), urgent: false };
  }

  const remaining = Math.max(getTargetDurationMs('R') - (now - startedAt), 0);
  return { text: formatClock(remaining), urgent: remaining <= 5 * 60 * 1000 };
}

/** Floating shortcut back to an attempt that is still running while the user browses other pages. */
export function LiveTimerPill({ sessions, locale, hidden }: { sessions: SessionRecord[]; locale: Locale; hidden: boolean }) {
  const selectSession = useStore((state) => state.selectSession);
  const liveSession = sessions.find((session) => session.timerRuntime);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!liveSession || hidden) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hidden, liveSession]);

  const clock = liveSession ? describeLiveClock(liveSession, now) : null;
  const visible = Boolean(liveSession && clock && !hidden);

  return (
    <AnimatePresence>
      {visible && liveSession && clock && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
          className="fixed left-1/2 z-40 -translate-x-1/2"
          style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <Link
            href="/practice"
            onClick={() => selectSession(liveSession.id)}
            className="flex items-center gap-2.5 rounded-full border border-(--glass-border) bg-(--glass-bg) py-2 pl-3 pr-4 text-sm font-semibold text-(--label-primary) shadow-(--shadow-elevated) backdrop-blur-2xl transition-transform hover:scale-[1.02] active:scale-[0.97]"
          >
            <span className={clock.urgent ? 'size-2 rounded-full bg-red-500 animate-pulse' : 'size-2 rounded-full bg-emerald-500 animate-pulse'} />
            <span>{liveSession.label}</span>
            <span className={clock.urgent ? 'font-mono tabular-nums text-red-500' : 'font-mono tabular-nums'}>
              {clock.text ?? (locale === 'zh' ? '待交卷' : 'Submit pending')}
            </span>
            <span className="text-xs font-medium text-(--label-tertiary)">{locale === 'zh' ? '返回计时' : 'Back to timer'}</span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
