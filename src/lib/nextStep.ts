import { formatSessionTitle, translatePart, type Locale } from '@/lib/i18n';
import {
  getPartsForType,
  PART_QUESTION_COUNTS,
  type MistakeKey,
  type SessionRecord,
} from '@/lib/toeic';

export type NextStepRecommendation = {
  kind: 'resolve-backlog' | 'resume-active' | 'start-active' | 'reinforce-weakness' | 'record-score' | 'review-analytics';
  href: '/unfinished' | '/timer' | '/scores' | '/analytics';
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
}: {
  locale: Locale;
  sessions: SessionRecord[];
  activeSessionId: string;
  historicalScoreCount: number;
}): NextStepRecommendation {
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const backlogSession = getBacklogSession(sessions);

  if (backlogSession) {
    return {
      kind: 'resolve-backlog',
      href: '/unfinished',
      targetSessionId: backlogSession.id,
      tone: 'coral',
      title:
        locale === 'zh'
          ? `先处理 ${backlogSession.label} 的未完成题`
          : `Resolve ${backlogSession.label} backlog first`,
      body:
        locale === 'zh'
          ? `${backlogSession.label} 仍有 ${backlogSession.timerSummary?.unfinishedQuestions ?? 0} 题未完成，这会持续放大阅读失分并污染分析。`
          : `${backlogSession.label} still has ${backlogSession.timerSummary?.unfinishedQuestions ?? 0} unfinished items, which keeps inflating reading loss and distorting analytics.`,
      helper:
        locale === 'zh'
          ? '先把 backlog 清掉，再看估分和趋势才更可信。'
          : 'Clear the backlog before trusting projections and trends.',
      cta: locale === 'zh' ? '打开未完成页' : 'Open Unfinished',
    };
  }

  if (activeSession?.status === 'in-progress' || activeSession?.timerRuntime) {
    return {
      kind: 'resume-active',
      href: '/timer',
      targetSessionId: activeSession.id,
      tone: 'amber',
      title: locale === 'zh' ? `继续 ${activeSession.label}` : `Resume ${activeSession.label}`,
      body:
        locale === 'zh'
          ? `${formatSessionTitle(locale, activeSession)} 还在进行中，优先把严格计时或复盘闭环做完。`
          : `${formatSessionTitle(locale, activeSession)} is still in progress. Close the loop on timing and review before switching context.`,
      helper:
        locale === 'zh' ? '不要同时摊开多个 session。' : 'Do not spread focus across multiple sessions.',
      cta: locale === 'zh' ? '回到计时页' : 'Open Timer',
    };
  }

  if (activeSession?.status === 'not-started') {
    return {
      kind: 'start-active',
      href: '/timer',
      targetSessionId: activeSession.id,
      tone: 'cyan',
      title: locale === 'zh' ? `开始 ${activeSession.label}` : `Start ${activeSession.label}`,
      body:
        locale === 'zh'
          ? `当前活跃套题还是未开始状态，直接进入 ${formatSessionTitle(locale, activeSession)} 会比继续看总览更有效。`
          : `The active set is still untouched, so going straight into ${formatSessionTitle(locale, activeSession)} is more useful than staying on the overview.`,
      helper:
        locale === 'zh' ? '优先推进当前节点，而不是继续切页。' : 'Advance the current node before browsing around.',
      cta: locale === 'zh' ? '开始当前套题' : 'Start Current Set',
    };
  }

  const weaknessPlan = getWeaknessPlan(locale, sessions);
  if (weaknessPlan) {
    return weaknessPlan;
  }

  if (historicalScoreCount === 0) {
    return {
      kind: 'record-score',
      href: '/scores',
      tone: 'amber',
      title: locale === 'zh' ? '补一条历史成绩' : 'Add a score record',
      body:
        locale === 'zh'
          ? '当前训练闭环已经形成，下一步应该把模考或估分写入历史曲线，开始看趋势。'
          : 'The training loop is in place. The next useful move is to write a mock or projected score into history and start tracking trends.',
      helper:
        locale === 'zh' ? '没有历史曲线时，总分变化很难校准。' : 'Without score history, total-score movement is hard to calibrate.',
      cta: locale === 'zh' ? '打开估分页' : 'Open Scores',
    };
  }

  return {
    kind: 'review-analytics',
    href: '/analytics',
    tone: 'slate',
    title: locale === 'zh' ? '回看趋势与热点' : 'Review trend and hotspots',
    body:
      locale === 'zh'
        ? '当前没有明显的流程阻塞点，适合回到分析页检查最近薄弱项是否正在收敛。'
        : 'There is no obvious workflow blocker right now, so this is a good time to inspect whether weak spots are starting to converge.',
    helper:
      locale === 'zh' ? '优先验证训练有没有真正改变失分结构。' : 'Verify whether training is actually changing the loss structure.',
    cta: locale === 'zh' ? '查看分析页' : 'Open Analytics',
  };
}

function getBacklogSession(sessions: SessionRecord[]) {
  return sessions
    .filter((session) => session.type === 'R' && (session.timerSummary?.unfinishedQuestions ?? 0) > 0)
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

  const targetType = weakestPart.startsWith('Part 1') || weakestPart.startsWith('Part 2') || weakestPart.startsWith('Part 3') || weakestPart.startsWith('Part 4') ? 'L' : 'R';
  const candidate = sessions.find((session) => session.type === targetType && session.status !== 'debugged');

  if (!candidate) {
    return null;
  }

  return {
    kind: 'reinforce-weakness',
    href: '/timer',
    targetSessionId: candidate.id,
    tone: targetType === 'L' ? 'cyan' : 'amber',
    title:
      locale === 'zh'
        ? `优先补强 ${translatePart(locale, weakestPart)}`
        : `Reinforce ${translatePart(locale, weakestPart)} next`,
    body:
      locale === 'zh'
        ? `${translatePart(locale, weakestPart)} 是当前最稳定的失分源，下一步切到 ${candidate.label} 会更有针对性。`
        : `${translatePart(locale, weakestPart)} is the most stable loss source right now, so moving into ${candidate.label} is the most targeted next step.`,
    helper:
      locale === 'zh'
        ? `${candidate.label} 对应 ${formatSessionTitle(locale, candidate)}。`
        : `${candidate.label} maps to ${formatSessionTitle(locale, candidate)}.`,
    cta: locale === 'zh' ? '切到目标套题' : 'Switch to Target Set',
  };
}

function getWeakestPart(sessions: SessionRecord[]): MistakeKey | null {
  const completed = sessions.filter((session) => session.status !== 'not-started');
  if (completed.length === 0) {
    return null;
  }

  let weakestPart: MistakeKey | null = null;
  let weakestRate = -1;

  for (const session of completed) {
    for (const part of getPartsForType(session.type)) {
      const mistakes = session.mistakes[part] ?? 0;
      const rate = PART_QUESTION_COUNTS[part] > 0 ? mistakes / PART_QUESTION_COUNTS[part] : 0;

      if (rate > weakestRate) {
        weakestRate = rate;
        weakestPart = part;
      }
    }
  }

  return weakestPart;
}