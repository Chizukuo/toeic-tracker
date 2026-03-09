"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  if (!mounted) return (
    <div className="h-8 w-8 rounded-full border border-zinc-200/80 bg-white/75 opacity-0 dark:border-zinc-800 dark:bg-zinc-900/75" />
  )

  return (
    <div className="flex items-center rounded-full border border-zinc-200/80 bg-white/75 p-1 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/75">
      <Button
        variant="ghost"
        size="sm"
        className="size-6 rounded-full p-0 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    </div>
  )
}
