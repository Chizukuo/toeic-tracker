import type { Metadata } from 'next';

import VocabPageClient from './VocabPageClient';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '生词本',
  description: '收集和管理错题中的生词与短语，通过记录重复出错的词汇，针对性攻克阅读与听力盲区。',
  path: '/vocab',
  keywords: ['TOEIC vocabulary', 'TOEIC flashcards', 'TOEIC mistakes'],
});

export default function VocabPage() {
  return <VocabPageClient />;
}
