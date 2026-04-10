import { type SessionRecord, type VocabularyEntry, getIncorrectAnswers } from '@/lib/toeic';
import { type HistoricalScoreRecord } from '@/lib/storeSnapshot';

export type Achievement = {
  id: string;
  icon: string;
  title: { zh: string; en: string };
  desc: { zh: string; en: string };
  condition: (state: AchievementCheckState) => boolean;
};

export type AchievementCheckState = {
  sessions: SessionRecord[];
  historicalScores: HistoricalScoreRecord[];
  unlockedAchievements: string[];
  vocabularyEntries?: VocabularyEntry[];
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-session',
    icon: '🎯',
    title: { zh: '初出茅庐', en: 'First Blood' },
    desc: { zh: '完成你的第一次完整测验与订正。', en: 'Complete and review your first full practice session.' },
    condition: (state) => state.sessions.some((s) => s.status === 'debugged'),
  },
  {
    id: 'streak-3',
    icon: '🔥',
    title: { zh: '渐入佳境', en: 'On Fire' },
    desc: { zh: '连续 3 天完成练习或记录成绩。', en: 'Complete a session or log a score 3 days in a row.' },
    condition: (state) => hasStreak(state, 3),
  },
  {
    id: 'streak-7',
    icon: '⚡',
    title: { zh: '持之以恒', en: 'Unstoppable' },
    desc: { zh: '连续 7 天完成练习或记录成绩。', en: 'Complete a session or log a score 7 days in a row.' },
    condition: (state) => hasStreak(state, 7),
  },
  {
    id: 'perfect-listening',
    icon: '🎧',
    title: { zh: '顺风耳', en: 'Golden Ears' },
    desc: { zh: '在一次听力测验中获得极高准确率（错题≤5）。', en: 'Achieve very high accuracy in a listening session (≤5 mistakes).' },
    condition: (state) =>
      state.sessions.some(
        (s) => s.type === 'L' && s.status === 'debugged' && getIncorrectAnswers(s) <= 5
      ),
  },
  {
    id: 'perfect-reading',
    icon: '📖',
    title: { zh: '一目十行', en: 'Speed Reader' },
    desc: { zh: '在一次阅读测验中获得极高准确率（错题≤5）。', en: 'Achieve very high accuracy in a reading session (≤5 mistakes).' },
    condition: (state) =>
      state.sessions.some(
        (s) => s.type === 'R' && s.status === 'debugged' && getIncorrectAnswers(s) <= 5
      ),
  },
  {
    id: 'high-score',
    icon: '👑',
    title: { zh: '突破 800', en: 'The 800 Club' },
    desc: { zh: '正式记录或预估总分达到 800 分以上。', en: 'Log an official or estimated total score over 800.' },
    condition: (state) => state.historicalScores.some((h) => h.total >= 800),
  },
  {
    id: 'first-vocab',
    icon: '📝',
    title: { zh: '生词本', en: 'Word Smith' },
    desc: { zh: '这不仅是考试，更是英语实力。', en: 'Not just for the test, but for the language.' },
    condition: (state) => (state.vocabularyEntries?.length ?? 0) > 0,
  },
];

function hasStreak(state: AchievementCheckState, targetDays: number): boolean {
  const activeDates = new Set<string>();

  for (const s of state.sessions) {
    if (s.status === 'debugged' && s.timerSummary?.completedAt) {
      activeDates.add(s.timerSummary.completedAt.split('T')[0]);
    }
  }
  for (const h of state.historicalScores) {
    activeDates.add(h.date);
  }

  const sorted = Array.from(activeDates).sort();
  if (sorted.length < targetDays) return false;

  let currentStreak = 1;
  let maxStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);

    // Convert diff to days using UTC to avoid timezone daylight savings issues
    const diffTime = Math.abs(Date.UTC(curr.getFullYear(), curr.getMonth(), curr.getDate()) - Date.UTC(prev.getFullYear(), prev.getMonth(), prev.getDate()));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else if (diffDays > 1) {
      currentStreak = 1;
    }
  }

  return maxStreak >= targetDays;
}

export function evaluateAchievements(state: AchievementCheckState): string[] {
  return ACHIEVEMENTS.filter(
    (a) => !state.unlockedAchievements.includes(a.id) && a.condition(state)
  ).map((a) => a.id);
}
