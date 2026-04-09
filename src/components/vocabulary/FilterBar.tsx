import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FilterMode = 'all' | 'repeat' | 'recent';

export function FilterBar({
  mode,
  setMode,
  searchQuery,
  setSearchQuery,
  totalCount,
  locale,
  recallMode,
  setRecallMode,
}: {
  mode: FilterMode;
  setMode: (mode: FilterMode) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  totalCount: number;
  locale: 'zh' | 'en';
  recallMode: boolean;
  setRecallMode: (enabled: boolean) => void;
}) {
  const filters: { key: FilterMode; label: string }[] = [
    { key: 'all', label: locale === 'zh' ? '全部' : 'All' },
    { key: 'repeat', label: locale === 'zh' ? '反复查阅' : 'Repeats' },
    { key: 'recent', label: locale === 'zh' ? '最近添加' : 'Recent' },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--label-tertiary)" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={locale === 'zh' ? '搜索生词…' : 'Search vocabulary…'}
          className="h-8 w-full rounded-[10px] bg-(--surface-grouped) pl-9 pr-8 text-[13px] text-(--label-primary) outline-none transition-all placeholder:text-(--label-tertiary) hover:bg-(--surface-grouped)/80 focus:bg-(--surface-elevated) focus:ring-2 focus:ring-(--cheese-gold)/30"
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-(--separator)/50 transition-colors">
            <X className="size-3.5 text-(--label-tertiary)" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Mode pills */}
        <div className="flex gap-0.5 rounded-[10px] bg-(--surface-grouped) p-0.5">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={cn(
                'rounded-[8px] px-3 py-1 text-[11px] font-semibold transition-all',
                mode === key
                  ? 'bg-(--surface-elevated) text-(--label-primary) shadow-sm ring-1 ring-(--separator)/50'
                  : 'text-(--label-secondary) hover:text-(--label-primary)'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-(--separator)/50 mx-1" />

        <button
          type="button"
          onClick={() => setRecallMode(!recallMode)}
          className={cn(
            'flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[11px] font-semibold transition-all shadow-xs',
            recallMode
              ? 'bg-(--cheese-gold-soft) text-(--cheese-gold) ring-1 ring-(--cheese-gold)/30'
              : 'bg-(--surface-grouped) text-(--label-secondary) ring-1 ring-inset ring-(--separator)/50 hover:text-(--label-primary) hover:bg-(--surface-elevated)'
          )}
        >
          <div className={cn("size-1.5 rounded-full transition-colors", recallMode ? "bg-(--cheese-gold)" : "bg-(--separator)")} />
          {locale === 'zh' ? '主动回忆' : 'Recall'}
        </button>
        
        <div className="ml-1 font-mono text-[11px] text-(--label-tertiary)">
          {totalCount}
        </div>
      </div>
    </div>
  );
}