import { formatSessionTitle, translatePart, type Locale } from '@/lib/i18n';
import {
  getSessionTypeForPart,
  getTargetDurationMs,
  getPartsForType,
  hasResolvedUnfinished,
  PART_QUESTION_COUNTS,
  type MistakeKey,
  type SessionRecord,
} from '@/lib/toeic';

export type NextStepRecommendation = {
  kind: 'resolve-backlog' | 'resume-active' | 'start-active' | 'reinforce-weakness' | 'record-score' | 'review-analytics';
  href: '/practice' | '/insights';
  targetSessionId?: string;
  tone: 'coral' | 'amber' | 'cyan' | 'slate';
  title: string;
  body: string;
  helper: string;
  cta: string;
};

export function getNextStepRecommendation({
  locale,
  sessions,
  activeSessionId,
  historicalScoreCount,
  now = Date.now(),
}: {
  locale: Locale;
  sessions: SessionRecord[];
  activeSessionId: string;
  historicalScoreCount: number;
  now?: number;
}): NextStepRecommendation {
  const selectedSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  // A clock that is still running outranks everything else, even if another set is selected.
  const activeSession = sessions.find((session) => session.timerRuntime) ?? selectedSession;
  const backlogSession = activeSession?.timerRuntime ? undefined : getBacklogSession(sessions);

  if (backlogSession) {
    return {
      kind: 'resolve-backlog',
      href: '/practice',
      targetSessionId: backlogSession.id,
      tone: 'coral',
      title:
        locale === 'zh'
          ? `${backlogSession.label} 还有没做完的题`
          : `Resolve ${backlogSession.label} backlog first`,
      body:
        locale === 'zh'
          ? `${backlogSession.label} 有 ${backlogSession.timerSummary?.unfinishedQuestions ?? 0} 题没来得及做。可以把它们补做完看看实力，也可以直接跳过。`
          : `${backlogSession.label} has ${backlogSession.timerSummary?.unfinishedQuestions ?? 0} questions you didn't get to. Finish them to see your full ability, or skip them.`,
      helper:
        locale === 'zh'
          ? '处理完后，估分会更准。'
          : 'Your estimate gets more accurate once this is settled.',
      cta: locale === 'zh' ? '去处理' : 'Handle them',
    };
  }

  if (activeSession?.timerRuntime && isExpiredReadingAttempt(activeSession, now)) {
    return {
      kind: 'resume-active',
      href: '/practice',
      targetSessionId: activeSession.id,
      tone: 'coral',
      title: locale === 'zh' ? `${activeSession.label} 时间到了，还没交卷` : `${activeSession.label} ran out of time`,
      body:
        locale === 'zh'
          ? '填一下还有几题没做，就能保存这次成绩并开始对答案。'
          : 'Enter how many questions you did not get to, then save the attempt and check answers.',
      helper: locale === 'zh' ? '用时已按 75 分钟上限记录。' : 'Time is recorded up to the 75-minute limit.',
      cta: locale === 'zh' ? '去交卷' : 'Submit it',
    };
  }

  if (activeSession?.status === 'in-progress' || activeSession?.timerRuntime) {
    return {
      kind: 'resume-active',
      href: '/practice',
      targetSessionId: activeSession.id,
      tone: 'amber',
      title: locale === 'zh' ? `继续 ${activeSession.label}` : `Resume ${activeSession.label}`,
      body:
        locale === 'zh'
          ? `${formatSessionTitle(locale, activeSession)} 还没做完，接着上次的进度继续。`
          : `${formatSessionTitle(locale, activeSession)} isn't finished yet. Pick up where you left off.`,
      helper:
        locale === 'zh' ? '一次专心做完一套。' : 'Finish one set at a time.',
      cta: locale === 'zh' ? '继续训练' : 'Resume Practice',
    };
  }

  if (activeSession?.status === 'not-started') {
    return {
      kind: 'start-active',
      href: '/practice',
      targetSessionId: activeSession.id,
      tone: 'cyan',
      title: locale === 'zh' ? `开始 ${formatSessionTitle(locale, activeSession)}` : `Start ${activeSession.title}`,
      body:
        locale === 'zh'
          ? activeSession.type === 'L'
            ? '准备好题本和听力音频，点下面的按钮开始。'
            : '准备好题本，点下面的按钮开始，限时 75 分钟。'
          : activeSession.type === 'L'
            ? 'Get your test book and the audio ready, then tap the button below.'
            : 'Get your test book ready, then tap the button below. You have 75 minutes.',
      helper:
        locale === 'zh' ? '做完后对答案，就能看到估分。' : 'Check your answers afterwards to get a score estimate.',
      cta: locale === 'zh' ? '开始做题' : 'Start',
    };
  }

  const weaknessPlan = getWeaknessPlan(locale, sessions);
  if (weaknessPlan) {
    return weaknessPlan;
  }

  const nextOpenSession = sessions.find((session) => session.status !== 'debugged');
  if (nextOpenSession) {
    return {
      kind: 'start-active',
      href: '/practice',
      targetSessionId: nextOpenSession.id,
      tone: 'cyan',
      title: locale === 'zh' ? `下一套：${formatSessionTitle(locale, nextOpenSession)}` : `Next: ${nextOpenSession.title}`,
      body:
        locale === 'zh'
          ? '保持节奏，继续做下一套。'
          : 'Keep the momentum going with the next set.',
      helper: locale === 'zh' ? '做完后对答案，就能看到估分。' : 'Check your answers afterwards to get a score estimate.',
      cta: locale === 'zh' ? '开始做题' : 'Start',
    };
  }

  if (historicalScoreCount === 0) {
    return {
      kind: 'record-score',
      href: '/insights',
      tone: 'amber',
      title: locale === 'zh' ? '记一下你的模考或真考成绩' : 'Record a mock or real test score',
      body:
        locale === 'zh'
          ? '计划里的套题都做完了。记下成绩，就能看到分数变化曲线。'
          : 'Every planned set is done. Record a score to start a progress chart.',
      helper:
        locale === 'zh' ? '在「分析」页的「预测」里添加。' : 'Add it under Forecast on the Insights page.',
      cta: locale === 'zh' ? '去记录成绩' : 'Record a Score',
    };
  }

  return {
    kind: 'review-analytics',
    href: '/insights',
    tone: 'slate',
    title: locale === 'zh' ? '看看自己进步了多少' : 'See how far you have come',
    body:
      locale === 'zh'
        ? '计划里的套题都做完了，去「分析」页看看弱项有没有改善。'
        : 'Every planned set is done. Check Insights to see whether your weak spots improved.',
    helper:
      locale === 'zh' ? '也可以在首页加大计划题量，继续练。' : 'You can also add more sets from the Home page.',
    cta: locale === 'zh' ? '查看分析' : 'Open Insights',
  };
}

