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
    <div className="control-shell inline-flex items-center gap-0.5 p-1 sm:gap-1">
      <div className="flex items-center gap-2 px-1.5 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 sm:px-2">
        <Languages className="size-3.5" />
        <span className="hidden xl:inline">{copy.languageLabel}</span>
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
              'rounded-full px-2.5 font-mono text-[11px] uppercase tracking-[0.22em] transition-all sm:px-3',
              active
                ? 'bg-[linear-gradient(135deg,#ffd971_0%,#ff8f56_100%)] text-zinc-950 shadow-[0_14px_26px_-16px_rgba(245,158,11,0.9)] hover:text-zinc-950'
                : 'text-zinc-500 hover:bg-white/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-zinc-100'
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
