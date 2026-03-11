import type { Metadata } from 'next';

import ScoresPageClient from './ScoresPageClient';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'TOEIC 分数估算器',
  description: '按套次查看听力、阅读与总分估算，结合未完成题与历史表现，快速判断当前冲刺阶段的分数区间。',
  path: '/scores',
  keywords: ['TOEIC score estimator', 'TOEIC predicted score', 'TOEIC score trend'],
});

export default function ScoresPage() {
  return <ScoresPageClient />;
}