function isExpiredReadingAttempt(session: SessionRecord, now: number) {
  const runtime = session.timerRuntime;
  if (session.type !== 'R' || !runtime || runtime.isOvertime) return false;
  if (runtime.pendingSubmit) return true;
  const startedAt = new Date(runtime.startedAt).getTime();
  return Number.isFinite(startedAt) && now - startedAt >= getTargetDurationMs('R');
}

function getBacklogSession(sessions: SessionRecord[]) {
  return sessions
    .filter(
      (session) =>
        session.type === 'R' &&
        (session.timerSummary?.unfinishedQuestions ?? 0) > 0 &&
        !hasResolvedUnfinished(session)
    )
    .sort((left, right) => {
      const unfinishedDelta = (right.timerSummary?.unfinishedQuestions ?? 0) - (left.timerSummary?.unfinishedQuestions ?? 0);
      if (unfinishedDelta !== 0) {
        return unfinishedDelta;
      }

      const rightCompletedAt = new Date(right.timerSummary?.completedAt ?? 0).getTime();
      const leftCompletedAt = new Date(left.timerSummary?.completedAt ?? 0).getTime();
      return rightCompletedAt - leftCompletedAt;
    })[0];
}

function getWeaknessPlan(locale: Locale, sessions: SessionRecord[]): NextStepRecommendation | null {
  const weakestPart = getWeakestPart(sessions);
  if (!weakestPart) {
    return null;
  }

  const targetType = getSessionTypeForPart(weakestPart);
  const candidate = sessions.find((session) => session.type === targetType && session.status !== 'debugged');

  if (!candidate) {
    return null;
  }

  return {
    kind: 'reinforce-weakness',
    href: '/practice',
    targetSessionId: candidate.id,
    tone: targetType === 'L' ? 'cyan' : 'amber',
    title:
      locale === 'zh'
        ? `优先补强 ${translatePart(locale, weakestPart)}`
        : `Reinforce ${translatePart(locale, weakestPart)} next`,
    body:
      locale === 'zh'
        ? `目前 ${translatePart(locale, weakestPart)} 错得最多，下一套建议做 ${formatSessionTitle(locale, candidate)}。`
        : `You're losing the most points in ${translatePart(locale, weakestPart)}, so ${candidate.title} is a good next set.`,
    helper:
      locale === 'zh'
        ? `${candidate.label} 对应 ${formatSessionTitle(locale, candidate)}。`
        : `${candidate.label} maps to ${formatSessionTitle(locale, candidate)}.`,
    cta: locale === 'zh' ? `做 ${candidate.label}` : `Do ${candidate.label}`,
  };
}

/**
 * Part with the highest aggregate error rate across every started session of its type.
 * Returns null until at least one mistake has been logged, so a clean record has no "weak spot".
 */
export function getWeakestPart(sessions: SessionRecord[]): MistakeKey | null {
  const totals = new Map<MistakeKey, { mistakes: number; questions: number }>();

  for (const session of sessions) {
    if (session.status === 'not-started') {
      continue;
    }

    for (const part of getPartsForType(session.type)) {
      const entry = totals.get(part) ?? { mistakes: 0, questions: 0 };
      entry.mistakes += Math.min(Math.max(session.mistakes[part] ?? 0, 0), PART_QUESTION_COUNTS[part]);
      entry.questions += PART_QUESTION_COUNTS[part];
      totals.set(part, entry);
    }
  }

  let weakestPart: MistakeKey | null = null;
  let weakestRate = 0;

  for (const [part, { mistakes, questions }] of totals) {
    const rate = questions > 0 ? mistakes / questions : 0;
    if (rate > weakestRate) {
      weakestRate = rate;
      weakestPart = part;
    }
  }

  return weakestPart;
}
