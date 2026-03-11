import type { Metadata } from 'next';

import TimerPageClient from './TimerPageClient';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '严格计时与错题录入',
  description: '把 TOEIC 严格倒计时、瀑布图节奏追踪和错题录入放在同一工作区，适合完整模拟每一套听力与阅读流程。',
  path: '/timer',
  keywords: ['TOEIC timer', 'TOEIC mock exam timer', 'TOEIC mistake review'],
});

export default function TimerPage() {
  return <TimerPageClient />;
}