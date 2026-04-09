"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

type ThemeTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>
  }
}

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()

  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const toggleTheme = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark"
    const root = document.documentElement
    const button = event.currentTarget
    const rect = button.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const maxRadius = Math.hypot(
      Math.max(centerX, window.innerWidth - centerX),
      Math.max(centerY, window.innerHeight - centerY)
    )

    root.style.setProperty("--theme-transition-x", `${centerX}px`)
    root.style.setProperty("--theme-transition-y", `${centerY}px`)
    root.style.setProperty("--theme-transition-radius", `${maxRadius}px`)

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTheme(nextTheme)
      return
    }

    const doc = document as ThemeTransitionDocument

    if (!doc.startViewTransition) {
      setTheme(nextTheme)
      return
    }

    root.classList.add("theme-switching")
    const transition = doc.startViewTransition(() => {
      setTheme(nextTheme)
    })

    transition.finished.finally(() => {
      root.classList.remove("theme-switching")
    })
  }, [resolvedTheme, setTheme])

  if (!mounted) return (
    <div className="control-shell h-9 w-18.5 opacity-0" />
  )

  return (
    <div className="rounded-full border border-black/4 dark:border-white/4 bg-zinc-50/50 dark:bg-white/2 p-1">
      <button
        type="button"
        onClick={toggleTheme}
        className="relative flex h-8 w-18 items-center justify-between rounded-full px-2.5 text-zinc-400 outline-none transition-all active:scale-[0.94]"
        aria-label="Toggle theme"
        aria-pressed={resolvedTheme === "dark"}
      >
        <div
          className={cn(
            "absolute top-0.5 left-0.5 h-7 w-7 rounded-full bg-white dark:bg-[#2C2C2E] shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
            resolvedTheme === "dark" ? "translate-x-10" : "translate-x-0"
          )}
        />
        <Sun className={cn("relative z-10 size-3.5 transition-all duration-300", resolvedTheme === "dark" ? "opacity-30" : "text-amber-500 opacity-100")} />
        <Moon className={cn("relative z-10 size-3.5 transition-all duration-300", resolvedTheme === "dark" ? "text-amber-400 opacity-100" : "opacity-30")} />
      </button>
    </div>
  )
}
