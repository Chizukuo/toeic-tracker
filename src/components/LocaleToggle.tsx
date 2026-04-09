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
    <div className="inline-flex items-center gap-1 rounded-full border border-black/4 bg-zinc-50/50 p-1 dark:border-white/4 dark:bg-white/2">
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
              'h-7 rounded-full border px-3 text-[10px] font-bold uppercase tracking-widest transition-all active:scale-[0.94]',
              active
                ? 'border-black/4 bg-white text-amber-600 shadow-sm dark:border-white/4 dark:bg-[#2C2C2E] dark:text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
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
