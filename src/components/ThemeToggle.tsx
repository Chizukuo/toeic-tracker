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
    <div className="control-shell p-1">
      <button
        type="button"
        onClick={toggleTheme}
        className="relative flex h-7 w-16.5 items-center justify-between rounded-full px-2 text-zinc-500 outline-none transition-colors hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-amber-400/50 dark:text-zinc-400 dark:hover:text-zinc-50"
        aria-label="Toggle theme"
        aria-pressed={resolvedTheme === "dark"}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-[linear-gradient(135deg,#ffd971_0%,#ff8f56_100%)] shadow-[0_12px_24px_-12px_rgba(245,158,11,0.95)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-[linear-gradient(135deg,#7ddfff_0%,#54d4ff_100%)] dark:shadow-[0_12px_24px_-12px_rgba(84,212,255,0.9)]",
            resolvedTheme === "dark" ? "translate-x-9.5" : "translate-x-0"
          )}
        />
        <Sun className={cn("relative z-10 size-3.5 transition-all duration-300", resolvedTheme === "dark" ? "scale-90 opacity-55" : "text-zinc-950 opacity-100")} />
        <Moon className={cn("relative z-10 size-3.5 transition-all duration-300", resolvedTheme === "dark" ? "text-zinc-950 opacity-100" : "scale-90 opacity-55")} />
        <span className="sr-only">Toggle theme</span>
      </button>
    </div>
  )
}
