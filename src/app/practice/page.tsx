import type { Metadata } from 'next';

import PracticePageClient from './PracticePageClient';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '训练场 — 计时 · 复盘 · 结果',
  description: '一站式完成 TOEIC 严格计时、错题复盘和即时结果反馈，全程无需切换页面。',
  path: '/practice',
  keywords: ['TOEIC timer', 'TOEIC practice flow', 'TOEIC review'],
});

export default function PracticePage() {
  return <PracticePageClient />;
}
