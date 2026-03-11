import type { Metadata } from 'next';

import UnfinishedPageClient from './UnfinishedPageClient';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '未完成题追踪',
  description: '集中查看超时后遗留的阅读题、影响分值与待补动作，避免未完成题在复盘链路里继续被忽略。',
  path: '/unfinished',
  keywords: ['TOEIC unfinished questions', 'TOEIC timeout review', 'TOEIC reading backlog'],
});

export default function UnfinishedPage() {
  return <UnfinishedPageClient />;
}