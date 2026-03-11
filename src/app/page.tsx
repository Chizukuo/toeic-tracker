import type { Metadata } from 'next';

import HomePageClient from './HomePageClient';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'TOEIC 20天冲刺训练看板',
  description: '用一个静态可部署的看板管理 TOEIC 20 天冲刺计划，覆盖 session 排布、严格计时、错题复盘、未完成题追踪与实时估分。',
  path: '/',
  keywords: ['TOEIC dashboard', 'TOEIC planner', 'TOEIC command deck'],
});

export default function HomePage() {
  return <HomePageClient />;
}