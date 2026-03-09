'use client';

import { Languages } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getCopy } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

export function LocaleToggle() {
  const locale = useStore((state) => state.locale);
  const setLocale = useStore((state) => state.setLocale);
  const copy = getCopy(locale);

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-white/75 p-1 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex items-center gap-2 px-2 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
        <Languages className="size-3.5" />
        <span className="hidden sm:inline">{copy.languageLabel}</span>
      </div>
      {(['zh', 'en'] as const).map((value) => {
        const active = value === locale;
        return (
          <Button
            key={value}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLocale(value)}
            className={cn(
              'rounded-full px-3 font-mono text-[11px] uppercase tracking-[0.22em] transition-all',
              active
                ? 'bg-amber-400 text-zinc-950 shadow-sm hover:bg-amber-400'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
            )}
            aria-pressed={active}
          >
            {value}
          </Button>
        );
      })}
    </div>
  );
}
