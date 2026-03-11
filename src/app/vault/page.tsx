import type { Metadata } from 'next';

import VaultPageClient from './VaultPageClient';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '数据备份与同步',
  description: '管理本地数据的导出、恢复、压缩同步链接与重置流程，让 TOEIC 冲刺记录在多设备之间保持可迁移。',
  path: '/vault',
  keywords: ['TOEIC backup', 'TOEIC sync', 'TOEIC local data vault'],
});

export default function VaultPage() {
  return <VaultPageClient />;
}