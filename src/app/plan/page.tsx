import type { Metadata } from 'next';

import PlanPageClient from './PlanPageClient';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '20天冲刺计划与 Session 排布',
  description: '查看 TOEIC 20 天冲刺 session 全局排布，快速切换当前工作区，并聚焦下一套需要推进的听力或阅读任务。',
  path: '/plan',
  keywords: ['TOEIC schedule', 'TOEIC sprint plan', 'TOEIC session tracker'],
});

export default function PlanPage() {
  return <PlanPageClient />;
}