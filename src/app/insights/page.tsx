import type { Metadata } from 'next';

import InsightsPageClient from './InsightsPageClient';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '参考台 — 趋势 · 估分 · 未完成',
  description: '集中查看 TOEIC 趋势分析、分数估算和未完成题追踪，按需参考，不打断训练节奏。',
  path: '/insights',
  keywords: ['TOEIC analytics', 'TOEIC score estimator', 'TOEIC insights'],
});

export default function InsightsPage() {
  return <InsightsPageClient />;
}
