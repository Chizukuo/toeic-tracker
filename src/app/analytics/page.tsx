import type { Metadata } from 'next';

import AnalyticsPageClient from './AnalyticsPageClient';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '趋势分析与短板诊断',
  description: '集中查看 TOEIC 听力与阅读的趋势变化、薄弱环节和高频错因，让复盘从单题修正升级为结构性诊断。',
  path: '/analytics',
  keywords: ['TOEIC analytics', 'TOEIC weakness analysis', 'TOEIC review dashboard'],
});

export default function AnalyticsPage() {
  return <AnalyticsPageClient />;
}